import * as search from './search.js';
import * as utils from './utils.js';
import * as arena from './arena.js';
import * as log from './log.js';
import * as service from './launcher_service.js';
import * as context from './context.js';

import type {Ext} from './extension.js';
import type {ShellWindow} from './window.js';
import type {JsonIPC} from './launcher_service.js';

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
import St from 'gi://St';

const app_sys = Shell.AppSystem.get_default();

const Clipboard = St.Clipboard.get_default();
const CLIPBOARD_TYPE = St.ClipboardType.CLIPBOARD;

interface SearchOption {
    result: JsonIPC.SearchResult;
    menu: St.Widget;
}

export class Launcher extends search.Search {
    ext: Ext;
    options: Map<number, SearchOption> = new Map();
    options_array: Array<SearchOption> = new Array();
    windows: arena.Arena<ShellWindow> = new arena.Arena();
    service: null | service.LauncherService = null;
    append_id: null | number = null;
    active_menu: null | any = null;
    opened: boolean = false;

    constructor(ext: Ext) {
        super();

        this.ext = ext;

        this.dialog.dialogLayout._dialog.y_align = Clutter.ActorAlign.START;
        this.dialog.dialogLayout._dialog.x_align = Clutter.ActorAlign.START;
        this.dialog.dialogLayout.y = 48;

        this.cancel = () => {
            ext.overlay.visible = false;
            this.stop_services(ext);
            this.opened = false;
        };

        this.search = (pat: string) => {
            if (this.service !== null) {
                this.service.query(pat);
            }
        };

        this.select = (id: number) => {
            ext.overlay.visible = false;

            if (id >= this.options.size) return;

            const option = this.options_array[id];
            if (option && option.result.window) {
                const win = this.ext.windows.get(option.result.window);
                if (!win) return;

                if (win.workspace_id() == ext.active_workspace()) {
                    const {x, y, width, height} = win.rect();
                    ext.overlay.x = x;
                    ext.overlay.y = y;
                    ext.overlay.width = width;
                    ext.overlay.height = height;
                    ext.overlay.visible = true;
                }
            }
        };

        this.activate_id = (id: number) => {
            ext.overlay.visible = false;

            const selected = this.options_array[id];

            if (selected) {
                this.service?.activate(selected.result.id);
            }
        };

        this.complete = () => {
            const option = this.options_array[this.active_id];
            if (option) {
                this.service?.complete(option.result.id);
            }
        };

        this.quit = (id: number) => {
            const option = this.options_array[id];
            if (option) {
                this.service?.quit(option.result.id);
            }
        };

        this.copy = (id: number) => {
            const option = this.options_array[id];
            if (!option) return;
            if (option.result.description) {
                Clipboard.set_text(CLIPBOARD_TYPE, option.result.description);
            } else if (option.result.name) {
                Clipboard.set_text(CLIPBOARD_TYPE, option.result.name);
            }
        };
    }

    on_response(response: JsonIPC.Response) {
        if ('Close' === response) {
            this.close();
        } else if ('Update' in response) {
            this.clear();

            if (this.append_id !== null) {
                GLib.source_remove(this.append_id);
                this.append_id = null;
            }

            if (response.Update.length === 0) {
                this.cleanup();
                return;
            }

            this.append_id = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                const item = response.Update.shift();
                if (item) {
                    try {
                        const button = new search.SearchOption(
                            item.name,
                            item.description,
                            item.category_icon ? item.category_icon : null,
                            item.icon ? item.icon : null,
                            this.icon_size(),
                            null,
                            null
                        );

                        const menu = context.addMenu(button.widget, menu => {
                            if (this.active_menu) {
                                this.active_menu.actor.hide();
                            }

                            this.active_menu = menu;

                            this.service?.context(item.id);
                        });

                        this.append_search_option(button);
                        const result = {result: item, menu};
                        this.options.set(item.id, result);
                        this.options_array.push(result);
                    } catch (error) {
                        log.error(`failed to create SearchOption: ${error}`);
                    }
                }

                if (response.Update.length === 0) {
                    this.append_id = null;
                    return false;
                }

                return true;
            });
        } else if ('Fill' in response) {
            this.set_text(response.Fill);
        } else if ('DesktopEntry' in response) {
            this.launch_desktop_entry(response.DesktopEntry);
            this.close();
        } else if ('Context' in response) {
            const {id, options} = response.Context;

            const option = this.options.get(id);
            if (option) {
                (option.menu as any).removeAll();
                for (const opt of options) {
                    context.addContext(option.menu, opt.name, () => {
                        this.service?.activate_context(id, opt.id);
                    });

                    (option.menu as any).toggle();
                }
            } else {
                log.error(`did not find id: ${id}`);
            }
        } else {
            log.error(`unknown response: ${JSON.stringify(response)}`);
        }
    }

    clear() {
        this.options.clear();
        this.options_array.splice(0);
        super.clear();
    }

    launch_desktop_app(app: any, path: string) {
        try {
            app.launch([], null);
        } catch (why) {
            log.error(`${path}: could not launch by app info: ${why}`);
        }
    }

    launch_desktop_entry(entry: JsonIPC.DesktopEntry) {
        const basename = (name: string): string => {
            return name
                .substr(name.indexOf('/applications/') + 14)
                .replace('/', '-');
        };

        const desktop_entry_id = basename(entry.path);

        const gpuPref =
            entry.gpu_preference === 'Default'
                ? Shell.AppLaunchGpu.DEFAULT
                : Shell.AppLaunchGpu.DISCRETE;

        log.debug(`launching desktop entry: ${desktop_entry_id}`);

        let app = app_sys.lookup_desktop_wmclass(desktop_entry_id);

        if (!app) {
            app = app_sys.lookup_app(desktop_entry_id);
        }

        if (!app) {
            log.error(
                `GNOME Shell cannot find desktop entry for ${desktop_entry_id}`
            );
            log.error(`mosaic-launcher will use Gio.DesktopAppInfo instead`);

            const dapp = Gio.DesktopAppInfo.new_from_filename(entry.path);

            if (!dapp) {
                log.error(`could not find desktop entry for ${entry.path}`);
                return;
            }

            this.launch_desktop_app(dapp, entry.path);
            return;
        }

        const info = app.get_app_info();

        if (!info) {
            log.error(`cannot find app info for ${desktop_entry_id}`);
            return;
        }

        try {
            app.launch(0, -1, gpuPref);
        } catch (why) {
            log.error(`failed to launch application: ${why}`);
            return;
        }

        if (info.get_executable() === 'gnome-control-center') {
            app = app_sys.lookup_app('gnome-control-center.desktop');

            if (!app) return;

            app.activate();

            const window: Meta.Window = app.get_windows()[0];

            if (window) {
                window
                    .get_workspace()
                    .activate_with_focus(window, global.get_current_time());
                return;
            }
        }
    }

    list_workspace(ext: Ext) {
        for (const window of ext.tab_list(Meta.TabList.NORMAL, null)) {
            this.windows.insert(window);
        }
    }

    load_desktop_files() {
        log.warn(
            'gnome-mosaic: deprecated function called (launcher::load_desktop_files)'
        );
    }

    locate_by_app_info(info: any): null | ShellWindow {
        const workspace = this.ext.active_workspace();
        const exec_info: null | string = info.get_string('Exec');
        const exec = exec_info?.split(' ').shift()?.split('/').pop();
        if (exec) {
            for (const window of this.ext.tab_list(Meta.TabList.NORMAL, null)) {
                if (window.meta.get_workspace().index() !== workspace) continue;

                const pid = window.meta.get_pid();
                if (pid !== -1) {
                    try {
                        let f = Gio.File.new_for_path(`/proc/${pid}/cmdline`);
                        const [, bytes] = f.load_contents(null);
                        const output: string =
                            imports.byteArray.toString(bytes);
                        const cmd = output.split(' ').shift()?.split('/').pop();
                        if (cmd === exec) return window;
                    } catch (_) {}
                }
            }
        }

        return null;
    }

    open(ext: Ext) {
        ext.tiler.exit(ext);

        // Do not allow opening twice
        if (this.opened) return;

        // Do not activate if the focused window is fullscreen
        if (
            !ext.settings.fullscreen_launcher() &&
            ext.focus_window()?.meta.is_fullscreen()
        )
            return;

        this.opened = true;

        const active_monitor = ext.active_monitor();
        const mon_work_area = ext.monitor_work_area(active_monitor);
        const mon_area = ext.monitor_area(active_monitor);
        const mon_width = mon_area ? mon_area.width : mon_work_area.width;

        super._open(global.get_current_time(), false);

        if (!this.dialog.visible) {
            this.clear();
            this.cancel();
            this.close();
            return;
        }

        super.cleanup();
        this.start_services();
        this.search('');

        this.dialog.dialogLayout.x =
            mon_width / 2 - this.dialog.dialogLayout.width / 2;

        let height =
            mon_work_area.height >= 900
                ? mon_work_area.height / 2
                : mon_work_area.height / 3.5;
        this.dialog.dialogLayout.y =
            height - this.dialog.dialogLayout.height / 2;
    }

    start_services() {
        if (this.service === null) {
            log.debug('starting mosaic-launcher service');
            const ipc = utils.async_process_ipc(['mosaic-launcher']);
            this.service = ipc
                ? new service.LauncherService(ipc, resp =>
                      this.on_response(resp)
                  )
                : null;
        }
    }

    stop_services(_ext: Ext) {
        if (this.service !== null) {
            log.info(`stopping mosaic-launcher services`);
            this.service.exit();
            this.service = null;
        }
    }
}
