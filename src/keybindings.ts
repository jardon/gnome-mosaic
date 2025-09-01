import type {Ext} from './extension.js';

import {wm} from 'resource:///org/gnome/shell/ui/main.js';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import {Direction} from './tiling.js';

export class Keybindings {
    global: Object;
    window_focus: Object;
    tiler_bindings: Object;
    resize_bindings: Object;

    constructor(ext: Ext) {
        this.global = {
            'resize-mode': () => ext.tiler.resize_mode(),
            'tile-enter': () => ext.tiler.enter(),
            'resize-grow-left': () => ext.tiler.resize(Direction.Left, false),
            'resize-shrink-left': () => ext.tiler.resize(Direction.Right, true),
            'resize-grow-up': () => ext.tiler.resize(Direction.Up, false),
            'resize-shrink-up': () => ext.tiler.resize(Direction.Down, true),
            'resize-grow-right': () => ext.tiler.resize(Direction.Right, false),
            'resize-shrink-right': () => ext.tiler.resize(Direction.Left, true),
            'resize-grow-down': () => ext.tiler.resize(Direction.Down, false),
            'resize-shrink-down': () => ext.tiler.resize(Direction.Up, true),
        };

        this.window_focus = {
            'focus-left': () => ext.focus_left(),

            'focus-down': () => ext.focus_down(),

            'focus-up': () => ext.focus_up(),

            'focus-right': () => ext.focus_right(),

            'tile-orientation': () => {
                const win = ext.focus_window();
                if (win && ext.auto_tiler) {
                    ext.auto_tiler.toggle_orientation(ext, win);
                    ext.register_fn(() => win.activate(ext, true));
                }
            },

            'toggle-floating': () => ext.auto_tiler?.toggle_floating(ext),

            'toggle-tiling': () => ext.toggle_tiling(),

            'tile-move-left-global': () =>
                ext.tiler.move_left(ext.focus_window()?.entity),

            'tile-move-down-global': () =>
                ext.tiler.move_down(ext.focus_window()?.entity),

            'tile-move-up-global': () =>
                ext.tiler.move_up(ext.focus_window()?.entity),

            'tile-move-right-global': () =>
                ext.tiler.move_right(ext.focus_window()?.entity),

            'mosaic-monitor-left': () =>
                ext.move_monitor(Meta.DisplayDirection.LEFT),

            'mosaic-monitor-right': () =>
                ext.move_monitor(Meta.DisplayDirection.RIGHT),

            'mosaic-monitor-up': () =>
                ext.move_monitor(Meta.DisplayDirection.UP),

            'mosaic-monitor-down': () =>
                ext.move_monitor(Meta.DisplayDirection.DOWN),

            'mosaic-workspace-up': () =>
                ext.move_workspace(Meta.DisplayDirection.UP),

            'mosaic-workspace-down': () =>
                ext.move_workspace(Meta.DisplayDirection.DOWN),
        };

        this.tiler_bindings = {
            'management-orientation': () => ext.tiler.toggle_orientation(),
            'tile-move-left': () => ext.tiler.move_left(),
            'tile-move-down': () => ext.tiler.move_down(),
            'tile-move-up': () => ext.tiler.move_up(),
            'tile-move-right': () => ext.tiler.move_right(),
            'tile-swap-left': () => ext.tiler.swap_left(),
            'tile-swap-down': () => ext.tiler.swap_down(),
            'tile-swap-up': () => ext.tiler.swap_up(),
            'tile-swap-right': () => ext.tiler.swap_right(),
            'tile-accept': () => ext.tiler.accept(),
            'tile-reject': () => ext.tiler.exit(),
        };

        this.resize_bindings = {
            'tile-accept': () => ext.tiler.exit(),
            'tile-reject': () => ext.tiler.exit(),
        };
    }

    enable(ext: Ext, keybindings: any) {
        for (const name in keybindings) {
            wm.addKeybinding(
                name,
                ext.settings.ext,
                Meta.KeyBindingFlags.NONE,
                Shell.ActionMode.NORMAL,
                keybindings[name]
            );
        }

        return this;
    }

    disable(keybindings: Object) {
        for (const name in keybindings) {
            wm.removeKeybinding(name);
        }

        return this;
    }
}
