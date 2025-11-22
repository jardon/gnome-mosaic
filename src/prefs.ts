import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as settings from './settings.js';
import {FocusPosition} from './focus.js';

export default class MosaicPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window: any) {
        const extSettings = new settings.ExtensionSettings();
        const gioSettings = extSettings.ext;

        const page = new Adw.PreferencesPage();
        window.add(page);

        // Group: Appearance
        const appearanceGroup = new Adw.PreferencesGroup({
            title: 'Appearance',
        });
        page.add(appearanceGroup);

        // Show Window Titles
        const windowTitlesRow = new Adw.SwitchRow({
            title: 'Show Window Titles',
        });
        appearanceGroup.add(windowTitlesRow);
        gioSettings.bind(
            'show-title',
            windowTitlesRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Show Indicator Panel
        const showIndicatorRow = new Adw.SwitchRow({
            title: 'Show Indicator Panel',
        });
        appearanceGroup.add(showIndicatorRow);
        gioSettings.bind(
            'show-indicator',
            showIndicatorRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Show Minimize to Tray Windows
        const showSkipTaskbarRow = new Adw.SwitchRow({
            title: 'Show Minimize to Tray Windows',
        });
        appearanceGroup.add(showSkipTaskbarRow);
        gioSettings.bind(
            'show-skip-taskbar',
            showSkipTaskbarRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Group: Behavior
        const behaviorGroup = new Adw.PreferencesGroup({
            title: 'Behavior',
        });
        page.add(behaviorGroup);

        // Snap to Grid
        const snapToGridRow = new Adw.SwitchRow({
            title: 'Snap to Grid (Floating Mode)',
        });
        behaviorGroup.add(snapToGridRow);
        gioSettings.bind(
            'snap-to-grid',
            snapToGridRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Smart Gaps
        const smartGapsRow = new Adw.SwitchRow({
            title: 'Smart Gaps',
        });
        behaviorGroup.add(smartGapsRow);
        gioSettings.bind(
            'smart-gaps',
            smartGapsRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Mouse Cursor Follows Active Window
        const mouseFollowsRow = new Adw.SwitchRow({
            title: 'Mouse Cursor Follows Active Window',
        });
        behaviorGroup.add(mouseFollowsRow);
        gioSettings.bind(
            'mouse-cursor-follows-active-window',
            mouseFollowsRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Mouse Cursor Focus Position
        const focusPositionRow = new Adw.ComboRow({
            title: 'Mouse Cursor Focus Position',
            model: new Gtk.StringList({
                strings: Object.values(FocusPosition),
            }),
        });
        behaviorGroup.add(focusPositionRow);
        gioSettings.bind(
            'mouse-cursor-focus-location',
            focusPositionRow,
            'selected',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Group: Layout
        const layoutGroup = new Adw.PreferencesGroup({
            title: 'Layout',
        });
        page.add(layoutGroup);

        // Active Hint Width
        const activeHintWidthRow = new Adw.SpinRow({
            title: 'Active Hint Width',
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 100,
                step_increment: 1,
            }),
        });
        layoutGroup.add(activeHintWidthRow);
        gioSettings.bind(
            'active-hint-border-width',
            activeHintWidthRow,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Gap Width
        const gapWidthRow = new Adw.SpinRow({
            title: 'Gap Width',
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 100,
                step_increment: 1,
            }),
        });
        layoutGroup.add(gapWidthRow);
        // Bind both inner and outer gaps to this single control as per original logic
        // Original logic: if (inner == outer) show inner; on set, set both.
        // Here we bind to inner, and listen to change to set outer.
        gioSettings.bind(
            'gap-inner',
            gapWidthRow,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        gapWidthRow.connect('notify::value', () => {
             gioSettings.set_uint('gap-outer', gapWidthRow.get_value());
        });


        // Group: Advanced
        const advancedGroup = new Adw.PreferencesGroup({
            title: 'Advanced',
        });
        page.add(advancedGroup);

        // Log Level
        // LOG_LEVELS is numeric enum 0..4
        // We need to map names.
        const logLevels = ['OFF', 'ERROR', 'WARN', 'INFO', 'DEBUG'];
        const logLevelRow = new Adw.ComboRow({
            title: 'Log Level',
            model: new Gtk.StringList({
                strings: logLevels,
            }),
        });
        advancedGroup.add(logLevelRow);
        gioSettings.bind(
            'log-level',
            logLevelRow,
            'selected',
            Gio.SettingsBindFlags.DEFAULT
        );
    }
}
