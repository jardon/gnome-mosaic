import * as lib from './lib.js';
import * as log from './log.js';
import * as once_cell from './once_cell.js';
import * as Rect from './rectangle.js';
import * as Tags from './tags.js';
import * as utils from './utils.js';
import * as xprop from './xprop.js';
import type {Entity} from './ecs.js';
import type {Ext} from './extension.js';
import type {Rectangle} from './rectangle.js';
import * as focus from './focus.js';

import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Mtk from 'gi://Mtk';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';

const {OnceCell} = once_cell;

export var window_tracker = Shell.WindowTracker.get_default();

/** Contains SourceID of an active hint operation. */
let ACTIVE_HINT_SHOW_ID: number | null = null;

const WM_TITLE_BLACKLIST: Array<string> = [
    'Firefox',
    'Nightly', // Firefox Nightly
    'Tor Browser',
];

const [major] = Config.PACKAGE_VERSION.split('.').map((s: string) => Number(s));

interface X11Info {
    normal_hints: once_cell.OnceCell<lib.SizeHint | null>;
    wm_role_: once_cell.OnceCell<string | null>;
    xid_: once_cell.OnceCell<string | null>;
}

export class ShellWindow {
    entity: Entity;
    meta: Meta.Window;
    ext: Ext;
    known_workspace: number;
    grab: boolean = false;
    activate_after_move: boolean = false;
    ignore_detach: boolean = false;
    was_attached_to?: [Entity, boolean | number];
    destroying: boolean = false;

    // Awaiting reassignment after a display update
    reassignment: boolean = false;

    // True if this window is currently smart-gapped
    smart_gapped: boolean = false;

    border: null | St.Bin = new St.Bin({
        style_class: 'gnome-mosaic-active-hint gnome-mosaic-border-normal',
    });

    prev_rect: null | Rectangular = null;

    window_app: any;

    private was_hidden: boolean = false;

    private extra: X11Info = {
        normal_hints: new OnceCell(),
        wm_role_: new OnceCell(),
        xid_: new OnceCell(),
    };

    private border_size = 0;

    constructor(
        entity: Entity,
        window: Meta.Window,
        window_app: any,
        ext: Ext
    ) {
        this.window_app = window_app;

        this.entity = entity;
        this.meta = window;
        this.ext = ext;

        this.known_workspace = this.workspace_id();

        // Float fullscreen windows by default, such as Kodi.
        if (this.meta.is_fullscreen()) {
            ext.add_tag(entity, Tags.Floating);
        }

        if (this.may_decorate()) {
            if (!this.is_client_decorated()) {
                if (ext.settings.show_title()) {
                    this.decoration_show(ext);
                } else {
                    this.decoration_hide(ext);
                }
            }
        }

        this.bind_window_events();
        this.bind_hint_events();

        if (this.border) global.window_group.add_child(this.border);

        this.hide_border();
        this.update_border_layout();

        if (this.meta.get_compositor_private()?.get_stage())
            this.on_style_changed();
    }

    activate(move_mouse: boolean = true): void {
        activate(this.ext, move_mouse, this.meta);
    }

    actor_exists(): boolean {
        return !this.destroying && this.meta.get_compositor_private() !== null;
    }

    private bind_window_events() {
        this.ext.window_signals
            .get_or(this.entity, () => new Array())
            .push(
                this.meta.connect('size-changed', () => {
                    this.window_changed();
                }),
                this.meta.connect('position-changed', () => {
                    this.window_changed();
                }),
                this.meta.connect('workspace-changed', () => {
                    this.workspace_changed();
                }),
                this.meta.connect('notify::wm-class', () => {
                    this.wm_class_changed();
                }),
                this.meta.connect('raised', () => {
                    this.window_raised();
                })
            );
    }

    private bind_hint_events() {
        if (!this.border) return;

        let settings = this.ext.settings;
        let change_id = settings.ext.connect('changed', () => {
            return false;
        });

        this.border.connect('destroy', () => {
            settings.ext.disconnect(change_id);
        });
        this.border.connect('style-changed', () => {
            this.on_style_changed();
        });
    }

    cmdline(): string | null {
        let pid = this.meta.get_pid(),
            out = null;
        if (-1 === pid) return out;

        const path = '/proc/' + pid + '/cmdline';
        if (!utils.exists(path)) return out;

        const result = utils.read_to_string(path);
        if (result.kind == 1) {
            out = result.value.trim();
        } else {
            log.error(`failed to fetch cmdline: ${result.value.format()}`);
        }

        return out;
    }

    private decoration(_ext: Ext, callback: (xid: string) => void): void {
        if (this.may_decorate()) {
            const xid = this.xid();
            if (xid) callback(xid);
        }
    }

    decoration_hide(ext: Ext): void {
        if (this.ignore_decoration()) return;

        this.was_hidden = true;

        this.decoration(ext, xid =>
            xprop.set_hint(xid, xprop.MOTIF_HINTS, xprop.HIDE_FLAGS)
        );
    }

    decoration_show(ext: Ext): void {
        if (!this.was_hidden) return;

        this.decoration(ext, xid =>
            xprop.set_hint(xid, xprop.MOTIF_HINTS, xprop.SHOW_FLAGS)
        );
    }

    icon(_ext: Ext, size: number): any {
        let icon = this.window_app.create_icon_texture(size);

        if (!icon) {
            icon = new St.Icon({
                icon_name: 'applications-other',
                icon_type: St.IconType.FULLCOLOR,
                icon_size: size,
            });
        }

        return icon;
    }

    ignore_decoration(): boolean {
        const name = this.meta.get_wm_class();
        if (name === null) return true;
        return WM_TITLE_BLACKLIST.findIndex(n => name.startsWith(n)) !== -1;
    }

    is_client_decorated(): boolean {
        // look I guess I'll hack something together in here if at all possible
        // Because Meta.Window.is_client_decorated() was removed in Meta 15, using it breaks the extension in gnome 47 or higher
        //return this.meta.window_type == Meta.WindowType.META_WINDOW_OVERRIDE_OTHER;
        const xid = this.xid();
        const extents = xid ? xprop.get_frame_extents(xid) : false;
        if (!extents) return false;
        return true;
    }

    is_maximized(): boolean {
        return this.meta.get_maximized() !== 0;
    }

    /**
     * Window is maximized, 0 gapped or smart gapped
     */
    is_max_screen(): boolean {
        // log.debug(`title: ${this.meta.get_title()}`);
        // log.debug(`max: ${this.is_maximized()}, 0-gap: ${this.ext.settings.gap_inner() === 0}, smart: ${this.smart_gapped}`);
        return (
            this.is_maximized() ||
            this.ext.settings.gap_inner() === 0 ||
            this.smart_gapped
        );
    }

    is_single_max_screen(): boolean {
        const display = this.meta.get_display();

        if (display) {
            let monitor_count = display.get_n_monitors();
            return (
                (this.is_maximized() || this.smart_gapped) && monitor_count == 1
            );
        }

        return false;
    }

    is_snap_edge(): boolean {
        return this.meta.get_maximized() == Meta.MaximizeFlags.VERTICAL;
    }

    is_tilable(ext: Ext): boolean {
        let tile_checks = () => {
            let wm_class = this.meta.get_wm_class();

            if (wm_class !== null && wm_class.trim().length === 0) {
                wm_class = this.name(ext);
            }

            const role = this.meta.get_role();

            // Quake-style terminals such as Tilix's quake mode.
            if (role === 'quake') return false;

            // Steam loading window is less than 400px wide and 200px tall
            if (this.meta.get_title() === 'Steam') {
                const rect = this.rect();

                const is_dialog = rect.width < 400 && rect.height < 200;
                const is_first_login =
                    rect.width === 432 && rect.height === 438;

                if (is_dialog || is_first_login) return false;
            }

            // Blacklist any windows that happen to leak through our filter
            // Windows that are tagged ForceTile are considered tilable despite exemption
            if (
                wm_class !== null &&
                ext.conf.window_shall_float(wm_class, this.title())
            ) {
                return ext.contains_tag(this.entity, Tags.ForceTile);
            }

            // Only normal windows will be considered for tiling
            return (
                this.meta.window_type == Meta.WindowType.NORMAL &&
                // Transient windows are most likely dialogs
                !this.is_transient() &&
                // If a window lacks a class, it's probably a web browser dialog
                wm_class !== null
            );
        };

        return !ext.contains_tag(this.entity, Tags.Floating) && tile_checks();
    }

    is_transient(): boolean {
        return this.meta.get_transient_for() !== null;
    }

    may_decorate(): boolean {
        const xid = this.xid();
        return xid ? xprop.may_decorate(xid) : false;
    }

    move(ext: Ext, rect: Rectangular, on_complete?: () => void) {
        if (!this.same_workspace() && this.is_maximized()) {
            return;
        }

        this.hide_border();

        const max_width = ext.settings.max_window_width();
        if (max_width > 0 && rect.width > max_width) {
            rect.x += (rect.width - max_width) / 2;
            rect.width = max_width;
        }

        const clone = Rect.Rectangle.from_meta(rect);
        const meta = this.meta;
        const actor = meta.get_compositor_private();

        if (actor) {
            meta.unmaximize(Meta.MaximizeFlags.HORIZONTAL);
            meta.unmaximize(Meta.MaximizeFlags.VERTICAL);
            meta.unmaximize(
                Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL
            );
            actor.remove_all_transitions();

            ext.movements.insert(this.entity, clone);

            ext.register({tag: 2, window: this, kind: {tag: 1}});
            if (on_complete) ext.register_fn(on_complete);
            if (meta.appears_focused) {
                this.update_border_layout();
                ext.show_border_on_focused();
            }
        }
    }

    name(ext: Ext): string {
        return ext.names.get_or(this.entity, () => 'unknown');
    }

    private on_style_changed() {
        if (!this.border) return;
        this.border_size = this.border
            .get_theme_node()
            .get_border_width(St.Side.TOP);
    }

    rect(): Rectangle {
        return Rect.Rectangle.from_meta(this.meta.get_frame_rect());
    }

    size_hint(): lib.SizeHint | null {
        return this.extra.normal_hints.get_or_init(() => {
            const xid = this.xid();
            return xid ? xprop.get_size_hints(xid) : null;
        });
    }

    swap(ext: Ext, other: ShellWindow): void {
        let ar = this.rect().clone();
        let br = other.rect().clone();

        other.move(ext, ar);
        this.move(ext, br, () => place_pointer_on(this.ext, this.meta));
    }

    title(): string {
        const title = this.meta.get_title();
        return title ? title : this.name(this.ext);
    }

    wm_role(): string | null {
        return this.extra.wm_role_.get_or_init(() => {
            const xid = this.xid();
            return xid ? xprop.get_window_role(xid) : null;
        });
    }

    workspace_id(): number {
        const workspace = this.meta.get_workspace();
        if (workspace) {
            return workspace.index();
        } else {
            this.meta.change_workspace_by_index(0, false);
            return 0;
        }
    }

    xid(): string | null {
        return this.extra.xid_.get_or_init(() => {
            if (utils.is_wayland()) return null;
            return xprop.get_xid(this.meta);
        });
    }

    show_border() {
        if (!this.border) return;

        this.update_border_style();
        if (this.ext.settings.active_hint()) {
            const border = this.border;

            const permitted = () => {
                return (
                    this.actor_exists() &&
                    this.ext.focus_window() == this &&
                    !this.meta.is_fullscreen() &&
                    (!this.is_single_max_screen() || this.is_snap_edge()) &&
                    !this.meta.minimized
                );
            };

            if (permitted()) {
                if (this.meta.appears_focused) {
                    border.show();

                    // Focus will be re-applied to fix windows moving across workspaces
                    let applications = 0;

                    // Ensure that the border is shown
                    if (ACTIVE_HINT_SHOW_ID !== null)
                        GLib.source_remove(ACTIVE_HINT_SHOW_ID);
                    ACTIVE_HINT_SHOW_ID = GLib.timeout_add(
                        GLib.PRIORITY_DEFAULT,
                        600,
                        () => {
                            if (
                                (applications > 4 && !this.same_workspace()) ||
                                !permitted()
                            ) {
                                ACTIVE_HINT_SHOW_ID = null;
                                return GLib.SOURCE_REMOVE;
                            }

                            applications += 1;
                            border.show();
                            return GLib.SOURCE_CONTINUE;
                        }
                    );
                }
            }
        }
    }

    same_workspace() {
        const workspace = this.meta.get_workspace();
        if (workspace) {
            let workspace_id = workspace.index();
            return (
                workspace_id ===
                global.workspace_manager.get_active_workspace_index()
            );
        }
        return false;
    }

    same_monitor() {
        return this.meta.get_monitor() === global.display.get_current_monitor();
    }

    get always_top_windows(): Clutter.Actor[] {
        let above_windows: Clutter.Actor[] = new Array();

        for (const actor of global.get_window_actors()) {
            if (
                actor &&
                actor.get_meta_window() &&
                actor.get_meta_window().is_above()
            )
                above_windows.push(actor);
        }

        return above_windows;
    }

    hide_border() {
        let b = this.border;
        if (b) b.hide();
    }

    update_border_layout() {
        let {x, y, width, height} = this.meta.get_frame_rect();

        const border = this.border;
        let borderSize = this.border_size;

        if (border) {
            if (!(this.is_max_screen() || this.is_snap_edge())) {
                border.remove_style_class_name('gnome-mosaic-border-maximize');
            } else {
                borderSize = 0;
                border.add_style_class_name('gnome-mosaic-border-maximize');
            }

            let dimensions = [
                x - borderSize,
                y - borderSize,
                width + 2 * borderSize,
                height + 2 * borderSize,
            ];

            if (dimensions) {
                [x, y, width, height] = dimensions;

                const workspace = this.meta.get_workspace();

                if (workspace === null) return;

                const screen = workspace.get_work_area_for_monitor(
                    this.meta.get_monitor()
                );

                if (screen) {
                    width = Math.min(width, screen.x + screen.width);
                    height = Math.min(height, screen.y + screen.height);
                }

                border.set_position(x, y);
                border.set_size(width, height);
            }
        }
    }

    async update_border_style() {
        const {settings} = this.ext;
        const radii = await getBorderRadii(
            this.meta.get_compositor_private() as Meta.WindowActor
        );
        const radii_values =
            radii?.map(v => `${v}px`).join(' ') || '0px 0px 0px 0px';
        if (this.border) {
            this.border.set_style(
                `border-radius: ${radii_values};` +
                    `border-width: ${settings.active_hint_border_width()}px;` +
                    `border-color: ${major > 46 ? '-st-accent-color' : settings.gnome_legacy_accent_color()}`
            );
        }
    }

    private wm_class_changed() {
        if (this.is_tilable(this.ext)) {
            this.ext.connect_window(this);
            if (!this.meta.minimized) {
                this.ext.auto_tiler?.auto_tile(this.ext, this, this.ext.init);
            }
        }
    }

    private window_changed() {
        this.update_border_layout();
        this.ext.show_border_on_focused();
    }

    private window_raised() {
        this.ext.show_border_on_focused();
    }

    private workspace_changed() {}
}

/// Activates a window, and moves the mouse point.
export function activate(ext: Ext, move_mouse: boolean, win: Meta.Window) {
    try {
        // Return if window was destroyed.
        if (!win.get_compositor_private()) return;

        // Return if window is being destroyed.
        if (ext.get_window(win)?.destroying) return;

        // Return if window has override-redirect set.
        if (win.is_override_redirect()) return;

        const workspace = win.get_workspace();
        if (!workspace) return;

        win.unminimize();
        workspace.activate_with_focus(win, global.get_current_time());
        win.raise();

        const pointer_placement_permitted =
            move_mouse &&
            Main.modalCount === 0 &&
            ext.settings.mouse_cursor_follows_active_window() &&
            !pointer_already_on_window(win) &&
            pointer_in_work_area();

        if (pointer_placement_permitted) {
            place_pointer_on(ext, win);
        }
    } catch (error) {
        log.error(`failed to activate window: ${error}`);
    }
}

function pointer_in_work_area(): boolean {
    const cursor = lib.cursor_rect();
    const indice = global.display.get_current_monitor();
    const mon = global.display
        .get_workspace_manager()
        .get_active_workspace()
        .get_work_area_for_monitor(indice);

    return mon ? cursor.intersects(mon) : false;
}

function place_pointer_on(ext: Ext, win: Meta.Window) {
    const rect = win.get_frame_rect();
    let x = rect.x;
    let y = rect.y;

    let key = Object.keys(focus.FocusPosition)[
        ext.settings.mouse_cursor_focus_location()
    ];
    let pointer_position_ =
        focus.FocusPosition[key as keyof typeof focus.FocusPosition];

    switch (pointer_position_) {
        case focus.FocusPosition.TopLeft:
            x += 8;
            y += 8;
            break;
        case focus.FocusPosition.BottomLeft:
            x += 8;
            y += rect.height - 16;
            break;
        case focus.FocusPosition.TopRight:
            x += rect.width - 16;
            y += 8;
            break;
        case focus.FocusPosition.BottomRight:
            x += rect.width - 16;
            y += rect.height - 16;
            break;
        default:
            x += 8;
            y += 8;
    }

    global.stage
        .get_context()
        .get_backend()
        .get_default_seat()
        .warp_pointer(x, y);
}

function pointer_already_on_window(meta: Meta.Window): boolean {
    const cursor = lib.cursor_rect();

    return cursor.intersects(meta.get_frame_rect());
}

async function getBorderRadii(
    actor: Meta.WindowActor
): Promise<[number, number, number, number] | undefined> {
    const opaqueLimit = 200;
    const margin = 6;
    const {x, y, width, height} = actor.get_meta_window().get_frame_rect();
    const monitorIndex = actor.get_meta_window().get_monitor();
    // @ts-expect-error
    const scale = Math.ceil(global.display.get_monitor_scale(monitorIndex));


    if (height <= 0) return;

    const capture = (actor as any).paint_to_content(
        new Mtk.Rectangle({x, y, width, height})
    );
    if (!capture) return;

    const memoryBuffer = Gio.MemoryOutputStream.new_resizable();
    const surface = capture.get_texture();

    const imageBuf = await Shell.Screenshot.composite_to_stream(
        surface,
        0,
        0,
        width * scale,
        height * scale,
        1,
        null,
        0,
        0,
        1,
        memoryBuffer
    );

    const rawPixels = imageBuf.get_pixels();
    if (!rawPixels) return;

    memoryBuffer.close(null);


    log.info(`WH: ${width} ${height}`)

    const scanAlpha = (start: number): number => {
        for (let x = 0; x < ((width * scale) / 2); x++) {
            const idx = (start * (width * scale) + x) * 4;
            const alpha = rawPixels[idx + 3];
            if (alpha > opaqueLimit) {
                return x;
            }
        }
        return 0;
    };

    const alphaTop = scanAlpha(0) || scanAlpha(1) || scanAlpha(2)
    const alphaBottom = scanAlpha(height * scale - 1) || scanAlpha(height * scale - 2) || scanAlpha(height * scale - 3)

    const radiusTop = (alphaTop / scale) + margin;
    const radiusBottom = (alphaBottom / scale) + margin;

    log.info(`RADIUS: ${radiusTop} ${radiusBottom}`)
    log.info(`SCALE: ${scale}`)

    return [radiusTop, radiusTop, radiusBottom, radiusBottom];
}
