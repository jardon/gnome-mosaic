import * as Lib from './lib.js';
import * as Log from './log.js';
import * as Rect from './rectangle.js';
import * as Tags from './tags.js';
import * as window from './window.js';
import * as geom from './geom.js';
import * as exec from './executor.js';
import * as movement from './movement.js';
import * as utils from './utils.js';

import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import type {Entity} from './ecs.js';
import type {Rectangle} from './rectangle.js';
import type {Ext} from './extension.js';
import {Fork} from './fork.js';

import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
const {layoutManager} = Main;
const {ShellWindow} = window;

export enum Direction {
    Left,
    Up,
    Right,
    Down,
}

const ICON_LEFT_ARROW: string = 'go-previous-symbolic';
const ICON_RIGHT_ARROW: string = 'go-next-symbolic';
const ICON_UP_ARROW: string = 'go-up-symbolic';
const ICON_DOWN_ARROW: string = 'go-down-symbolic';

export class Tiler {
    private ext: Ext;
    private resize_grab: any = null;
    private resize_keymon: null | number = null;
    private resize_keymon_release: null | number = null;

    private resize_hint: St.Widget = new St.BoxLayout({
        vertical: true,
    });

    private resize_up: St.Icon = new St.Icon({
        icon_name: ICON_UP_ARROW,
        icon_size: 32,
        x_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
        style_class: 'gnome-mosaic-resize-hint',
        visible: false,
    });

    private resize_left: St.Icon = new St.Icon({
        icon_name: ICON_LEFT_ARROW,
        icon_size: 32,
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'gnome-mosaic-resize-hint',
        visible: false,
    });

    private resize_right: St.Icon = new St.Icon({
        icon_name: ICON_RIGHT_ARROW,
        icon_size: 32,
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'gnome-mosaic-resize-hint',
        visible: false,
    });

    private resize_down: St.Icon = new St.Icon({
        icon_name: ICON_DOWN_ARROW,
        icon_size: 32,
        x_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
        style_class: 'gnome-mosaic-resize-hint',
        visible: false,
    });

    window: Entity | null = null;

    moving: boolean = false;
    resizing_window: boolean = false;

    private swap_window: Entity | null = null;

    queue: exec.ChannelExecutor<() => void> = new exec.ChannelExecutor();

    constructor(ext: Ext) {
        this.ext = ext;
        this.resize_hint.visible = false;

        const top_box: St.Widget = new St.BoxLayout({
            style: 'padding: 12px;',
            y_align: Clutter.ActorAlign.START,
            y_expand: true,
        });

        top_box.add_child(this.resize_up);

        const bottom_box: St.Widget = new St.BoxLayout({
            style: 'padding: 12px;',
            y_align: Clutter.ActorAlign.END,
            y_expand: true,
        });

        bottom_box.add_child(this.resize_down);

        const left_box: St.Widget = new St.BoxLayout({
            style: 'padding: 12px;',
            x_align: Clutter.ActorAlign.START,
            x_expand: true,
        });

        left_box.add_child(this.resize_left);

        const right_box: St.Widget = new St.BoxLayout({
            style: 'padding: 12px;',
            x_align: Clutter.ActorAlign.END,
        });

        right_box.add_child(this.resize_right);

        const middle_arrows: St.Widget = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            y_expand: true,
        });

        middle_arrows.add_child(left_box);
        middle_arrows.add_child(right_box);

        this.resize_hint.add_child(top_box);
        this.resize_hint.add_child(middle_arrows);
        this.resize_hint.add_child(bottom_box);
        this.resize_hint.width = 128;
        this.resize_hint.height = 128;

        layoutManager.addChrome(this.resize_hint);
    }

    resize_mode() {
        let workspace = global.workspace_manager.get_active_workspace();
        let windows = workspace.list_windows();
        // @ts-ignore
        let visible = windows.filter(w => w.showing_on_its_workspace());

        if (visible.length === 1) return;
        if (!this.window) {
            const win = this.ext.focus_window();
            if (!win) return;

            if (this.resize_keymon !== null) {
                global.stage.disconnect(this.resize_keymon);
            }

            if (this.resize_keymon_release !== null) {
                global.stage.disconnect(this.resize_keymon_release);
            }

            this.resize_keymon = global.stage.connect(
                'key-press-event',
                (_: any, event: any) => {
                    const state: number = event.get_state();

                    switch (event.get_key_symbol()) {
                        case Clutter.KEY_Escape:
                        case Clutter.KEY_Return:
                            this.exit();
                            break;
                        case Clutter.KEY_Shift_L:
                        case Clutter.KEY_Shift_R:
                            this.reverse_arrows();
                            break;
                        case Clutter.KEY_Left:
                        case Clutter.KEY_H:
                        case Clutter.KEY_h:
                            this.resize(
                                Direction.Left,
                                state && Clutter.ModifierType.SHIFT_MASK
                            );
                            break;
                        case Clutter.KEY_Right:
                        case Clutter.KEY_L:
                        case Clutter.KEY_l:
                            this.resize(
                                Direction.Right,
                                state && Clutter.ModifierType.SHIFT_MASK
                            );
                            break;
                        case Clutter.KEY_Up:
                        case Clutter.KEY_K:
                        case Clutter.KEY_k:
                            this.resize(
                                Direction.Up,
                                state && Clutter.ModifierType.SHIFT_MASK
                            );
                            break;
                        case Clutter.KEY_Down:
                        case Clutter.KEY_J:
                        case Clutter.KEY_j:
                            this.resize(
                                Direction.Down,
                                state && Clutter.ModifierType.SHIFT_MASK
                            );
                            break;
                        default:
                            return Clutter.EVENT_PROPAGATE;
                    }
                }
            );

            this.resize_keymon_release = global.stage.connect(
                'key-release-event',
                (_: any, event: any) => {
                    switch (event.get_key_symbol()) {
                        case Clutter.KEY_Shift_L:
                        case Clutter.KEY_Shift_R:
                            this.reset_arrows();
                        default:
                            return Clutter.EVENT_PROPAGATE;
                    }
                }
            );

            this.resize_grab = Main.pushModal(global.stage);

            this.window = win.entity;

            this.ext.keybindings
                .disable(this.ext.keybindings.window_focus)
                .disable(this.ext.keybindings.tiler_bindings)
                .enable(this.ext.keybindings.resize_bindings);

            this.update_resize_position();

            const [major] = Config.PACKAGE_VERSION.split('.').map((s: string) =>
                Number(s)
            );

            var background: string;
            var color: string;

            if (major > 46) {
                background = '-st-accent-color';
                color = '-st-fg-accent-color';
            } else {
                background = this.ext.settings.gnome_legacy_accent_color();
                const background_rgba = utils.hex_to_rgba(background);
                color = utils.is_dark(background_rgba) ? 'white' : 'black';
            }

            const css = `background: ${background}; color: ${color}`;

            this.resize_up.set_style(css);
            this.resize_down.set_style(css);
            this.resize_left.set_style(css);
            this.resize_right.set_style(css);
        }
    }

    private reverse_arrows() {
        this.resize_up.icon_name = ICON_DOWN_ARROW;
        this.resize_down.icon_name = ICON_UP_ARROW;
        this.resize_left.icon_name = ICON_RIGHT_ARROW;
        this.resize_right.icon_name = ICON_LEFT_ARROW;
    }

    private reset_arrows() {
        this.resize_up.icon_name = ICON_UP_ARROW;
        this.resize_down.icon_name = ICON_DOWN_ARROW;
        this.resize_left.icon_name = ICON_LEFT_ARROW;
        this.resize_right.icon_name = ICON_RIGHT_ARROW;
    }

    toggle_orientation() {
        const window = this.ext.focus_window();
        if (window && this.ext.auto_tiler) {
            this.ext.auto_tiler.toggle_orientation(this.ext, window);
            this.ext.register_fn(() => window.activate(true));
        }
    }

    rect(monitor: Rectangle): Rectangle | null {
        if (!this.ext.overlay.visible) return null;

        const columns = Math.floor(monitor.width / this.ext.column_size);
        const rows = Math.floor(monitor.height / this.ext.row_size);

        return monitor_rect(monitor, columns, rows);
    }

    update_resize_position() {
        this.ext.register_fn(() => {
            if (this.window) {
                const window = this.ext.windows.get(this.window);
                if (window) {
                    const area = window.rect();
                    const work_area = this.ext.monitor_work_area(
                        window.meta.get_monitor()
                    );
                    this.resize_hint.visible = true;
                    this.resize_hint.x = area.x;
                    this.resize_hint.y = area.y;
                    this.resize_hint.width = area.width;
                    this.resize_hint.height = area.height;

                    let {x, y, width, height} = this.resize_hint;
                    const wy = work_area.y + this.ext.gap_outer;
                    const wx = work_area.x + this.ext.gap_outer;
                    const wh = work_area.height - this.ext.gap_outer * 2;
                    const ww = work_area.width - this.ext.gap_outer * 2;

                    this.resize_up.visible = y > wy;
                    this.resize_left.visible = x > wx;
                    this.resize_down.visible = y + height < wy + wh;
                    this.resize_right.visible = x + width < wx + ww;
                }
            }
        });
    }

    change(
        overlay: Rectangular,
        rect: Rectangle,
        dx: number,
        dy: number,
        dw: number,
        dh: number
    ): Tiler {
        let changed = new Rect.Rectangle([
            overlay.x + dx * rect.width,
            overlay.y + dy * rect.height,
            overlay.width + dw * rect.width,
            overlay.height + dh * rect.height,
        ]);

        // Align to grid
        changed.x =
            Lib.round_increment(changed.x - rect.x, rect.width) + rect.x;
        changed.y =
            Lib.round_increment(changed.y - rect.y, rect.height) + rect.y;
        changed.width = Lib.round_increment(changed.width, rect.width);
        changed.height = Lib.round_increment(changed.height, rect.height);

        // Ensure that width is not too small
        if (changed.width < rect.width) {
            changed.width = rect.width;
        }

        // Ensure that height is not too small
        if (changed.height < rect.height) {
            changed.height = rect.height;
        }

        // Check that corrected rectangle fits on monitors
        let monitors = tile_monitors(changed);

        // Do not use change if there are no matching displays
        if (monitors.length == 0) return this;

        let min_x: number | null = null;
        let min_y: number | null = null;
        let max_x: number | null = null;
        let max_y: number | null = null;

        for (const monitor of monitors) {
            if (min_x === null || monitor.x < min_x) {
                min_x = monitor.x;
            }
            if (min_y === null || monitor.y < min_y) {
                min_y = monitor.y;
            }
            if (max_x === null || monitor.x + monitor.width > max_x) {
                max_x = monitor.x + monitor.width;
            }
            if (max_y === null || monitor.y + monitor.height < max_y) {
                max_y = monitor.y + monitor.height;
            }
        }

        if (
            // Do not use change if maxima cannot be found
            min_x === null ||
            min_y === null ||
            max_x === null ||
            max_y === null ||
            // Prevent moving too far left
            changed.x < min_x ||
            // Prevent moving too far right
            changed.x + changed.width > max_x ||
            // Prevent moving too far up
            changed.y < min_y ||
            // Prevent moving too far down
            changed.y + changed.height > max_y
        )
            return this;

        overlay.x = changed.x;
        overlay.y = changed.y;
        overlay.width = changed.width;
        overlay.height = changed.height;

        return this;
    }

    move(
        window: Entity | null,
        x: number,
        y: number,
        w: number,
        h: number,
        focus: () => window.ShellWindow | number | null
    ) {
        if (!window) return;
        const win = this.ext.windows.get(window);
        if (!win) return;

        const place_pointer = () => {
            this.ext.register_fn(() => win.activate(true));
        };

        if (this.ext.auto_tiler && win.is_tilable(this.ext)) {
            if (this.queue.length === 2) return;
            this.queue.send(() => {
                const focused = this.ext.focus_window();
                if (focused) {
                    // The window that the focused window is being moved onto
                    const move_to = focus();

                    this.moving = true;

                    if (move_to !== null) this.move_auto(focused, move_to);
                    this.moving = false;
                    place_pointer();
                }
            });
        } else {
            this.swap_window = null;
            this.rect_by_active_area((_monitor, rect) => {
                this.change(this.ext.overlay, rect, x, y, w, h).change(
                    this.ext.overlay,
                    rect,
                    0,
                    0,
                    0,
                    0
                );
            });
        }
    }

    overlay_watch(window: window.ShellWindow) {
        this.ext.register_fn(() => {
            if (window) {
                this.ext.set_overlay(window);
                window.activate(false);
            }
        });
    }

    rect_by_active_area(
        callback: (monitor: Rectangle, area: Rectangle) => void
    ) {
        if (this.window) {
            const monitor_id = this.ext.monitors.get(this.window);
            if (monitor_id) {
                const monitor = this.ext.monitor_work_area(monitor_id[0]);
                let rect = this.rect(monitor);

                if (rect) {
                    callback(monitor, rect);
                }
            }
        }
    }

    move_auto(
        focused: window.ShellWindow,
        move_to: window.ShellWindow | number
    ) {
        let watching: null | window.ShellWindow = null;

        const at = this.ext.auto_tiler;
        if (at) {
            if (move_to instanceof ShellWindow) {
                const parent = at.windows_are_siblings(
                    focused.entity,
                    move_to.entity
                );
                if (parent) {
                    const fork = at.forest.forks.get(parent);
                    if (fork) {
                        if (!fork.right) {
                            Log.error(
                                'move_auto: detected as sibling, but fork lacks right branch'
                            );
                            return;
                        }

                        const temp = fork.right;

                        fork.right = fork.left;
                        fork.left = temp;

                        at.tile(this.ext, fork, fork.area);
                        watching = focused;
                    }
                }

                if (!watching) {
                    let movement = {src: focused.meta.get_frame_rect()};

                    focused.ignore_detach = true;
                    at.detach_window(this.ext, focused.entity);
                    at.attach_to_window(this.ext, move_to, focused, movement);
                    watching = focused;
                }
            } else {
                focused.ignore_detach = true;
                at.detach_window(this.ext, focused.entity);
                at.attach_to_workspace(this.ext, focused, [
                    move_to,
                    this.ext.active_workspace(),
                ]);
                watching = focused;
            }
        }

        if (watching) {
            this.overlay_watch(watching);
        } else {
            this.ext.set_overlay(focused);
        }
    }

    move_left(window?: Entity) {
        this.move(
            window ?? this.window,
            -1,
            0,
            0,
            0,
            move_window_or_monitor(
                this.ext,
                this.ext.focus_selector.left,
                Meta.DisplayDirection.LEFT
            )
        );
    }

    move_down(window?: Entity) {
        this.move(
            window ?? this.window,
            0,
            1,
            0,
            0,
            move_window_or_monitor(
                this.ext,
                this.ext.focus_selector.down,
                Meta.DisplayDirection.DOWN
            )
        );
    }

    move_up(window?: Entity) {
        this.move(
            window ?? this.window,
            0,
            -1,
            0,
            0,
            move_window_or_monitor(
                this.ext,
                this.ext.focus_selector.up,
                Meta.DisplayDirection.UP
            )
        );
    }

    move_right(window?: Entity) {
        this.move(
            window ?? this.window,
            1,
            0,
            0,
            0,
            move_window_or_monitor(
                this.ext,
                this.ext.focus_selector.right,
                Meta.DisplayDirection.RIGHT
            )
        );
    }

    resize(direction: Direction, inverse: boolean) {
        if (!this.window && !this.ext.focus_window()?.entity) return;

        const window = this.ext.windows.get(
            this.window || this.ext.focus_window()!.entity
        );
        if (!window) return;

        if (this.ext.auto_tiler) {
            const fork_entity = this.ext.auto_tiler.attached.get(window.entity);
            if (fork_entity) {
                const forest = this.ext.auto_tiler.forest;
                const fork = forest.forks.get(fork_entity);
                if (fork) {
                    let top_level = forest.find_toplevel(
                        this.ext.workspace_id()
                    );
                    if (top_level) {
                        const work_area = (forest.forks.get(top_level) as Fork)
                            .area;
                        const before = window.rect();

                        let [x, y, width, height] = before.array;

                        const step = 64;

                        const is_leftmost = x <= work_area.x;
                        const is_topmost = y <= work_area.y;
                        const is_rightmost =
                            x + width + step >= work_area.x + work_area.width;
                        const is_bottommost =
                            y + height + step >= work_area.y + work_area.height;

                        switch (direction) {
                            case Direction.Up:
                                if (!inverse) {
                                    if (is_topmost) return;
                                    y -= step;
                                    height += step;
                                } else {
                                    if (is_bottommost) return;
                                    height -= step;
                                }
                                break;
                            case Direction.Down:
                                if (!inverse) {
                                    if (is_bottommost) return;
                                    height += step;
                                } else {
                                    if (is_topmost) return;
                                    y += step;
                                    height -= step;
                                }
                                break;
                            case Direction.Left:
                                if (!inverse) {
                                    if (is_leftmost) return;
                                    x -= step;
                                    width += step;
                                } else {
                                    if (is_rightmost) return;
                                    width -= step;
                                }
                                break;
                            case Direction.Right:
                                if (!inverse) {
                                    if (is_rightmost) return;
                                    width += step;
                                } else {
                                    if (is_leftmost) return;
                                    x += step;
                                    width -= step;
                                }
                                break;
                        }

                        const after = new Rect.Rectangle([x, y, width, height]);

                        after.clamp(work_area);

                        const movements = movement.calculate(before, after);
                        window.meta.move_resize_frame(
                            true,
                            after.x,
                            after.y,
                            after.width,
                            after.height
                        );
                        if (this.ext.movements_are_valid(window, movements)) {
                            for (const movement of movements) {
                                forest.resize(
                                    this.ext,
                                    fork_entity,
                                    fork,
                                    window.entity,
                                    movement,
                                    after
                                );
                            }
                            forest.arrange(this.ext, fork.workspace);
                        } else {
                            forest.tile(this.ext, fork, fork.area);
                        }

                        this.update_resize_position();
                    }
                }
            }
        }
    }

    swap(selector: window.ShellWindow | null) {
        if (selector) {
            this.ext.set_overlay(selector);
            this.swap_window = selector.entity;
        }
    }

    swap_left() {
        if (this.swap_window) {
            this.ext.windows.with(this.swap_window, window => {
                this.swap(this.ext.focus_selector.left(this.ext, window));
            });
        } else {
            this.swap(this.ext.focus_selector.left(this.ext, null));
        }
    }

    swap_down() {
        if (this.swap_window) {
            this.ext.windows.with(this.swap_window, window => {
                this.swap(this.ext.focus_selector.down(this.ext, window));
            });
        } else {
            this.swap(this.ext.focus_selector.down(this.ext, null));
        }
    }

    swap_up() {
        if (this.swap_window) {
            this.ext.windows.with(this.swap_window, window => {
                this.swap(this.ext.focus_selector.up(this.ext, window));
            });
        } else {
            this.swap(this.ext.focus_selector.up(this.ext, null));
        }
    }

    swap_right() {
        if (this.swap_window) {
            this.ext.windows.with(this.swap_window, window => {
                this.swap(this.ext.focus_selector.right(this.ext, window));
            });
        } else {
            this.swap(this.ext.focus_selector.right(this.ext, null));
        }
    }

    enter() {
        if (!this.window) {
            const win = this.ext.focus_window();
            if (!win) return;

            this.window = win.entity;

            if (win.is_maximized()) {
                win.meta.unmaximize(Meta.MaximizeFlags.BOTH);
            }

            // Set overlay to match window
            this.ext.set_overlay(win);
            this.ext.overlay.visible = true;

            if (
                !this.ext.auto_tiler ||
                this.ext.contains_tag(win.entity, Tags.Floating)
            ) {
                // Make sure overlay is valid
                this.rect_by_active_area((_monitor, rect) => {
                    this.change(this.ext.overlay, rect, 0, 0, 0, 0);
                });
            }

            this.ext.keybindings
                .disable(this.ext.keybindings.window_focus)
                .enable(this.ext.keybindings.tiler_bindings);
        }
    }

    accept() {
        if (this.window) {
            const meta = this.ext.windows.get(this.window);
            if (meta) {
                let tree_swapped = false;

                if (this.swap_window) {
                    const meta_swap = this.ext.windows.get(this.swap_window);
                    if (meta_swap) {
                        if (this.ext.auto_tiler) {
                            tree_swapped = true;
                            this.ext.auto_tiler.attach_swap(
                                this.ext,
                                this.swap_window,
                                this.window
                            );
                        } else {
                            this.ext.size_signals_block(meta_swap);

                            meta_swap.move(this.ext, meta.rect(), () => {
                                this.ext.size_signals_unblock(meta_swap);
                            });
                        }

                        this.ext.register_fn(() => meta.activate(true));
                    }
                }

                if (!tree_swapped) {
                    this.ext.size_signals_block(meta);
                    const meta_entity = this.window;
                    meta.move(this.ext, this.ext.overlay, () => {
                        this.ext.size_signals_unblock(meta);
                        this.ext.add_tag(meta_entity, Tags.Tiled);
                    });
                }
            }
        }

        this.swap_window = null;

        this.exit();
    }

    exit() {
        this.queue.clear();

        if (this.resize_keymon !== null) {
            global.stage.disconnect(this.resize_keymon);
            this.resize_keymon = null;
            Main.popModal(this.resize_grab);
        }

        if (this.resize_keymon_release !== null) {
            global.stage.disconnect(this.resize_keymon_release);
        }

        if (this.window) {
            this.window = null;
            this.resize_hint.visible = false;

            // Disable overlay
            this.ext.overlay.visible = false;

            // Disable tiling keybindings
            this.ext.keybindings
                .disable(this.ext.keybindings.tiler_bindings)
                .disable(this.ext.keybindings.resize_bindings)
                .enable(this.ext.keybindings.window_focus);
        }
    }

    snap(win: window.ShellWindow) {
        let mon_geom = this.ext.monitor_work_area(win.meta.get_monitor());
        if (mon_geom) {
            let rect = win.rect();
            const columns = Math.floor(mon_geom.width / this.ext.column_size);
            const rows = Math.floor(mon_geom.height / this.ext.row_size);
            this.change(
                rect,
                monitor_rect(mon_geom, columns, rows),
                0,
                0,
                0,
                0
            );

            win.move(this.ext, rect);

            this.ext.snapped.insert(win.entity, true);
        }
    }
}

export function locate_monitor(
    win: window.ShellWindow,
    direction: Meta.DisplayDirection
): [number, Rectangular] | null {
    if (!win.actor_exists()) return null;

    const from = win.meta.get_monitor();
    const ref = win.meta.get_work_area_for_monitor(from) as any;
    const n_monitors = global.display.get_n_monitors();

    const {UP, DOWN, LEFT} = Meta.DisplayDirection;

    let origin: [number, number];
    let exclude: (rect: Rectangular) => boolean;

    if (direction === UP) {
        origin = [ref.x + ref.width / 2, ref.y];
        exclude = (rect: Rectangular) => {
            return rect.y > ref.y;
        };
    } else if (direction === DOWN) {
        origin = [ref.x + ref.width / 2, ref.y + ref.height];
        exclude = (rect: Rectangular) => rect.y < ref.y;
    } else if (direction === LEFT) {
        origin = [ref.x, ref.y + ref.height / 2];
        exclude = (rect: Rectangular) => rect.x > ref.x;
    } else {
        origin = [ref.x + ref.width, ref.y + ref.height / 2];
        exclude = (rect: Rectangular) => rect.x < ref.x;
    }

    let next: [number, number, Rectangular] | null = null;

    for (let mon = 0; mon < n_monitors; mon += 1) {
        if (mon === from) continue;

        const work_area = win.meta.get_work_area_for_monitor(mon);

        if (!work_area || exclude(work_area)) continue;

        const weight = geom.shortest_side(origin, work_area);

        if (next === null || next[1] > weight) {
            next = [mon, weight, work_area];
        }
    }

    return next ? [next[0], next[2]] : null;
}

function monitor_rect(
    monitor: Rectangle,
    columns: number,
    rows: number
): Rectangle {
    let tile_width = monitor.width / columns;
    let tile_height = monitor.height / rows;

    // Anything above 21:9 is considered ultrawide
    if (monitor.width * 9 >= monitor.height * 21) {
        tile_width /= 2;
    }

    // Anything below 9:21 is probably a rotated ultrawide
    if (monitor.height * 9 >= monitor.width * 21) {
        tile_height /= 2;
    }

    return new Rect.Rectangle([monitor.x, monitor.y, tile_width, tile_height]);
}

function move_window_or_monitor(
    ext: Ext,
    method: (
        ext: Ext,
        window: window.ShellWindow | null
    ) => window.ShellWindow | null,
    direction: Meta.DisplayDirection
): () => window.ShellWindow | number | null {
    return () => {
        let next_window = method.call(ext.focus_selector, ext, null);
        next_window = next_window?.actor_exists() ? next_window : null;

        // Check if a display exists between the next window and the focused window.
        const focus = ext.focus_window();
        if (focus) {
            // Return display number if the next window didn't exist.
            const next_monitor = locate_monitor(focus, direction);
            if (!next_window) return next_monitor ? next_monitor[0] : null;

            // If no monitor found, or next window is on the same display, pick the window.
            if (
                !next_monitor ||
                focus.meta.get_monitor() == next_window.meta.get_monitor()
            )
                return next_window;

            // If the next window is not contained within the next display, return the display.
            return Rect.Rectangle.from_meta(next_monitor[1]).contains(
                next_window.rect()
            )
                ? next_window
                : next_monitor[0];
        }

        return next_window;
    };
}

function tile_monitors(rect: Rectangle): Array<Rectangle> {
    let total_size = (a: Rectangle, b: Rectangle): number =>
        a.width * a.height - b.width * b.height;

    let workspace = global.workspace_manager.get_active_workspace();
    return Main.layoutManager.monitors
        .map((_monitor: Rectangle, i: number) =>
            workspace.get_work_area_for_monitor(i)
        )
        .filter((monitor: Rectangle) => {
            return (
                rect.x + rect.width > monitor.x &&
                rect.y + rect.height > monitor.y &&
                rect.x < monitor.x + monitor.width &&
                rect.y < monitor.y + monitor.height
            );
        })
        .sort(total_size);
}
