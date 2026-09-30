# Testing

This document provides a guideline for testing and verifying the expected behaviors of the project. When a patch is ready for testing, the checklists may be copied and marked as they are proven to be working.

## Logs

To begin watching logs, open a terminal with the following command:

```bash
journalctl -o cat -n 0 -f "$(which gnome-shell)" | grep -v warning
```

Note that because the logs are from GNOME Shell, there will be messages from all installed extensions, and GNOME Shell itself. GNOME Mosaic is fairly chatty though, so the majority of the logs should be from GNOME Mosaic. GNOME Mosaic logs are usually prepended with `gnome-mosaic:`, but sometimes GNOME has internal errors and warnings surrounding those logs that could be useful for pointing to an issue that we can resolve in GNOME Mosaic.

## Checklists

Tasks for a tester to verify when approving a patch. Use complex window layouts and at least two displays. Turn on active hint during testing.

## With tiling enabled

### Tiling

- [ ] Super direction keys changes focus in the correct direction
- [ ] Windows moved with the keyboard tile into place
- [ ] Windows moved with the mouse tile into place
- [ ] Windows swap with the keyboard (test with different size windows)
- [ ] Windows can be resized with the keyboard (Test resizing four windows above, below, right, and left to ensure shortcut consistency)
- [ ] Windows can be resized with the mouse
- [ ] Minimizing a window detaches it from the tree and re-tiles remaining windows
- [ ] Unminimizing a window re-tiles the window
- [ ] Maximizing with the keyboard (`Super` + `M`) covers tiled windows
- [ ] Unmaximizing with keyboard (`Super` + `M`) re-tiles into place
- [ ] Maximizing with the mouse covers tiled windows
- [ ] Unmaximizing with mouse re-tiles into place
- [ ] Full-screening removes the active hint and full-screens on one display
- [ ] Unfull-screening adds the active hint and re-tiles into place
- [ ] Maximizing a YouTube video fills the screen and unmaximizing retiles the browser in place
- [ ] VIM shortcuts work as direction keys
- [ ] `Super` + `O` changes window orientation
- [ ] `Super` + `G` floats and then re-tiles a window
- [ ] Float a window with `Super` + `G`. It should be movable and resizeable in window management mode with keyboard keys
- [ ] `Super` + `Q` Closes a window
- [ ] Turn off auto-tiling. New windows launch floating.
- [ ] Turn on auto-tiling. Windows automatically tile.
- [ ] Disabling and enabling auto-tiling correctly handles minimized, maximized, fullscreen, floating, and non-floating windows (This test needs a better definition, steps, or to be separated out.)

### Workspaces

- [ ] Windows can be moved to another workspace with the keyboard
- [ ] Windows can be moved to another workspace with the mouse
- [ ] Windows can be moved to workspaces between existing workspaces
- [ ] Moving windows to another workspace re-tiled the previous and new workspace
- [ ] Active hint is present on the new workspace and once the window is returned to its previous workspace
- [ ] Floating windows move across workspaces
- [ ] Remove windows from the 2nd worspace in a 3 workspace setup. The 3rd workspace becomes the 2nd workspace, and tiling is unaffected by the move.

### Displays

- [ ] Windows move across displays in adjustment mode with direction keys
- [ ] Windows move across displays with the mouse
- [ ] Changing the primary display moves the top bar. Window heights adjust on all monitors for the new position.
- [ ] Unplug a display - windows from the display retile on a new workspace on the remaining display
- [ ] Plug an additional display into a laptop - windows and workspaces don't changes
- [ ] NOTE: Add vertical monitor layout test

#### Display Re-layout

Unplugging a display must re-home each tiling tree onto the remaining display while keeping its
layout: the same splits, the same orientations, the same ratios, and the same window order. Only
the monitor and the area may change.

- [ ] 2 monitors, 4 workspaces each, a distinct tree shape per workspace. Unplug one display. The
      surviving display ends up with 8 workspaces and every tree keeps its original split ratios,
      orientations, and window order. The unplugged display's workspaces land as 4-7, in order.
- [ ] 2 monitors, one tree each. Unplug one display. No extra workspace is allocated and the
      surviving tree keeps its shape.
- [ ] Unplug the **primary** display. The top bar moves and the layout is still intact. Windows from
      the old primary should not jump to a different relative position.
- [ ] Re-plug a display that was just unplugged. Recovery is symmetric and no tree is orphaned.
- [ ] Unplug two of three displays at once. All surviving trees keep their shapes and order.
- [ ] Rearrange monitors (change which is left/right) without unplugging. Nothing moves between
      workspaces and no tree is disturbed.
- [ ] Change a monitor's resolution. Trees re-area but keep their splits, and no workspace is added.
- [ ] Unplug a display that has no tiled windows on it. Nothing else is disturbed.
- [ ] With `workspaces-only-on-primary` enabled, unplug a display. One tree per monitor remains and
      no tree is orphaned.
- [ ] Unplug a display while a window is floating. The floating window is unaffected and does not
      consume a workspace slot.
- [ ] Unplug a display during the ~2s debounce window, then plug it back. The layout settles
      correctly and no duplicate workspaces appear.
- [ ] Unplug a display during an active drag/resize. The operation completes and the layout is
      preserved.
- [ ] After any unplug, check `Mosaic` in the journal: no `more than one tree wants workspace 0`
      warning unless `workspaces-only-on-primary` is on.
- [ ] After any unplug, switching to each migrated workspace shows a fully tiled tree. No workspace
      is left empty or half-tiled.

### Window Titles

- [ ] Disabling window titles using global (GNOME Mosaic) option works for Shell Shortcuts, LibreOffice, etc.
- [ ] Disabling window titles in Firefox works (Check debian and flatpak packages)

### Floating Exceptions

- [ ] Add a window to floating exceptions-- it should float immediately.
- [ ] Close and re-open the window-- it should float when opened.
- [ ] Add an app to floating exceptions-- it should float immediately.
- [ ] Close and re-open the app-- it should float when opened.

## With Tiling Disabled

### Tiling

- [ ] Super direction keys changes focus in the correct direction
- [ ] Windows can be moved with the keyboard
- [ ] Windows can be moved with the mouse
- [ ] Windows swap with the keyboard (test with different size windows)
- [ ] Windows can be resized with the keyboard
- [ ] Windows can be resized with the mouse
- [ ] Windows can be half-tiled left and right with `Ctrl` + `Super` + `left`/`right`

### Displays

- [ ] Windows move across displays in adjustment mode with directions keys
- [ ] Windows move across displays with the mouse

### Miscellaneous

- [ ] Close all windows-- no icons should be active in the GNOME launcher.
- [ ] Open a window, enable tiling, stack the window, move to a different workspace, and disable tiling. The window should not become visible on the empty workspace.
- [ ] With tiling still disabled, minimize the single window. The active hint should go away.
- [ ] Maximize a window, then open another app with the Activities overview. The newly-opened app should be visible and focused.
