import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Lib from './lib.js';

const {separator} = Lib;

export class Shortcut {
    description: string;
    bindings: Array<Array<string>>;

    constructor(description: string) {
        this.description = description;
        this.bindings = new Array();
    }

    add(binding: Array<string>) {
        this.bindings.push(binding);
        return this;
    }
}

export class Section {
    header: string;
    shortcuts: Array<Shortcut>;

    constructor(header: string, shortcuts: Array<Shortcut>) {
        this.header = header;
        this.shortcuts = shortcuts;
    }
}

export class Column {
    sections: Array<Section>;

    constructor(sections: Array<Section>) {
        this.sections = sections;
    }
}

export var ShortcutOverlay = GObject.registerClass(
    class ShortcutOverlay extends St.BoxLayout {
        title: string;
        columns: Array<Column>;

        constructor() {
            super();
            this.title = '';
            this.columns = new Array();
        }

        _init(title: string, columns: Array<Column>) {
            super.init({
                styleClass: 'gnome-mosaic-shortcuts',
                destroyOnClose: false,
                shellReactive: true,
                shouldFadeIn: true,
                shouldFadeOut: true,
            });

            let columns_layout = new St.BoxLayout({
                styleClass: 'gnome-mosaic-shortcuts-columns',
                horizontal: true,
            });

            for (const column of columns) {
                let column_layout = new St.BoxLayout({
                    styleClass: 'gnome-mosaic-shortcuts-column',
                });

                for (const section of column.sections) {
                    column_layout.add(this.gen_section(section));
                }

                columns_layout.add(column_layout);
            }

            this.add(
                new St.Label({
                    styleClass: 'gnome-mosaic-shortcuts-title',
                    text: title,
                })
            );

            this.add(columns_layout);

            // TODO: Add hyperlink for shortcuts in settings
        }

        gen_combination(combination: Array<string>) {
            let layout = new St.BoxLayout({
                styleClass: 'gnome-mosaic-binding',
                horizontal: true,
            });

            for (const key of combination) {
                layout.add(St.Label({text: key}));
            }

            return layout;
        }

        gen_section(section: Section) {
            let layout = new St.BoxLayout({
                styleclass: 'gnome-mosaic-section',
            });

            layout.add(
                new St.Label({
                    styleClass: 'gnome-mosaic-section-header',
                    text: section.header,
                })
            );

            for (const subsection of section.shortcuts) {
                layout.add(separator());
                layout.add(this.gen_shortcut(subsection));
            }

            return layout;
        }

        gen_shortcut(shortcut: Shortcut) {
            let layout = new St.BoxLayout({
                styleClass: 'gnome-mosaic-shortcut',
                horizontal: true,
            });

            layout.add(
                new St.Label({
                    text: shortcut.description,
                })
            );

            // for (const binding of shortcut.bindings) {
            //     join(
            //         binding.values(),
            //         (comb) => layout.add(this.gen_combination(comb)),
            //         () => layout.add(new St.Label({ text: 'or' }))
            //     );
            // }

            return layout;
        }
    }
);
