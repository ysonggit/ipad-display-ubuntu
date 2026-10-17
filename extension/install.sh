#!/bin/sh
# Install the iPad Display helper GNOME Shell extension for this user.
# On Wayland GNOME only loads new extensions at login: log out and back in afterwards.
set -e
UUID=ipad-display-helper@ysonggit.github.io
SRC=$(dirname "$0")/$UUID
DST=$HOME/.local/share/gnome-shell/extensions/$UUID

mkdir -p "$DST"
cp "$SRC"/metadata.json "$SRC"/extension.js "$DST"/

# add to enabled-extensions (works before the shell has seen the extension)
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

echo "installed $UUID"
echo "log out and back in to load it (GNOME on Wayland cannot reload extensions live)"
