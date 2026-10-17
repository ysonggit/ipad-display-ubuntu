#!/bin/sh
# Install the iPad Display top-bar menu (GNOME Shell extension) and its background service.
# On Wayland GNOME only loads new extensions at login: log out and back in afterwards.
set -e
UUID=ipad-display-helper@ysonggit.github.io
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(dirname "$HERE")
EXT=$HOME/.local/share/gnome-shell/extensions/$UUID
UNITS=$HOME/.config/systemd/user

# 1. extension
mkdir -p "$EXT"
cp "$HERE/$UUID"/metadata.json "$HERE/$UUID"/extension.js "$EXT"/

# 2. user service, pointing at this checkout
mkdir -p "$UNITS"
sed "s|@SCRIPT@|$REPO/ipad-display|" "$REPO/contrib/ipad-display.service" > "$UNITS/ipad-display.service"
# the older USB-only service is replaced by the menu
if [ -f "$UNITS/ipad-display-usb.service" ]; then
    systemctl --user disable --now ipad-display-usb.service 2>/dev/null || true
    rm -f "$UNITS/ipad-display-usb.service"
fi
systemctl --user daemon-reload

# 3. default options (the menu changes them)
CONF=$HOME/.config/ipad-display
if [ ! -f "$CONF/service.env" ]; then
    mkdir -p "$CONF"
    printf '# written by the iPad Display top-bar menu\nIPAD_DISPLAY_ARGS=--orientation landscape --position left\n' \
        > "$CONF/service.env"
fi

# 4. enable the extension (works before the shell has seen it)
python3 - "$UUID" <<'EOF'
import ast, subprocess, sys
uuid = sys.argv[1]
cur = subprocess.run(["gsettings", "get", "org.gnome.shell", "enabled-extensions"],
                     capture_output=True, text=True).stdout.strip()
lst = ast.literal_eval(cur.replace("@as ", "")) if cur else []
if uuid not in lst:
    lst.append(uuid)
    subprocess.run(["gsettings", "set", "org.gnome.shell", "enabled-extensions", str(lst)], check=True)
EOF

command -v qrencode >/dev/null || echo "tip: sudo apt install qrencode   (QR code in the menu)"
echo "installed: top-bar menu + ipad-display.service"
echo "log out and back in once, then click the iPad icon in the top bar"
