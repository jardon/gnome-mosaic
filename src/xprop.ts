import * as lib from './lib.js';

import Gio from 'gi://Gio';
import {spawn} from 'resource:///org/gnome/shell/misc/util.js';

export var MOTIF_HINTS: string = '_MOTIF_WM_HINTS';
export var HIDE_FLAGS: string[] = ['0x2', '0x0', '0x0', '0x0', '0x0'];
export var SHOW_FLAGS: string[] = ['0x2', '0x0', '0x1', '0x0', '0x0'];

//export var FRAME_EXTENTS: string = "_GTK_FRAME_EXTENTS"

export async function get_window_role(xid: string): Promise<string | null> {
    let out = await xprop_cmd(xid, ['WM_WINDOW_ROLE']);

    if (!out) return null;

    return parse_string(out);
}

export async function get_frame_extents(xid: string): Promise<string | null> {
    let out = await xprop_cmd(xid, ['_GTK_FRAME_EXTENTS']);

    if (!out) return null;

    return parse_string(out);
}

export async function get_hint(
    xid: string,
    hint: string
): Promise<Array<string> | null> {
    let out = await xprop_cmd(xid, [hint]);

    if (!out) return null;

    const array = parse_cardinal(out);

    return array
        ? array.map(value => (value.startsWith('0x') ? value : '0x' + value))
        : null;
}

function size_params(line: string): [number, number] | null {
    let fields = line.split(' ');
    let x = lib.dbg(lib.nth_rev(fields, 2));
    let y = lib.dbg(lib.nth_rev(fields, 0));

    if (!x || !y) return null;

    let xn = parseInt(x, 10);
    let yn = parseInt(y, 10);

    return isNaN(xn) || isNaN(yn) ? null : [xn, yn];
}

export async function get_size_hints(
    xid: string
): Promise<lib.SizeHint | null> {
    let out = await xprop_cmd(xid, ['WM_NORMAL_HINTS']);
    if (out) {
        let lines = out.split('\n')[Symbol.iterator]();
        lines.next();

        let minimum: string | undefined = lines.next().value;
        let increment: string | undefined = lines.next().value;
        let base: string | undefined = lines.next().value;

        if (!minimum || !increment || !base) return null;

        let min_values = size_params(minimum);
        let inc_values = size_params(increment);
        let base_values = size_params(base);

        if (!min_values || !inc_values || !base_values) return null;

        return {
            minimum: min_values,
            increment: inc_values,
            base: base_values,
        };
    }

    return null;
}

export function get_xid(meta: Meta.Window): string | null {
    const desc = meta.get_description();
    const match = desc && desc.match(/0x[0-9a-f]+/);
    return match && match[0];
}

export async function may_decorate(xid: string): Promise<boolean> {
    const hints = await motif_hints(xid);
    return hints ? hints[2] == '0x0' || hints[2] == '0x1' : true;
}

export async function motif_hints(xid: string): Promise<Array<string> | null> {
    return await get_hint(xid, MOTIF_HINTS);
}

export function set_hint(xid: string, hint: string, value: string[]) {
    spawn([
        'xprop',
        '-id',
        xid,
        '-f',
        hint,
        '32c',
        '-set',
        hint,
        value.join(', '),
    ]);
}

function consume_key(string: string): number | null {
    const pos = string.indexOf('=');
    return -1 == pos ? null : pos;
}

function parse_cardinal(string: string): Array<string> | null {
    const pos = consume_key(string);
    return pos
        ? string
              .slice(pos + 1)
              .trim()
              .split(', ')
        : null;
}

function parse_string(string: string): string | null {
    const pos = consume_key(string);
    return pos
        ? string
              .slice(pos + 1)
              .trim()
              .slice(1, -1)
        : null;
}

async function xprop_cmd(
    xid: string,
    args: string[],
    cancellable: any = null
): Promise<string | null> {
    let cancelId = 0;
    let flags =
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE;

    const xprops = `xprop -id ${xid} ${args}`.split(' ');
    const proc = new Gio.Subprocess({xprops, flags});
    proc.init(cancellable);

    if (cancellable instanceof Gio.Cancellable)
        cancelId = cancellable.connect(() => proc.force_exit());

    try {
        const [stdout, stderr] = await proc.communicate_utf8_async(null, null);

        const status = proc.get_exit_status();

        if (status !== 0) {
            throw new Gio.IOErrorEnum({
                code: Gio.IOErrorEnum.FAILED,
                message: stderr
                    ? stderr.trim()
                    : `Command '${xprops}' failed with exit code ${status}`,
            });
        }

        return stdout.trim();
    } finally {
        if (cancelId > 0) cancellable.disconnect(cancelId);
    }
}
