/*
 * iPad Display for GNOME 42.
 *
 * Top-bar menu: an iPad icon that starts/stops ipad-display (a systemd user
 * service), shows the pairing QR code and PIN, and lets you pick orientation,
 * position and Wi-Fi/USB. The service writes its state to
 * $XDG_RUNTIME_DIR/ipad-display/status.json; options go to
 * ~/.config/ipad-display/service.env.
 *
 * Window helper: GNOME never resizes a window that moves to another monitor,
 * so a window dragged onto the (smaller) iPad sticks out. Windows that land on
 * the ipad-display monitor fill it, like an iPad app:
 *  - dropped there after a drag, moved there with Super+Shift+arrow, or
 *    opened there: maximized;
 *  - windows that cannot be maximized, and dialogs: shrunk and moved so they
 *    fit inside the iPad screen.
 * Dragging a maximized window back off the iPad restores its old size (GNOME
 * does that by itself). The iPad monitor is the one with a "Meta-N" connector,
 * the virtual monitor ipad-display creates.
 */
'use strict';

const { Gio, GLib, GObject, Meta, St } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ByteArray = imports.byteArray;

const SERVICE = 'ipad-display.service';
const RUN_DIR = GLib.build_filenamev([GLib.get_user_runtime_dir(), 'ipad-display']);
const STATUS_FILE = GLib.build_filenamev([RUN_DIR, 'status.json']);
const CONF_DIR = GLib.build_filenamev([GLib.get_user_config_dir(), 'ipad-display']);
const ENV_FILE = GLib.build_filenamev([CONF_DIR, 'service.env']);

let indicator = null;
let signals = [];
const grabbed = new Set();

// --- window helper -------------------------------------------------------

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

// --- service control -----------------------------------------------------

function run(argv, callback) {
    try {
        const proc = Gio.Subprocess.new(argv,
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
        proc.communicate_utf8_async(null, null, (p, res) => {
            let out = '';
            try {
                [, out] = p.communicate_utf8_finish(res);
            } catch (e) {
                logError(e, 'ipad-display');
            }
            if (callback)
                callback((out || '').trim());
        });
    } catch (e) {
        logError(e, 'ipad-display');
    }
}

const systemctl = (args, callback) => run(['systemctl', '--user', ...args, SERVICE], callback);

function readText(path) {
    try {
        const [ok, bytes] = GLib.file_get_contents(path);
        return ok ? ByteArray.toString(bytes) : null;
    } catch (e) {
        return null;
    }
}

function readOptions() {
    // options the menu manages; anything else (e.g. --max-edge 2048 --scale 2) is kept as-is
    const opts = { orientation: 'landscape', position: 'left', usb: false, extra: [] };
    const text = readText(ENV_FILE) || '';
    const args = (text.match(/IPAD_DISPLAY_ARGS=(.*)/) || [])[1] || '';
    const words = args.trim().split(/\s+/).filter(w => w);
    for (let i = 0; i < words.length; i++) {
        if (words[i] === '--orientation')
            opts.orientation = words[++i];
        else if (words[i] === '--position')
            opts.position = words[++i];
        else if (words[i] === '--usb')
            opts.usb = true;
        else
            opts.extra.push(words[i]);
    }
    return opts;
}

function writeOptions(opts) {
    GLib.mkdir_with_parents(CONF_DIR, 0o700);
    const args = [`--orientation ${opts.orientation} --position ${opts.position}`,
        opts.usb ? '--usb' : '', ...opts.extra].filter(a => a).join(' ');
    GLib.file_set_contents(ENV_FILE, `# written by the iPad Display top-bar menu\nIPAD_DISPLAY_ARGS=${args}\n`);
}

// --- top-bar menu --------------------------------------------------------

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'iPad Display');
        this._icon = new St.Icon({ icon_name: 'computer-apple-ipad-symbolic', style_class: 'system-status-icon' });
        this.add_child(this._icon);
        this._opts = readOptions();
        this._running = false;

        this._switch = new PopupMenu.PopupSwitchMenuItem('iPad 显示器 / iPad display', false);
        this._switch.connect('toggled', (_item, on) => {
            if (on)
                writeOptions(this._opts);  // make sure the service gets the options shown here
            systemctl([on ? 'start' : 'stop'], () => this._refresh());
        });
        this.menu.addMenuItem(this._switch);

        this._statusItem = new PopupMenu.PopupMenuItem('', { reactive: false });
        this.menu.addMenuItem(this._statusItem);

        this._qrItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
        this._qr = new St.Icon({ icon_size: 200, x_expand: true });
        this._qrItem.add_child(this._qr);
        this.menu.addMenuItem(this._qrItem);
        this._pinItem = new PopupMenu.PopupMenuItem('', { reactive: false });
        this.menu.addMenuItem(this._pinItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._choices = [
            this._addChoice('方向 / Orientation', 'orientation',
                [['landscape', '横屏 Landscape'], ['portrait', '竖屏 Portrait']]),
            this._addChoice('位置 / Position', 'position',
                [['left', '左 Left'], ['right', '右 Right'], ['above', '上 Above'], ['below', '下 Below']]),
            this._addChoice('连接 / Connection', 'usb', [[false, 'Wi-Fi'], [true, 'USB']]),
        ];

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._autostart = new PopupMenu.PopupSwitchMenuItem('登录时启动 / Start at login', false);
        this._autostart.connect('toggled', (_item, on) => systemctl([on ? 'enable' : 'disable']));
        this.menu.addMenuItem(this._autostart);

        this.menu.connect('open-state-changed', (_menu, open) => {
            if (open)
                this._refresh();
        });
        this._monitor = Gio.File.new_for_path(STATUS_FILE).monitor_file(Gio.FileMonitorFlags.NONE, null);
        this._monitor.connect('changed', () => this._showStatus());
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
            this._refresh();
            return GLib.SOURCE_CONTINUE;
        });
        this._refresh();
    }

    _addChoice(title, key, options) {
        const sub = new PopupMenu.PopupSubMenuMenuItem(title);
        const items = options.map(([value, label]) => {
            const item = new PopupMenu.PopupMenuItem(label);
            item.connect('activate', () => {
                if (this._opts[key] === value)
                    return;
                this._opts[key] = value;
                writeOptions(this._opts);
                this._updateChoices();
                if (this._running)
                    systemctl(['restart'], () => this._refresh());
            });
            sub.menu.addMenuItem(item);
            return [value, label, item];
        });
        this.menu.addMenuItem(sub);
        const choice = { title, key, sub, items };
        this._updateChoice(choice);
        return choice;
    }

    _updateChoice(choice) {
        for (const [value, label, item] of choice.items) {
            const on = this._opts[choice.key] === value;
            item.setOrnament(on ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE);
            if (on)
                choice.sub.label.text = `${choice.title}: ${label}`;
        }
    }

    _updateChoices() {
        this._choices.forEach(c => this._updateChoice(c));
    }

    _refresh() {
        systemctl(['is-active'], state => {
            this._running = state === 'active' || state === 'activating';
            this._switch.setToggleState(this._running);
            this._showStatus();
        });
        systemctl(['is-enabled'], state => this._autostart.setToggleState(state === 'enabled'));
    }

    _showStatus() {
        let s = {};
        try {
            s = JSON.parse(readText(STATUS_FILE) || '{}');
        } catch (e) {
            s = {};
        }
        const running = this._running;
        let text;
        if (!running)
            text = '已关闭 / Off';
        else if (s.clients > 0)
            text = `iPad 已连接 / connected · ${s.monitor || ''}`;
        else if (s.waiting_usb)
            text = '等待 USB 连接的 iPad… / waiting for the iPad on USB…';
        else if (s.url)
            text = '扫码或打开主屏幕图标 / scan the code or open the home-screen icon';
        else
            text = '正在启动… / starting…';
        this._statusItem.label.text = text;

        const showPairing = running && s.url && !(s.clients > 0);
        this._qrItem.visible = !!(showPairing && s.qr && GLib.file_test(s.qr, GLib.FileTest.EXISTS));
        if (this._qrItem.visible)
            this._qr.gicon = Gio.FileIcon.new(Gio.File.new_for_path(s.qr));
        this._pinItem.visible = !!showPairing;
        if (showPairing)
            this._pinItem.label.text = s.pin ? `${s.url}   配对码 PIN ${s.pin}` : s.url;

        this._icon.opacity = running ? 255 : 110;
    }

    destroy() {
        if (this._timer) {
            GLib.source_remove(this._timer);
            this._timer = 0;
        }
        if (this._monitor) {
            this._monitor.cancel();
            this._monitor = null;
        }
        super.destroy();
    }
});

// --- extension entry points ----------------------------------------------

function init() {
}

function enable() {
    indicator = new Indicator();
    Main.panel.addToStatusArea('ipad-display', indicator);

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
    if (indicator) {
        indicator.destroy();
        indicator = null;
    }
}
