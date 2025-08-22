import Gtk from 'gi://Gtk';

import Gio from 'gi://Gio';
const Settings = Gio.Settings;
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as settings from './settings.js';
import * as log from './log.js';
import * as focus from './focus.js';

interface AppWidgets {
    mouse_cursor_follows_active_window: any;
    show_skip_taskbar: any;
    smart_gaps: any;
    snap_to_grid: any;
    window_titles: any;
    mouse_cursor_focus_position: any;
    log_level: any;
    show_indicator: any;
    active_hint_width: any;
    gap_width: any;
}

export default class PopShellPreferences extends ExtensionPreferences {
    getPreferencesWidget() {
        globalThis.MosaicExtension = this;
        let dialog = settings_dialog_new();
        if (dialog.show_all) {
            dialog.show_all();
        } else {
            dialog.show();
        }
        log.debug(JSON.stringify(dialog));
        return dialog;
    }
}

function settings_dialog_new(): Gtk.Container {
    let [app, grid] = settings_dialog_view();

    let ext = new settings.ExtensionSettings();

    app.window_titles.set_active(ext.show_title());
    app.window_titles.connect('state-set', (_widget: any, state: boolean) => {
        ext.set_show_title(state);
        Settings.sync();
    });

    app.snap_to_grid.set_active(ext.snap_to_grid());
    app.snap_to_grid.connect('state-set', (_widget: any, state: boolean) => {
        ext.set_snap_to_grid(state);
        Settings.sync();
    });

    app.smart_gaps.set_active(ext.smart_gaps());
    app.smart_gaps.connect('state-set', (_widget: any, state: boolean) => {
        ext.set_smart_gaps(state);
        Settings.sync();
    });

    app.log_level.set_active(ext.log_level());
    app.log_level.connect('changed', () => {
        let active_id = app.log_level.get_active_id();
        ext.set_log_level(active_id);
    });

    app.show_indicator.set_active(ext.show_indicator());
    app.show_indicator.connect('state-set', (_widget: any, state: boolean) => {
        ext.set_show_indicator(state);
        Settings.sync();
    });

    app.show_skip_taskbar.set_active(ext.show_skiptaskbar());
    app.show_skip_taskbar.connect(
        'state-set',
        (_widget: any, state: boolean) => {
            ext.set_show_skiptaskbar(state);
            Settings.sync();
        }
    );

    app.mouse_cursor_follows_active_window.set_active(
        ext.mouse_cursor_follows_active_window()
    );
    app.mouse_cursor_follows_active_window.connect(
        'state-set',
        (_widget: any, state: boolean) => {
            ext.set_mouse_cursor_follows_active_window(state);
            Settings.sync();
        }
    );

    app.mouse_cursor_focus_position.set_active(
        ext.mouse_cursor_focus_location()
    );
    app.mouse_cursor_focus_position.connect('changed', () => {
        let active_id = app.mouse_cursor_focus_position.get_active_id();
        ext.set_mouse_cursor_focus_location(active_id);
    });

    app.active_hint_width.set_text(String(ext.active_hint_border_width()));
    app.active_hint_width.connect('activate', (widget: any) => {
        let parsed = parseInt((widget.get_text() as string).trim());
        if (!isNaN(parsed)) {
            ext.set_active_hint_border_width(parsed);
            Settings.sync();
        }
    });

    app.gap_width.connect('activate', (widget: any) => {
        let parsed = parseInt((widget.get_text() as string).trim());
        if (!isNaN(parsed)) {
            ext.set_gap_inner(parsed);
            ext.set_gap_outer(parsed);
            Settings.sync();
        }
    });

    return grid;
}

function settings_dialog_view(): [AppWidgets, Gtk.Container] {
    const grid = new Gtk.Grid({
        column_spacing: 12,
        row_spacing: 12,
        margin_start: 10,
        margin_end: 10,
        margin_bottom: 10,
        margin_top: 10,
    });

    const win_label = new Gtk.Label({
        label: 'Show Window Titles',
        xalign: 0.0,
        hexpand: true,
    });

    const snap_label = new Gtk.Label({
        label: 'Snap to Grid (Floating Mode)',
        xalign: 0.0,
    });

    const smart_label = new Gtk.Label({
        label: 'Smart Gaps',
        xalign: 0.0,
    });

    const show_skip_taskbar_label = new Gtk.Label({
        label: 'Show Minimize to Tray Windows',
        xalign: 0.0,
    });

    const mouse_cursor_follows_active_window_label = new Gtk.Label({
        label: 'Mouse Cursor Follows Active Window',
        xalign: 0.0,
    });

    const show_indicator_label = new Gtk.Label({
        label: 'Show Indicator Panel',
        xalign: 0.0,
        hexpand: true,
    });

    let active_hint_width_label = new Gtk.Label({
        label: 'Active Hint Width',
        xalign: 0.0,
    });

    let gap_width_label = new Gtk.Label({
        label: 'Gap Width',
        xalign: 0.0,
    });

    const settings = {
        smart_gaps: new Gtk.Switch({halign: Gtk.Align.END}),
        snap_to_grid: new Gtk.Switch({halign: Gtk.Align.END}),
        window_titles: new Gtk.Switch({halign: Gtk.Align.END}),
        show_skip_taskbar: new Gtk.Switch({halign: Gtk.Align.END}),
        show_indicator: new Gtk.Switch({halign: Gtk.Align.END}),
        mouse_cursor_follows_active_window: new Gtk.Switch({
            halign: Gtk.Align.END,
        }),
        mouse_cursor_focus_position: build_combo(
            grid,
            8,
            focus.FocusPosition,
            'Mouse Cursor Focus Position'
        ),
        log_level: build_combo(grid, 9, log.LOG_LEVELS, 'Log Level'),
        active_hint_width: new Gtk.Entry({
            input_purpose: Gtk.InputPurpose.NUMBER,
        }),
        gap_width: new Gtk.Entry({
            input_purpose: Gtk.InputPurpose.NUMBER,
        }),
    };

    grid.attach(win_label, 0, 0, 1, 1);
    grid.attach(settings.window_titles, 1, 0, 1, 1);

    grid.attach(snap_label, 0, 1, 1, 1);
    grid.attach(settings.snap_to_grid, 1, 1, 1, 1);

    grid.attach(smart_label, 0, 2, 1, 1);
    grid.attach(settings.smart_gaps, 1, 2, 1, 1);

    grid.attach(show_skip_taskbar_label, 0, 5, 1, 1);
    grid.attach(settings.show_skip_taskbar, 1, 5, 1, 1);

    grid.attach(show_indicator_label, 0, 6, 1, 1);
    grid.attach(settings.show_indicator, 1, 6, 1, 1);

    grid.attach(mouse_cursor_follows_active_window_label, 0, 7, 1, 1);
    grid.attach(settings.mouse_cursor_follows_active_window, 1, 7, 1, 1);

    grid.attach(active_hint_width_label, 0, 10, 1, 1);
    grid.attach(settings.active_hint_width, 1, 10, 1, 1);

    grid.attach(gap_width_label, 0, 11, 1, 1);
    grid.attach(settings.gap_width, 1, 11, 1, 1);

    return [settings, grid];
}

function build_combo(
    grid: any,
    top_index: number,
    iter_enum: any,
    label: string
) {
    let label_ = new Gtk.Label({
        label: label,
        halign: Gtk.Align.START,
    });

    grid.attach(label_, 0, top_index, 1, 1);

    let combo = new Gtk.ComboBoxText();

    for (const [index, key] of Object.keys(iter_enum).entries()) {
        if (typeof iter_enum[key] == 'string') {
            combo.append(`${index}`, iter_enum[key]);
        }
    }

    grid.attach(combo, 1, top_index, 1, 1);
    return combo;
}
