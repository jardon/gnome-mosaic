#!/usr/bin/gjs --module

import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import Pango from 'gi://Pango';

/** The directory that this script is executed from. */
const SCRIPT_DIR = GLib.path_get_dirname(
    new Error().stack.split(':')[0].slice(1)
);

/** Add our directory so we can import modules from it. */
imports.searchPath.push(SCRIPT_DIR);

import * as config from './config.js';

let app;

interface SelectWindow {
    tag: 0;
}

enum ViewNum {
    MainView = 0,
    Exceptions = 1,
}

interface SwitchTo {
    tag: 1;
    view: ViewNum;
}

interface ToggleException {
    tag: 2;
    wmclass: string | undefined;
    wmtitle: string | undefined;
    enable: boolean;
}

interface RemoveException {
    tag: 3;
    wmclass: string | undefined;
    wmtitle: string | undefined;
}

type Event = SelectWindow | SwitchTo | ToggleException | RemoveException;

interface View {
    widget: any;

    callback: (event: Event) => void;
}

export class MainView implements View {
    widget: any;

    callback: (event: Event) => void = () => {};

    private list: any;

    constructor() {
        let exceptions = this.exceptions_button();

        this.list = Gtk.ListBox.new();
        this.list.set_selection_mode(Gtk.SelectionMode.NONE);
        this.list.set_header_func(list_header_func);
        this.list.append(exceptions);

        let scroller = new Gtk.ScrolledWindow();
        scroller.hscrollbar_policy = Gtk.PolicyType.NEVER;
        scroller.set_propagate_natural_width(true);
        scroller.set_propagate_natural_height(true);
        scroller.set_child(this.list);

        let list_frame = Gtk.Frame.new(null);
        list_frame.set_child(scroller);

        let desc = new Gtk.Label({
            label: 'Add exceptions by selecting currently running applications and windows.',
            wrap: true,
        });
        desc.set_halign(Gtk.Align.CENTER);
        desc.set_justify(Gtk.Justification.CENTER);
        desc.set_max_width_chars(55);
        desc.set_margin_top(12);

        this.widget = Gtk.Box.new(Gtk.Orientation.VERTICAL, 24);
        this.widget.append(desc);
        this.widget.append(list_frame);
    }

    add_rule(wmclass: string | undefined, wmtitle: string | undefined) {
        let label = Gtk.Label.new(
            wmtitle === undefined ? wmclass : `${wmclass} / ${wmtitle}`
        );
        label.set_xalign(0);
        label.set_hexpand(true);
        label.set_ellipsize(Pango.EllipsizeMode.END);

        let button = Gtk.Button.new_from_icon_name('window-close-symbolic');
        button.set_valign(Gtk.Align.CENTER);

        let widget = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 24);
        widget.append(label);
        widget.append(button);
        widget.set_margin_top(12);
        widget.set_margin_bottom(12);
        widget.set_margin_start(12);
        widget.set_margin_end(12);

        widget.set_margin_start(12);

        button.connect('clicked', () => {
            this.list.remove(widget);
            widget.set_visible(false);
            this.callback({tag: 3, wmclass, wmtitle});
        });

        this.list.append(widget);
    }

    exceptions_button(): any {
        let label = Gtk.Label.new('System Exceptions');
        label.set_xalign(0);
        label.set_hexpand(true);
        label.set_ellipsize(Pango.EllipsizeMode.END);

        let description = Gtk.Label.new(
            'Updated based on validated user reports.'
        );
        description.set_xalign(0);
        description.get_style_context().add_class('dim-label');

        let button = Gtk.Button.new_from_icon_name('go-next-symbolic');
        button.set_valign(Gtk.Align.CENTER);

        let widget = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 24);
        widget.append(label);
        widget.append(description);
        widget.append(button);
        widget.set_margin_top(12);
        widget.set_margin_bottom(12);
        widget.set_margin_start(12);
        widget.set_margin_end(12);

        widget.set_margin_start(12);

        button.connect('clicked', () =>
            this.callback({tag: 1, view: ViewNum.Exceptions})
        );

        return widget;
    }
}

export class ExceptionsView implements View {
    widget: any;
    callback: (event: Event) => void = () => {};

    exceptions: any = Gtk.ListBox.new();

    constructor() {
        let desc_title = Gtk.Label.new('<b>System Exceptions</b>');
        desc_title.set_use_markup(true);
        desc_title.set_xalign(0);

        let desc_desc = Gtk.Label.new(
            'Updated based on validated user reports.'
        );
        desc_desc.set_xalign(0);
        desc_desc.get_style_context().add_class('dim-label');
        desc_desc.set_margin_bottom(6);

        let scroller = new Gtk.ScrolledWindow();
        scroller.hscrollbar_policy = Gtk.PolicyType.NEVER;
        scroller.set_propagate_natural_width(true);
        scroller.set_propagate_natural_height(true);
        scroller.set_child(this.exceptions);

        let exceptions_frame = Gtk.Frame.new(null);
        exceptions_frame.set_child(scroller);

        this.exceptions.set_selection_mode(Gtk.SelectionMode.NONE);
        this.exceptions.set_header_func(list_header_func);

        this.widget = Gtk.Box.new(Gtk.Orientation.VERTICAL, 6);
        this.widget.append(desc_title);
        this.widget.append(desc_desc);
        this.widget.append(exceptions_frame);
    }

    add_rule(
        wmclass: string | undefined,
        wmtitle: string | undefined,
        enabled: boolean
    ) {
        let label = Gtk.Label.new(
            wmtitle === undefined ? wmclass : `${wmclass} / ${wmtitle}`
        );
        label.set_xalign(0);
        label.set_hexpand(true);
        label.set_ellipsize(Pango.EllipsizeMode.END);

        let button = Gtk.Switch.new();
        button.set_valign(Gtk.Align.CENTER);
        button.set_state(enabled);
        button.set_active(true);
        button.connect('notify::state', () => {
            this.callback({
                tag: 2,
                wmclass,
                wmtitle,
                enable: button.get_state(),
            });
        });

        let widget = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 24);
        widget.append(label);
        widget.append(button);
        widget.set_margin_top(12);
        widget.set_margin_bottom(12);
        widget.set_margin_start(12);
        widget.set_margin_end(12);

        this.exceptions.append(widget);
    }
}

class App {
    main_view: MainView = new MainView();
    exceptions_view: ExceptionsView = new ExceptionsView();

    stack: any = Gtk.Stack.new();
    window: any;
    config: config.Config = new config.Config();

    constructor() {
        this.stack.set_margin_top(16);
        this.stack.set_margin_bottom(16);
        this.stack.set_margin_start(16);
        this.stack.set_margin_end(16);
        this.stack.add_child(this.main_view.widget);
        this.stack.add_child(this.exceptions_view.widget);

        let header = new Gtk.HeaderBar();

        let add_exception = Gtk.Button.new_from_icon_name('list-add-symbolic');
        add_exception.set_valign(Gtk.Align.CENTER);
        add_exception.set_halign(Gtk.Align.START);

        let back = Gtk.Button.new_from_icon_name('go-previous-symbolic');
        back.set_valign(Gtk.Align.CENTER);
        back.set_halign(Gtk.Align.START);

        const TITLE = 'Floating Window Exceptions';

        let win = new Gtk.Window();
        this.window = win;
        header.pack_start(add_exception);
        header.pack_start(back);
        win.set_deletable(true);
        win.set_title(TITLE);

        Gtk.Window.set_default_icon_name('application-default');

        win.set_titlebar(header);
        win.default_width = 550;
        win.default_height = 700;
        win.set_child(this.stack);

        back.hide();

        this.config.reload();

        for (const value of config.DEFAULT_FLOAT_RULES.values()) {
            let wmtitle = value.title ?? undefined;
            let wmclass = value.class ?? undefined;

            let disabled = this.config.rule_disabled({
                class: wmclass,
                title: wmtitle,
            });
            this.exceptions_view.add_rule(wmclass, wmtitle, !disabled);
        }

        for (const value of Array.from<any>(this.config.float)) {
            let wmtitle = value.title ?? undefined;
            let wmclass = value.class ?? undefined;
            if (!value.disabled) this.main_view.add_rule(wmclass, wmtitle);
        }

        let event_handler = (event: Event) => {
            switch (event.tag) {
                // SelectWindow
                case 0:
                    println('SELECT');
                    app.quit();
                    break;

                // SwitchTo
                case 1:
                    switch (event.view) {
                        case ViewNum.MainView:
                            this.stack.set_visible_child(this.main_view.widget);
                            back.hide();
                            add_exception.show();
                            break;
                        case ViewNum.Exceptions:
                            this.stack.set_visible_child(
                                this.exceptions_view.widget
                            );
                            back.show();
                            add_exception.hide();
                            break;
                    }

                    break;

                // ToggleException
                case 2:
                    log(`toggling exception ${event.enable}`);
                    this.config.toggle_system_exception(
                        event.wmclass,
                        event.wmtitle,
                        !event.enable
                    );
                    println('MODIFIED');
                    break;

                // RemoveException
                case 3:
                    log(`removing exception`);
                    this.config.remove_user_exception(
                        event.wmclass,
                        event.wmtitle
                    );
                    println('MODIFIED');
                    break;
            }
        };

        this.main_view.callback = event_handler;
        this.exceptions_view.callback = event_handler;
        back.connect('clicked', () =>
            event_handler({tag: 1, view: ViewNum.MainView})
        );
        add_exception.connect('clicked', () => event_handler({tag: 0}));
    }
}

function list_header_func(row: any, before: null | any) {
    if (before) {
        row.set_header(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL));
    }
}

const STDOUT = new Gio.DataOutputStream({
    base_stream: new GioUnix.OutputStream({fd: 1}),
});

function println(message: string) {
    STDOUT.put_string(message + '\n', null);
}

function main() {
    app = new Gtk.Application({
        application_id: 'com.github.jardon.gnome-mosaic-exceptions',
        flags: Gio.ApplicationFlags.FLAGS_NONE,
    });

    app.connect('activate', () => {
        GLib.set_prgname(config.WM_CLASS_ID);
        GLib.set_application_name('GNOME Mosaic Floating Window Exceptions');

        let instance = new App();
        instance.window.set_application(app);
        instance.window.present();
    });

    app.run([]);
}

main();
