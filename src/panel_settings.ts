import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {
    PopupMenuItem,
    PopupSeparatorMenuItem,
    PopupSwitchMenuItem,
} from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {get_current_path} from './paths.js';
import type {Ext} from './extension.js';

const MosaicIndicator = GObject.registerClass(
    class MosaicIndicator extends QuickSettings.SystemIndicator {
        _toggle: QuickSettings.QuickMenuToggle;
        _icon_auto_on: any;
        _icon_auto_off: any;

        _indicator: any;

        constructor(ext: Ext) {
            super();

            this._indicator = (this as any)._addIndicator();

            const path = get_current_path();
            const file_on = Gio.File.new_for_path(
                `${path}/icons/gnome-mosaic-auto-on-symbolic.svg`
            );
            this._icon_auto_on = new Gio.FileIcon({file: file_on});

            const file_off = Gio.File.new_for_path(
                `${path}/icons/gnome-mosaic-auto-off-symbolic.svg`
            );
            this._icon_auto_off = new Gio.FileIcon({file: file_off});

            this._toggle = new QuickSettings.QuickMenuToggle({
                title: 'Mosaic',
                toggleMode: true,
                iconName: 'view-grid-symbolic',
            });

            this._toggle.gicon = this._icon_auto_off;

            this._toggle.connect('clicked', () => {
                ext.toggle_tiling();
            });

            this._toggle.menu.setHeader(
                'view-grid-symbolic',
                'Mosaic',
                'Tiled window management'
            );

            this._toggle.menu.addMenuItem(this._createSmartGapsSwitch(ext));
            this._toggle.menu.addMenuItem(this._createActiveHintSwitch(ext));
            this._toggle.menu.addMenuItem(this._createMouseFollowsSwitch(ext));

            this._toggle.menu.addMenuItem(new PopupSeparatorMenuItem());
            this._toggle.menu.addMenuItem(this._createExceptionsItem(ext));

            this._toggle.menu.addMenuItem(new PopupSeparatorMenuItem());
            this._toggle.menu.addMenuItem(this._createSettingsItem(ext));

            this.quickSettingsItems.push(this._toggle);

            Main.panel.statusArea.quickSettings.addExternalIndicator(this);
        }

        set_active(active: boolean) {
            this._toggle.set({checked: active});
            this._toggle.gicon = active
                ? this._icon_auto_on
                : this._icon_auto_off;

            // Update system indicator icon
            this._indicator.gicon = active ? this._icon_auto_on : null;
            this._indicator.visible = active;
        }

        _createSmartGapsSwitch(ext: Ext) {
            const item = new PopupSwitchMenuItem(
                'Smart Gaps',
                ext.settings.smart_gaps()
            );
            item.connect('toggled', (_: any, state: boolean) => {
                ext.settings.set_smart_gaps(state);
            });
            return item;
        }

        _createActiveHintSwitch(ext: Ext) {
            const item = new PopupSwitchMenuItem(
                'Show Active Hint',
                ext.settings.active_hint()
            );
            item.connect('toggled', (_: any, state: boolean) => {
                ext.settings.set_active_hint(state);
            });
            return item;
        }

        _createMouseFollowsSwitch(ext: Ext) {
            const item = new PopupSwitchMenuItem(
                'Move Pointer With Focus',
                ext.settings.mouse_cursor_follows_active_window()
            );
            item.connect('toggled', (_: any, state: boolean) => {
                ext.settings.set_mouse_cursor_follows_active_window(state);
            });
            return item;
        }

        _createExceptionsItem(ext: Ext) {
            const item = new PopupMenuItem('Floating Window Exceptions');
            item.connect('activate', () => {
                ext.exception_dialog();
            });
            return item;
        }

        _createSettingsItem(ext: Ext) {
            const item = new PopupMenuItem('Settings');
            item.connect('activate', () => {
                ext.open_settings();
            });
            return item;
        }

        destroy() {
            this._toggle.destroy();
            super.destroy();
        }
    }
);

export {MosaicIndicator};
