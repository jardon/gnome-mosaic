import * as ecs from './ecs.js';
import * as lib from './lib.js';
import * as log from './log.js';
import * as node from './node.js';
import * as result from './result.js';
import * as geom from './geom.js';
import * as tiling from './tiling.js';

import type {Entity} from './ecs.js';
import type {Ext} from './extension.js';
import {Forest, MoveBy, MoveByCursor} from './forest.js';
import type {Fork} from './fork.js';
import type {Rectangle} from './rectangle.js';
import type {Result} from './result.js';
import type {ShellWindow} from './window.js';

const {Ok, Err, ERR} = result;
const {NodeKind} = node;
import * as Tags from './tags.js';

export class AutoTiler {
    forest: Forest;
    attached: ecs.Storage<Entity>;

    constructor(forest: Forest, attached: ecs.Storage<Entity>) {
        this.forest = forest;
        this.attached = attached;
    }

    toJSON() {
        return {
            forest: this.forest,
            attached: this.attached,
        };
    }

    /** Swap window associations in the auto-tiler
     *
     * Call this when a window has swapped positions with another, so that we
     * may update the associations in the auto-tiler world.
     */
    attach_swap(ext: Ext, a: Entity, b: Entity) {
        const a_ent = this.attached.get(a),
            b_ent = this.attached.get(b);

        let a_win = ext.windows.get(a),
            b_win = ext.windows.get(b);

        if (!a_ent || !b_ent || !a_win || !b_win) return;

        const a_fork = this.forest.forks.get(a_ent),
            b_fork = this.forest.forks.get(b_ent);

        if (!a_fork || !b_fork) return;

        const a_fn = a_fork.replace_window(a_win, b_win);
        this.forest.on_attach(a_ent, b);

        const b_fn = b_fork.replace_window(b_win, a_win);
        this.forest.on_attach(b_ent, a);

        if (a_fn) a_fn();
        if (b_fn) b_fn();

        a_win.meta.get_compositor_private()?.show();
        b_win.meta.get_compositor_private()?.show();

        this.tile(ext, a_fork, a_fork.area);
        this.tile(ext, b_fork, b_fork.area);
    }

    update_toplevel(
        ext: Ext,
        fork: Fork,
        monitor: number,
        smart_gaps: boolean
    ) {
        let rect = ext.monitor_work_area(monitor);

        fork.smart_gapped = smart_gaps && fork.right === null;

        if (!fork.smart_gapped) {
            rect.x += ext.gap_outer;
            rect.y += ext.gap_outer;
            rect.width -= ext.gap_outer * 2;
            rect.height -= ext.gap_outer * 2;
        }

        if (fork.left.inner.kind === 2) {
            const win = ext.windows.get(fork.left.inner.entity);
            if (win) {
                win.smart_gapped = fork.smart_gapped;
            }
        }

        fork.area = fork.set_area(rect.clone());
        fork.length_left = Math.round(fork.prev_ratio * fork.length());
        this.tile(ext, fork, fork.area);
    }

    /** Attaches `win` to an optionally-given monitor */
    attach_to_monitor(
        ext: Ext,
        win: ShellWindow,
        workspace_id: [number, number],
        smart_gaps: boolean
    ) {
        let rect = ext.monitor_work_area(workspace_id[0]);

        if (!smart_gaps) {
            rect.x += ext.gap_outer;
            rect.y += ext.gap_outer;
            rect.width -= ext.gap_outer * 2;
            rect.height -= ext.gap_outer * 2;
        }

        const [entity, fork] = this.forest.create_toplevel(
            win.entity,
            rect.clone(),
            workspace_id
        );
        this.forest.on_attach(entity, win.entity);
        fork.smart_gapped = smart_gaps;
        win.smart_gapped = smart_gaps;

        this.tile(ext, fork, rect);
    }

    /** Tiles a window into another */
    attach_to_window(
        ext: Ext,
        attachee: ShellWindow,
        attacher: ShellWindow,
        move_by: MoveBy
    ): boolean {
        let attached = this.forest.attach_window(
            ext,
            attachee.entity,
            attacher.entity,
            move_by
        );

        if (attached) {
            const [, fork] = attached;
            const monitor = ext.monitors.get(attachee.entity);
            if (monitor) {
                if (fork.is_toplevel && fork.smart_gapped && fork.right) {
                    fork.smart_gapped = false;
                    let rect = ext.monitor_work_area(fork.monitor);

                    rect.x += ext.gap_outer;
                    rect.y += ext.gap_outer;
                    rect.width -= ext.gap_outer * 2;
                    rect.height -= ext.gap_outer * 2;

                    fork.set_area(rect);
                }

                this.tile(ext, fork, fork.area.clone());
                return true;
            } else {
                log.error(
                    `missing monitor association for Window(${attachee.entity})`
                );
            }
        }

        return false;
    }

    /** Tile a window onto a workspace */
    attach_to_workspace(ext: Ext, win: ShellWindow, id: [number, number]) {
        if (ext.should_ignore_workspace(id[0])) {
            id = [id[0], 0];
        }

        const toplevel = this.forest.find_toplevel(id);

        if (toplevel) {
            const onto = this.forest.largest_window_on(ext, toplevel);
            if (onto) {
                if (this.attach_to_window(ext, onto, win, {auto: 0})) {
                    return;
                }
            }
        }

        this.attach_to_monitor(ext, win, id, ext.settings.smart_gaps());
    }

    /** Automatically tiles a window into the window tree.
     *
     * ## Implementation Notes
     *
     * - First tries to tile onto the focused window
     * - Then tries to tile onto a monitor
     */
    auto_tile(ext: Ext, win: ShellWindow, ignore_focus: boolean = false) {
        const result = this.fetch_mode(ext, win, ignore_focus);
        this.detach_window(ext, win.entity);
        if (result.kind == ERR) {
            log.debug(`attach to workspace: ${result.value}`);
            this.attach_to_workspace(ext, win, ext.workspace_id(win));
        } else {
            log.debug(`attaching to window ${win.entity}`);
            this.attach_to_window(ext, result.value, win, {auto: 0});
        }
    }

    /** Destroy all widgets owned by this object. Call before dropping. */
    destroy(ext: Ext) {
        for (const [, [fent]] of this.forest.toplevel) {
            for (const node of this.forest.iter(fent)) {
                if (node.inner.kind === 2) {
                    this.forest.on_detach(node.inner.entity);
                }
            }
        }

        ext.show_border_on_focused();
    }

    /** Detaches the window from a tiling branch, if it is attached to one. */
    detach_window(ext: Ext, win: Entity) {
        this.attached.take_with(win, (prev_fork: Entity) => {
            const reflow_fork = this.forest.detach(prev_fork, win);

            if (reflow_fork) {
                const fork = reflow_fork[1];
                if (
                    fork.is_toplevel &&
                    ext.settings.smart_gaps() &&
                    fork.right === null
                ) {
                    let rect = ext.monitor_work_area(fork.monitor);
                    fork.set_area(rect);
                    fork.smart_gapped = true;
                }

                this.tile(ext, fork, fork.area);
            }

            ext.windows.with(win, info => (info.ignore_detach = false));
        });
    }

    /** Swaps the location of two windows if the dropped window was dropped onto its sibling */
    dropped_on_sibling(ext: Ext, win: Entity, swap: boolean = true): boolean {
        const fork_entity = this.attached.get(win);

        if (fork_entity) {
            const cursor = lib.cursor_rect();
            const fork = this.forest.forks.get(fork_entity);

            if (fork) {
                if (
                    fork.left.inner.kind === 2 &&
                    fork.right &&
                    fork.right.inner.kind === 2
                ) {
                    if (fork.left.is_window(win)) {
                        const sibling = ext.windows.get(
                            fork.right.inner.entity
                        );
                        if (sibling && sibling.rect().contains(cursor)) {
                            if (swap) {
                                fork.left.inner.entity =
                                    fork.right.inner.entity;
                                fork.right.inner.entity = win;

                                this.tile(ext, fork, fork.area);
                            }

                            return true;
                        }
                    } else if (fork.right.is_window(win)) {
                        const sibling = ext.windows.get(fork.left.inner.entity);
                        if (sibling && sibling.rect().contains(cursor)) {
                            if (swap) {
                                fork.right.inner.entity =
                                    fork.left.inner.entity;
                                fork.left.inner.entity = win;

                                this.tile(ext, fork, fork.area);
                            }

                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    /** Find the fork that belongs to a window */
    get_parent_fork(window: Entity): null | Fork {
        const entity = this.attached.get(window);
        if (entity === null) return null;

        const fork = this.forest.forks.get(entity);

        return fork;
    }

    largest_on_workspace(
        ext: Ext,
        monitor: number,
        workspace: number
    ): null | ShellWindow {
        const workspace_id: [number, number] = [monitor, workspace];
        const toplevel = this.forest.find_toplevel(workspace_id);
        if (toplevel) {
            return this.forest.largest_window_on(ext, toplevel);
        }

        return null;
    }

    /** Performed when a window that has been dropped is destined to be tiled
     *
     * ## Implementation Notes
     *
     * - If the window is dropped onto a window, tile onto it
     * - If no window is present, tile onto the monitor
     */
    on_drop(ext: Ext, win: ShellWindow, via_overview: boolean = false) {
        const [cursor, monitor] = ext.cursor_status();
        const workspace = ext.active_workspace();

        if (win.rect().contains(cursor)) {
            via_overview = false;
        }

        const attach_mon = () => {
            const attach_to = this.largest_on_workspace(
                ext,
                monitor,
                workspace
            );
            if (attach_to) {
                this.attach_to_window(ext, attach_to, win, {auto: 0});
            } else {
                this.attach_to_monitor(
                    ext,
                    win,
                    [monitor, workspace],
                    ext.settings.smart_gaps()
                );
            }
        };

        if (via_overview) {
            this.detach_window(ext, win.entity);
            attach_mon();
            return;
        }

        let attach_to = null;
        for (const found of ext.windows_at_pointer(
            cursor,
            monitor,
            workspace
        )) {
            if (found != win && this.attached.contains(found.entity)) {
                attach_to = found;
                break;
            }
        }

        const fork = this.get_parent_fork(win.entity);
        if (!fork) return;

        const windowless =
            this.largest_on_workspace(ext, monitor, workspace) === null;

        // If it appears to not be attaching to anything, assume we are attaching to its sibling
        if (attach_to === null) {
            if (fork.left.inner.kind === 2 && fork.right?.inner.kind === 2) {
                let attaching = fork.left.is_window(win.entity)
                    ? fork.right.inner.entity
                    : fork.left.inner.entity;

                attach_to = ext.windows.get(attaching);
            } else if (!windowless) {
                this.tile(ext, fork, fork.area);
                return true;
            }
        }

        if (windowless) {
            this.detach_window(ext, win.entity);
            this.attach_to_monitor(
                ext,
                win,
                [monitor, workspace],
                ext.settings.smart_gaps()
            );
        } else if (attach_to) {
            this.place(ext, win, attach_to, cursor);
        } else {
            this.detach_window(ext, win.entity);
            attach_mon();
        }
    }

    place(
        ext: Ext,
        win: ShellWindow,
        attach_to: ShellWindow,
        cursor: Rectangle
    ): boolean {
        const fork = this.get_parent_fork(attach_to.entity);
        if (!fork) return true;

        const is_sibling = this.windows_are_siblings(
            win.entity,
            attach_to.entity
        );

        const attach_area: Rectangular = is_sibling
            ? fork.area
            : attach_to.meta.get_frame_rect();

        let placement: null | MoveBy = cursor_placement(attach_area, cursor);

        const {Left, Up, Right, Down} = tiling.Direction;

        const swap = (o: lib.Orientation, d: tiling.Direction) => {
            fork.set_orientation(o);
            const is_left = fork.left.is_window(win.entity);
            const swap =
                (is_left && (d == Right || d == Down)) ||
                (!is_left && (d == Left || d == Up));

            if (swap) {
                fork.swap_branches();
            }

            this.tile(ext, fork, fork.area);
        };

        if (placement) {
            const direction =
                placement.orientation === lib.Orientation.HORIZONTAL
                    ? placement.swap
                        ? Left
                        : Right
                    : placement.swap
                      ? Up
                      : Down;

            if (is_sibling) {
                swap(placement.orientation, direction);
                return true;
            } else if (fork.is_toplevel && fork.right === null) {
                this.detach_window(ext, win.entity);
                this.attach_to_window(ext, attach_to, win, placement);
                swap(placement.orientation, direction);
                return true;
            }
        } else {
            placement = {auto: 0};
        }

        this.detach_window(ext, win.entity);
        return this.attach_to_window(ext, attach_to, win, placement);
    }

    /** Schedules a fork to be reflowed */
    reflow(ext: Ext, win: Entity) {
        const fork_entity = this.attached.get(win);
        if (!fork_entity) return;

        ext.register_fn(() => {
            const fork = this.forest.forks.get(fork_entity);
            if (fork) this.tile(ext, fork, fork.area);
        });
    }

    tile(ext: Ext, fork: Fork, area: Rectangle) {
        this.forest.tile(ext, fork, area);
    }

    toggle_floating(ext: Ext) {
        const focused = ext.focus_window();
        if (!focused) return;

        let wm_class = focused.meta.get_wm_class();
        let wm_title = focused.meta.get_title();
        let float_except = false;

        if (wm_class != null && wm_title != null) {
            float_except = ext.conf.window_shall_float(wm_class, wm_title);
        }

        if (float_except) {
            if (ext.contains_tag(focused.entity, Tags.ForceTile)) {
                ext.delete_tag(focused.entity, Tags.ForceTile);
                const fork_entity = this.attached.get(focused.entity);
                if (fork_entity) {
                    this.detach_window(ext, focused.entity);
                }
            } else {
                ext.add_tag(focused.entity, Tags.ForceTile);
                this.auto_tile(ext, focused, false);
            }
        } else {
            if (ext.contains_tag(focused.entity, Tags.Floating)) {
                ext.delete_tag(focused.entity, Tags.Floating);
                this.auto_tile(ext, focused, false);
            } else {
                const fork_entity = this.attached.get(focused.entity);
                if (fork_entity) {
                    this.detach_window(ext, focused.entity);
                    ext.add_tag(focused.entity, Tags.Floating);
                }
            }
        }

        ext.register_fn(() => focused.activate(ext, true));
    }

    toggle_orientation(ext: Ext, window: ShellWindow) {
        const result = this.toggle_orientation_(ext, window);
        if (result.kind == ERR) {
            log.warn(`toggle_orientation: ${result.value}`);
        }
    }

    windows_are_siblings(a: Entity, b: Entity): Entity | null {
        const a_parent = this.attached.get(a);
        const b_parent = this.attached.get(b);

        if (
            a_parent !== null &&
            null !== b_parent &&
            ecs.entity_eq(a_parent, b_parent)
        ) {
            return a_parent;
        }

        return null;
    }

    private fetch_mode(
        ext: Ext,
        win: ShellWindow,
        ignore_focus: boolean = false
    ): Result<ShellWindow, string> {
        if (ignore_focus) {
            return Err('ignoring focus');
        }

        const prev = ext.previously_focused(win);

        if (!prev) {
            return Err('no window has been previously focused');
        }

        let onto = ext.windows.get(prev);

        if (!onto) {
            return Err('no focus window');
        }

        if (ecs.entity_eq(onto.entity, win.entity)) {
            return Err('tiled window and attach window are the same window');
        }

        if (!onto.is_tilable(ext)) {
            return Err('focused window is not tilable');
        }

        if (onto.meta.minimized) {
            return Err('previous window was minimized');
        }

        if (!this.attached.contains(onto.entity)) {
            return Err('focused window is not attached');
        }

        return onto.meta.get_monitor() == win.meta.get_monitor() &&
            onto.workspace_id() == win.workspace_id()
            ? Ok(onto)
            : Err('window is not on the same monitor or workspace');
    }

    private toggle_orientation_(
        ext: Ext,
        focused: ShellWindow
    ): Result<void, string> {
        if (focused.meta.get_maximized()) {
            return Err('cannot toggle maximized window');
        }

        const fork_entity = this.attached.get(focused.entity);
        if (!fork_entity) {
            return Err(`window is not attached to the tree`);
        }

        const fork = this.forest.forks.get(fork_entity);
        if (!fork) {
            return Err("window's fork attachment does not exist");
        }

        if (!fork.right) return Ok(void 0);

        fork.toggle_orientation();
        this.forest.measure(ext, fork, fork.area);

        for (const child of this.forest.iter(fork_entity, NodeKind.FORK)) {
            const child_fork = this.forest.forks.get(
                (child.inner as node.NodeFork).entity
            );
            if (child_fork) {
                child_fork.rebalance_orientation();
                this.forest.measure(ext, child_fork, child_fork.area);
            } else {
                log.error(
                    'toggle_orientation: Fork(${child.entity}) does not exist to have its orientation toggled'
                );
            }
        }

        this.forest.arrange(ext, fork.workspace, true);

        return Ok(void 0);
    }
}

/** Enables deriving the orientation that a window will be attached by the mouse position.
 *
 * A null indicates that the window should be stacked
 */
export function cursor_placement(
    area: Rectangular,
    cursor: Rectangular
): null | MoveByCursor {
    const {LEFT, RIGHT, TOP, BOTTOM} = geom.Side;
    const {HORIZONTAL, VERTICAL} = lib.Orientation;

    const [, side] = geom.nearest_side([cursor.x, cursor.y], area);

    let res: null | [lib.Orientation, boolean] =
        side === LEFT
            ? [HORIZONTAL, true]
            : side === RIGHT
              ? [HORIZONTAL, false]
              : side === TOP
                ? [VERTICAL, true]
                : side === BOTTOM
                  ? [VERTICAL, false]
                  : null;

    return res ? {orientation: res[0], swap: res[1]} : null;
}
