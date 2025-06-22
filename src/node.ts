import * as Ecs from './ecs.js';

import type {Forest} from './forest.js';
import type {Entity} from './ecs.js';
import type {Ext} from './extension.js';
import type {Rectangle} from './rectangle.js';

/** A node is either a fork a window */
export enum NodeKind {
    FORK = 1,
    WINDOW = 2,
}

/** Fetch the string representation of this value */
function node_variant_as_string(value: NodeKind): string {
    return value == NodeKind.FORK ? 'NodeVariant::Fork' : 'NodeVariant::Window';
}

/** Identifies this node as a fork */
export interface NodeFork {
    kind: 1;
    entity: Entity;
}

/** Identifies this node as a window */
export interface NodeWindow {
    kind: 2;
    entity: Entity;
}

export type NodeADT = NodeFork | NodeWindow;

/** A tiling node may either refer to a window entity, or another fork entity */
export class Node {
    /** The actual data for this node */
    inner: NodeADT;

    constructor(inner: NodeADT) {
        this.inner = inner;
    }

    /** Create a fork variant of a `Node` */
    static fork(entity: Entity): Node {
        return new Node({kind: NodeKind.FORK, entity});
    }

    /** Create the window variant of a `Node` */
    static window(entity: Entity): Node {
        return new Node({kind: NodeKind.WINDOW, entity});
    }

    /** Generates a string representation of the this value. */
    display(fmt: string): string {
        fmt += `{\n    kind: ${node_variant_as_string(this.inner.kind)},\n    `;

        switch (this.inner.kind) {
            // Fork + Window
            case 1:
            case 2:
                fmt += `entity: (${this.inner.entity})\n  }`;
                return fmt;
        }
    }

    /** Asks if this fork is the fork we are looking for */
    is_fork(entity: Entity): boolean {
        return (
            this.inner.kind === 1 && Ecs.entity_eq(this.inner.entity, entity)
        );
    }

    /** Asks if this window is the window we are looking for */
    is_window(entity: Entity): boolean {
        return (
            this.inner.kind === 2 && Ecs.entity_eq(this.inner.entity, entity)
        );
    }

    /** Calculates the future arrangement of windows in this node */
    measure(
        tiler: Forest,
        ext: Ext,
        parent: Entity,
        area: Rectangle,
        record: (win: Entity, parent: Entity, area: Rectangle) => void
    ) {
        switch (this.inner.kind) {
            // Fork
            case 1:
                const fork = tiler.forks.get(this.inner.entity);
                if (fork) {
                    record;
                    fork.measure(tiler, ext, area, record);
                }

                break;
            // Window
            case 2:
                record(this.inner.entity, parent, area.clone());
                break;
        }
    }
}
