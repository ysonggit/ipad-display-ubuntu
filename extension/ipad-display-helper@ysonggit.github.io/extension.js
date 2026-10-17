/*
 * iPad Display helper. GNOME never resizes a window that moves to another
 * monitor, so a window dragged onto the (smaller) iPad sticks out. This makes
 * windows that land on the ipad-display monitor fill it, like an iPad app:
 *
 *  - dropped there after a drag, moved there with Super+Shift+arrow, or
 *    opened there: maximized;
 *  - windows that cannot be maximized, and dialogs: shrunk and moved so they
 *    fit inside the iPad screen.
 *
 * Dragging a maximized window back off the iPad restores its old size (GNOME
 * does that by itself). The iPad monitor is the one with a "Meta-N" connector,
 * the virtual monitor ipad-display creates.
 */
'use strict';

const { GLib, Meta } = imports.gi;

let signals = [];
const grabbed = new Set();

function monitorManager() {
    return global.backend ? global.backend.get_monitor_manager() : Meta.MonitorManager.get();
}

function ipadMonitor() {
    const mm = monitorManager();
    const forced = GLib.getenv('IPAD_DISPLAY_CONNECTOR');  // test hook: treat this connector as the iPad
    if (forced)
        return mm.get_monitor_for_connector(forced);
    for (let i = 0; i < 8; i++) {
        const index = mm.get_monitor_for_connector(`Meta-${i}`);
        if (index >= 0)
            return index;
    }
    return -1;
}

function fit(win) {
    // only ordinary app windows: not desktop-icon (DING) or other helper windows, not fullscreen ones
    if (!win || win.get_window_type() !== Meta.WindowType.NORMAL || win.is_skip_taskbar() ||
        win.is_override_redirect() || win.is_fullscreen())
        return;
    const index = ipadMonitor();
    if (index < 0 || win.get_monitor() !== index)
        return;

    // dialogs attached to a parent window are only made to fit, never maximized
    if (win.can_maximize() && !win.get_transient_for()) {
        if (win.get_maximized() !== Meta.MaximizeFlags.BOTH)
            win.maximize(Meta.MaximizeFlags.BOTH);
        return;
    }

    const area = win.get_work_area_for_monitor(index);
    const rect = win.get_frame_rect();
    const w = Math.min(rect.width, area.width);
    const h = Math.min(rect.height, area.height);
    const x = Math.min(Math.max(rect.x, area.x), area.x + area.width - w);
    const y = Math.min(Math.max(rect.y, area.y), area.y + area.height - h);
    if (w !== rect.width || h !== rect.height || x !== rect.x || y !== rect.y)
        win.move_resize_frame(true, x, y, w, h);
}

// Act once the current event has been handled (and the window has settled).
function fitLater(win) {
    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
        fit(win);
        return GLib.SOURCE_REMOVE;
    });
}

function init() {
}

function enable() {
    const display = global.display;
    signals = [
        // Mouse drags: wait for the drop, not every monitor crossed on the way.
        display.connect('grab-op-begin', (_d, win) => {
            if (win)
                grabbed.add(win);
        }),
        display.connect('grab-op-end', (_d, win) => {
            if (!win)
                return;
            grabbed.delete(win);
            fitLater(win);
        }),
        // Keyboard moves (Super+Shift+arrows) and anything else that is not a drag.
        display.connect('window-entered-monitor', (_d, _index, win) => {
            if (!grabbed.has(win))
                fitLater(win);
        }),
        // Windows opened on the iPad.
        display.connect('window-created', (_d, win) => fitLater(win)),
    ];
}

function disable() {
    signals.forEach(id => global.display.disconnect(id));
    signals = [];
    grabbed.clear();
}
