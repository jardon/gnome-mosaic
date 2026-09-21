import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import {
    ExtensionPreferences,
    gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as settings from './settings.js';
import {FocusPosition} from './focus.js';

export default class MosaicPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window: any) {
        const extSettings = new settings.ExtensionSettings();
        const gioSettings = extSettings.ext;

        const general = generateGeneralPage(gioSettings);
        window.add(general);

        const kb = generateKeyBindingsPage(gioSettings);
        window.add(kb);
    }
}

function generateKeyBindingsPage(gioSettings: any) {
    const page = new Adw.PreferencesPage({
        title: _('Keybindings'),
    });

    // Group: Focus
    const focusGroup = new Adw.PreferencesGroup({
        title: _('Focus'),
    });
    page.add(focusGroup);
    addKeybindingRows(focusGroup, gioSettings, [
        ['focus-left', _('Focus left window')],
        ['focus-down', _('Focus down window')],
        ['focus-up', _('Focus up window')],
        ['focus-right', _('Focus right window')],
        ['toggle-tiling', _('Toggle auto-tiling')],
        ['toggle-floating', _('Toggle floating/tiling mode')],
        ['tile-orientation', _('Toggle tiling orientation')],
    ]);

    const tilingGroup = new Adw.PreferencesGroup({
        title: _('Tiling'),
    });
    page.add(tilingGroup);
    addKeybindingRows(tilingGroup, gioSettings, [
        ['tile-enter', _('Enter adjustment mode')],
        ['tile-accept', _('Accept tiling changes')],
        ['tile-reject', _('Reject tiling changes')],
        [
            'management-orientation',
            _('Toggle tiling orientation (adjustment mode)'),
        ],
        ['tile-move-left', _('Move window left')],
        ['tile-move-down', _('Move window down')],
        ['tile-move-up', _('Move window up')],
        ['tile-move-right', _('Move window right')],
        ['tile-move-left-global', _('Move window left (global)')],
        ['tile-move-down-global', _('Move window down (global)')],
        ['tile-move-up-global', _('Move window up (global)')],
        ['tile-move-right-global', _('Move window right (global)')],
    ]);

    const resizeGroup = new Adw.PreferencesGroup({
        title: _('Resizing'),
    });
    page.add(resizeGroup);
    addKeybindingRows(resizeGroup, gioSettings, [
        ['resize-mode', _('Toggle resize mode')],
        ['resize-grow-left', _('Grow window left')],
        ['resize-shrink-left', _('Shrink window left')],
        ['resize-grow-up', _('Grow window up')],
        ['resize-shrink-up', _('Shrink window up')],
        ['resize-grow-right', _('Grow window right')],
        ['resize-shrink-right', _('Shrink window right')],
        ['resize-grow-down', _('Grow window down')],
        ['resize-shrink-down', _('Shrink window down')],
    ]);

    const windowGroup = new Adw.PreferencesGroup({
        title: _('Window Management'),
    });
    page.add(windowGroup);
    addKeybindingRows(windowGroup, gioSettings, [
        ['tile-swap-left', _('Swap window left')],
        ['tile-swap-down', _('Swap window down')],
        ['tile-swap-up', _('Swap window up')],
        ['tile-swap-right', _('Swap window right')],
    ]);

    const workspaceGroup = new Adw.PreferencesGroup({
        title: _('Workspace Management'),
    });
    page.add(workspaceGroup);
    addKeybindingRows(workspaceGroup, gioSettings, [
        ['mosaic-workspace-up', _('Move window to the upper workspace')],
        ['mosaic-workspace-down', _('Move window to the lower workspace')],
        ['mosaic-monitor-up', _('Move window to the upper monitor')],
        ['mosaic-monitor-down', _('Move window to the lower monitor')],
        ['mosaic-monitor-left', _('Move window to the leftward monitor')],
        ['mosaic-monitor-right', _('Move window to the rightward monitor')],
    ]);

    return page;
}

function addKeybindingRows(
    group: any,
    settings: any,
    keys: [string, string][]
) {
    for (const [settingKey, title] of keys) {
        group.add(createKeybindingRow(settings, settingKey, title));
    }
}

function generateGeneralPage(gioSettings: any) {
    const page = new Adw.PreferencesPage({
        title: _('General'),
    });
    // Group: Appearance
    const appearanceGroup = new Adw.PreferencesGroup({
        title: _('Appearance'),
    });
    page.add(appearanceGroup);

    // Active Hint
    const activeHintRow = new Adw.SwitchRow({
        title: _('Show Active Hint'),
    });
    appearanceGroup.add(activeHintRow);
    gioSettings.bind(
        'active-hint',
        activeHintRow,
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );

    // Show Window Titles
    const windowTitlesRow = new Adw.SwitchRow({
        title: _('Show Window Titles'),
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
        title: _('Show Indicator Panel'),
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
        title: _('Show Minimize to Tray Windows'),
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
        title: _('Behavior'),
    });
    page.add(behaviorGroup);

    // Snap to Grid
    const snapToGridRow = new Adw.SwitchRow({
        title: _('Snap to Grid (Floating Mode)'),
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
        title: _('Smart Gaps'),
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
        title: _('Mouse Cursor Follows Active Window'),
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
        title: _('Mouse Cursor Focus Position'),
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
        title: _('Layout'),
    });
    page.add(layoutGroup);

    // Active Hint Width
    const activeHintWidthRow = new Adw.SpinRow({
        title: _('Active Hint Width'),
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
        title: _('Gap Width'),
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
        title: _('Advanced'),
    });
    page.add(advancedGroup);

    // Log Level
    // LOG_LEVELS is numeric enum 0..4
    // We need to map names.
    const logLevels = ['OFF', 'ERROR', 'WARN', 'INFO', 'DEBUG'];
    const logLevelRow = new Adw.ComboRow({
        title: _('Log Level'),
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

    return page;
}

function createKeybindingRow(settings: any, settingKey: string, title: string) {
    const row = new Adw.ActionRow({
        title: title,
    });

    const button = new Gtk.Button({
        valign: Gtk.Align.CENTER,
        css_classes: ['flat'],
    });

    const updateLabel = () => {
        const accelerators = settings.get_strv(settingKey);
        if (accelerators.length > 0 && accelerators[0]) {
            button.label = accelerators[0];
        } else {
            button.label = _('Disabled');
        }
    };

    updateLabel();
    settings.connect(`changed::${settingKey}`, updateLabel);

    const stopCapture = (root: any) => {
        if (focusId !== 0) {
            root?.disconnect(focusId);
            focusId = 0;
        }

        if (keyController) {
            keyController.run_dispose();
            keyController = null;
        }

        updateLabel();
    };

    const keyPressed = (
        _controller: any,
        keyval: number,
        _keycode: number,
        state: number
    ) => {
        const mods = state & Gtk.accelerator_get_default_mod_mask();

        if (keyval === Gdk.KEY_Escape) {
            stopCapture(root);
            return Gdk.EVENT_STOP;
        }

        if (!Gtk.accelerator_valid(keyval, mods)) {
            return Gdk.EVENT_PROPAGATE;
        }

        const accelString = Gtk.accelerator_name(keyval, mods);

        if (accelString) {
            settings.set_strv(settingKey, [
                accelString.replace('<Control>', '<Primary>'),
            ]);
        }

        stopCapture(root);
        return Gdk.EVENT_STOP;
    };

    const startCapture = () => {
        stopCapture(root);

        button.label = _('New accelerator…');

        root = button.get_root();
        if (!root) {
            return;
        }

        keyController = new Gtk.EventControllerKey();
        root.add_controller(keyController);
        keyController.connect('key-pressed', keyPressed);

        focusId = root.connect('notify::focus-widget', () => {
            const focus = root.get_focus();
            if (
                focus === null ||
                (focus !== button && !focus.is_ancestor(button))
            ) {
                stopCapture(root);
            }
        });
    };

    let root: any = null;
    let keyController: any = null;
    let focusId: number = 0;

    button.connect('clicked', startCapture);

    row.add_suffix(button);
    return row;
}
