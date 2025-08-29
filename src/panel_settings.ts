import * as Utils from './utils.js';

import type {Ext} from './extension.js';

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import St from 'gi://St';

import {
    PopupBaseMenuItem,
    PopupMenuItem,
    PopupSwitchMenuItem,
    PopupSeparatorMenuItem,
} from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Button} from 'resource:///org/gnome/shell/ui/panelMenu.js';
import GLib from 'gi://GLib';
import {get_current_path} from './paths.js';
// import * as Settings from './settings.js';

export class Indicator {
    button: any;
    appearances: any;
    menu_timeout: null | SignalID = null;

    toggle_tiled: any;
    toggle_titles: null | any;
    toggle_active: any;
    border_radius: any;

    constructor(ext: Ext) {
        this.button = new Button(0.0, _('GNOME Mosaic Settings'));

        const path = get_current_path();
        ext.button = this.button;
        ext.button_gio_icon_auto_on = Gio.icon_new_for_string(
            `${path}/icons/gnome-mosaic-auto-on-symbolic.svg`
        );
        ext.button_gio_icon_auto_off = Gio.icon_new_for_string(
            `${path}/icons/gnome-mosaic-auto-off-symbolic.svg`
        );

        let button_icon_auto_on = new St.Icon({
            gicon: ext.button_gio_icon_auto_on,
            style_class: 'system-status-icon',
        });
        let button_icon_auto_off = new St.Icon({
            gicon: ext.button_gio_icon_auto_off,
            style_class: 'system-status-icon',
        });

        if (ext.settings.tile_by_default()) {
            this.button.icon = button_icon_auto_on;
        } else {
            this.button.icon = button_icon_auto_off;
        }

        this.button.add_child(this.button.icon);

        let bm = this.button.menu;

        this.toggle_tiled = tiled(ext);

        this.toggle_active = toggle(
            _('Show Active Hint'),
            ext.settings.active_hint(),
            toggle => {
                ext.settings.set_active_hint(toggle.state);
            }
        );

        bm.addMenuItem(this.toggle_tiled);
        bm.addMenuItem(this.system_exceptions_menu(ext, bm));

        bm.addMenuItem(menu_separator(''));
        bm.addMenuItem(shortcuts(bm));
        bm.addMenuItem(settings_button(bm));
        bm.addMenuItem(menu_separator(''));

        if (!Utils.is_wayland()) {
            this.toggle_titles = show_title(ext);
            bm.addMenuItem(this.toggle_titles);
        }

        bm.addMenuItem(this.toggle_active);
    }

    system_exceptions_menu(ext: Ext, menu: any): any {
        let label = new St.Label({text: 'Floating Window Exceptions'});
        label.set_x_expand(true);

        let icon = new St.Icon({icon_name: 'go-next-symbolic', icon_size: 16});

        let widget = new St.BoxLayout({vertical: false});
        widget.add_child(label);
        widget.add_child(icon);
        widget.set_x_expand(true);

        let base = new PopupBaseMenuItem();
        base.add_child(widget);
        base.connect('activate', () => {
            ext.exception_dialog();

            if (this.menu_timeout) {
                GLib.source_remove(this.menu_timeout);
                this.menu_timeout = null;
            }
            this.menu_timeout = GLib.timeout_add(GLib.PRIORITY_LOW, 300, () => {
                menu.close();
                return false;
            });
        });

        return base;
    }

    timeouts_remove() {
        if (this.menu_timeout) {
            GLib.source_remove(this.menu_timeout);
            this.menu_timeout = null;
        }
    }

    destroy() {
        this.button.destroy();
    }
}

function menu_separator(text: any): any {
    return new PopupSeparatorMenuItem(text);
}

function settings_button(menu: any): any {
    let item = new PopupMenuItem(_('View All'));
    item.connect('activate', () => {
        Gio.AppInfo.launch_default_for_uri(
            'https://github.com/jardon/gnome-mosaic/blob/main/SHORTCUTS.md',
            null
        );

        menu.close();
    });

    item.label.get_clutter_text().set_margin_left(12);

    return item;
}

function shortcuts(menu: any): any {
    let layout_manager = new Clutter.GridLayout({
        orientation: Clutter.Orientation.HORIZONTAL,
    });
    let widget = new St.Widget({layout_manager, x_expand: true});

    let item = new PopupBaseMenuItem();
    item.add_child(widget);
    item.connect('activate', () => {
        Gio.AppInfo.launch_default_for_uri(
            'https://github.com/jardon/gnome-mosaic/blob/main/SHORTCUTS.md',
            null
        );

        menu.close();
    });

    function create_label(text: string): any {
        return new St.Label({text});
    }

    function create_shortcut_label(text: string): any {
        let label = create_label(text);
        label.set_x_align(Clutter.ActorAlign.END);
        return label;
    }

    layout_manager.set_row_spacing(12);
    layout_manager.set_column_spacing(30);
    layout_manager.attach(create_label(_('Shortcuts')), 0, 0, 2, 1);

    // const cosmic_settings = Settings.settings_new_id(
    //   'org.gnome.shell.extensions.pop-cosmic'
    // );
    // if (cosmic_settings) {
    //   if (cosmic_settings.get_enum('overlay-key-action') === 2) {
    //     launcher_shortcut = _('Super');
    //   }
    // }

    [
        [_('Navigate Windows'), _('Super + Arrow Keys')],
        [_('Toggle Tiling'), _('Super + Y')],
        [_('Resize Windows'), 'Super + R'],
    ].forEach((section, idx) => {
        let key = create_label(section[0]);
        key.get_clutter_text().set_margin_left(12);

        let val = create_shortcut_label(section[1]);

        layout_manager.attach(key, 0, idx + 1, 1, 1);
        layout_manager.attach(val, 1, idx + 1, 1, 1);
    });

    return item;
}

function show_title(ext: Ext): any {
    const t = toggle(
        _('Show Window Titles'),
        ext.settings.show_title(),
        (toggle: any) => {
            ext.settings.set_show_title(toggle.state);
        }
    );

    return t;
}

function toggle(
    desc: string,
    active: boolean,
    connect: (toggle: any, state: boolean) => void
): any {
    let toggle = new PopupSwitchMenuItem(desc, active);

    toggle.label.set_y_align(Clutter.ActorAlign.CENTER);

    toggle.connect('toggled', (_: any, state: boolean) => {
        connect(toggle, state);
        return true;
    });

    return toggle;
}

function tiled(ext: Ext): any {
    let t = toggle(
        _('Tile Windows'),
        null != ext.auto_tiler,
        (_, shouldTile) => {
            if (shouldTile) {
                ext.auto_tile_on();
            } else {
                ext.auto_tile_off();
            }
        }
    );
    return t;
}
