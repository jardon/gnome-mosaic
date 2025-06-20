<h1 align="center">
  <img src="icons/mosaic-logo.svg" alt="Mosaic" width="192" height="192"/>
  <br>
  Mosaic
</h1>

Mosaic is a keyboard-driven layer for GNOME Shell which allows for quick and sensible navigation and management of windows. The core feature of Mosaic is the addition of advanced tiling window management — a feature that has been highly sought within our community. For many — ourselves included — i3wm has become the leading competitor to the GNOME desktop.

Tiling window management in GNOME is virtually nonexistent, which makes the desktop awkward to interact with when your needs exceed that of two windows at a given time. Luckily, GNOME Shell is an extensible desktop with the foundations that make it possible to implement a tiling window manager on top of the desktop.

Therefore, we see an opportunity here to advance the usability of the GNOME desktop to better accommodate the needs of our community with Mosaic. Advanced tiling window management is a must for the desktop, so we've merged i3-like tiling window management with the GNOME desktop for the best of both worlds.

[![](./screenshot.webp)](https://raw.githubusercontent.com/jardon/gnome-mosaic/main/screenshot.webp)

---

## Table of Contents

- [The Problem](#the-problem): Why we need this in GNOME
- [Installation](#installation): For those wanting to install this on their distribution
- The Solution:
    - [Shared Features](#shared-features): Behaviors shared between stacking and auto-tiling modes
    - [Floating Mode](#floating-mode): Behaviors specific to the floating mode
    - [Tiling Mode](#tiling-mode): Behaviors specific to the auto-tiling mode
- [Developers](#developers): Guide for getting started with development

---

## The Problem

So, why is this a problem for us, and why do so many of our users switch to i3wm?

### Displays are large, and windows are many

GNOME currently only supports half-tiling, which tiles one window to one side of the screen, and another window to the other side of the screen. If you have more than two windows, it is expected to place them on separate workspaces, monitors, or to alternate between windows with `Alt` + `Tab`.

This tends to work fine if you only have a small handful of applications. If you need more than two windows at a time on a display, your only option is to manually drag windows into position, and resize them to fit alongside each other — a very time-consuming process that could easily be automated and streamlined.

### Displays are large. Very, **very** large

Suppose you are a lucky — or perhaps unlucky — owner of an ultra-wide display. A maximized window will have much of its preferences and controls dispersed across the far left and far right corners. The application may place a panel with buttons on the far left, while other buttons get shifted to either the distant center or far right.

Half-tiling in this scenario means that each window will be as large as an entire 2560x1440 or 4K display. In either scenario, at such extreme sizes, the mouse becomes completely useless — and applications become unbearable to use — in practice.

### Fighting the window manager is futile

As you struggle with fighting the window manager, it quickly becomes clear that any attempt to manage windows in a traditional stacking manner — where you need to manually move windows into place, and then manually resize them — is futile. Humans are nowhere near as precise or as quick as algorithms at aligning windows alongside each other on a display.

### Why not switch to i3wm?

The GNOME desktop comes with many useful desktop integration features, which are lost when switching to an i3wm session. Although possible to connect various GNOME session services to an i3wm session, much of the GNOME desktop experience is still lost in the process. The application overview, the GNOME panel, and GNOME extensions.

Even worse, many users are completely unfamiliar with tiling window managers, and may never feel comfortable switching "cold turkey" to one. By offering tiling window management as a feature that can be opted into, we can empower the user to ease into gaining greater control over their desktop, so that the idea of tiling window management suddenly becomes accessible.

There are additionally those who do want the traditional stacking window management experience, but they also want to be able to opt into advanced tiling window management, too. So it should be possible to opt into tiling window management as necessary. Other operating systems have successfully combined tiling window management features with the traditional stacking window management experience, and we feel that we can do this with GNOME as well.

---

## Installation

GNU Make and TypeScript are also required to build the project.

Proper functionality of the shell requires modifying GNOME's default keyboard shortcuts. For a local installation, run `make local-install`.

If you want to uninstall the extension, you may invoke `make uninstall`, and then open the "Keyboard Shortcuts" panel in GNOME Settings to select the "Reset All.." button in the header bar.

> Note that if you are packaging for your Linux distribution, many features in Mosaic will not work out of the box because they require changes to GNOME's default keyboard shortcuts. A local install is necessary if you aren't packaging your GNOME session with these default keyboard shortcuts unset or changed.

## Shared Features

Features that are shared between stacking and auto-tiling modes.

### Directional Keys

These are key to many of the shortcuts utilized by tiling window managers. This document will henceforth refer to these keys as `<Direction>`, which default to the following keys:

- `Left` or `h`
- `Down` or `j`
- `Up` or `k`
- `Right` or `l`

### Overridden GNOME Shortcuts

- `Super` + `q`: Close window
- `Super` + `m`: Maximize the focused window
- `Super` + `,`: Minimize the focused window
- `Super` + `Esc`: Lock screen
- `Super` + `f`: Files
- `Super` + `e`: Email
- `Super` + `b`: Web Browser
- `Super` + `t`: Terminal

### Window Management Mode

> This mode is activated with `Super` + `Return`.

Window management mode activates additional keyboard control over the size and location of the currently-focused window. The behavior of this mode changes slightly based on whether you are in auto-tile mode, or in the default stacking mode. In the default mode, an overlay is displayed snapped to a grid, which represents a possible future location and size of your focused window. This behavior changes slightly in auto-tiling mode, where resizes are performed immediately and overlays are only shown when swapping windows.

Activating this enables the following behaviors:

- `<Direction>`
    - In default mode, this will move the displayed overlay around based on a grid
    - In auto-tile mode, this will resize the window
- `Shift` + `<Direction>`
    - In default mode, this will resize the overlay
    - In auto-tile mode, this will do nothing
- `Ctrl` + `<Direction>`
    - Selects a window in the given direction of the overlay
    - When `Return` is pressed, window positions will be swapped
- `Shift` + `Ctrl` + `<Direction>`
    - In auto-tile mode, this resizes in the opposite direction
- `O`: Toggles between horizontal and vertical tiling in auto-tile mode
- `~`: Toggles between floating and tiling in auto-tile mode
- `Return`: Applies the changes that have been requested
- `Esc`: Cancels any changes that were requested

### Window Focus Switching

When not in window management mode, pressing `Super` + `<Direction>` will shift window focus to a window in the given direction. This is calculated based on the distance between the center of the side of the focused window that the window is being shifted from, and the opposite side of windows surrounding it.

Switching focus to the left will calculate from the center of the east side of the focused window to the center of the west side of all other windows. The window with the least distance is the window we pick.

<!-- ### Launcher

Mosaic provides an integrated launcher which interfaces directly with our [mosaic-launcher](https://github.com/pop-os/launcher) service. JSON IPC is used to communicate between the shell and the launcher in an asynchronous fashion. This functionality was separated from the shell due to performance and maintainability issues. The new launcher is written in Rust and fully async. The launcher has extensive features that would be useful for implementing desktop launchers beyond a shell extension. -->

### Inner and Outer Gaps

Gaps improve the aesthetics of tiled windows and make it easier to grab the edge of a specific window. We've decided to add support for inner and outer gaps, and made these settings configurable in the extension's popup menu.

### Hiding Window Title Bars

Windows with server-side decorations may have their title bars completely hidden, resulting in additional screen real estate for your applications, and a visually cleaner environment. This feature can be toggled in the extension's popup menu. Windows can be moved with the mouse by holding `Super` when clicking and dragging a window to another location, or using the keyboard shortcuts native to gnome-mosaic. Windows may be closed by pressing `Super` + `Q`, and maximized with `Super` + `M`.

---

## Floating Mode

This is the default mode of Mosaic, which combines traditional stacking window management, with optional tiling window management features.

### Display Grid

In this mode, displays are split into a grid of columns and rows. When entering tile mode, windows are snapped to this grid as they are placed. The number of rows and columns are configurable in the extension's popup menu in the panel.

### Snap-to-Grid

An optional feature to improve your tiling experience is the ability to snap windows to the grid when using your mouse to move and resize them. This provides the same precision as entering window management mode to position a window with your keyboard, but with the convenience and familiarity of a mouse. This feature can be enabled through the extension's popup menu.

---

## Tiling Mode

Disabled by default, this mode manages windows using a tree-based tiling window manager. Similar to i3, each node of the tree represents two branches. A branch may be a window, a fork containing more branches, or a stack that contains many windows. Each branch represents a rectangular area of space on the screen, and can be subdivided by creating more branches inside of a branch. As windows are created, they are assigned to the window or stack that is actively focused, which creates a new fork on a window, or attaches the window to the focused stack. As windows are destroyed, the opposite is performed to compress the tree and rearrange windows to their new dimensions.

### Keyboard Shortcuts

- `Super` + `O`
    - Toggles the orientation of a fork's tiling orientation
- `Super` + `G`
    - Toggles a window between floating and tiling.
    - See [#customizing the window float list](#customizing-the-floating-window-list)

### Customizing the Floating Window List

There is file `$XDG_CONFIG_HOME/gnome-mosaic/config.json` where you can add the following structure:

```
{
  class: "<WM_CLASS String from xprop>",
  title: "<Optional Window Title>"
}
```

For example, doing `xprop` on GNOME Settings (or GNOME Control Center), the WM_CLASS values are `gnome-control-center` and `Gnome-control-center`. Use the second value (Gnome-control-center), which gnome-mosaic will read. The `title` field is optional.

After applying changes in `config.json`, you can reload the tiling if it doesn't work the first time.

## Developers

Due to the risky nature of plain JavaScript, this GNOME Shell extension is written in [TypeScript](https://www.typescriptlang.org/). In addition to supplying static type-checking and self-documenting classes and interfaces, it allows us to write modern JavaScript syntax whilst supporting the generation of code for older targets.

Please install the following as dependencies when developing:

- [`Node.js`](https://nodejs.org/en/) LTS+ (v12+)
- Latest `npm` (comes with NodeJS)
- `npm install typescript@latest`

While working on the shell, you can recompile, reconfigure, reinstall, and restart GNOME Shell with logging with `make debug`. Note that this only works reliably in X11 sessions, since Wayland will exit to the login screen on restarting the shell.

## License

Licensed under the GNU General Public License, Version 3.0, ([LICENSE](LICENSE) or https://www.gnu.org/licenses/gpl-3.0.en.html)

### Contribution

Any contribution intentionally submitted for inclusion in the work by you shall be licensed under the GNU GPLv3.
