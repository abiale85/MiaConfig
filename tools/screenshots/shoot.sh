#!/usr/bin/env bash
# Rigenera le immagini dei widget per il README a partire dal codice vero di www/mia-config-widgets.js,
# con dati di esempio (demo.html) e Chrome headless. Uso: bash tools/screenshots/shoot.sh
set -euo pipefail
cd "$(dirname "$0")"
DIR="$(pwd -W 2>/dev/null || pwd)"
IMAGES="$DIR/../../images"
CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"

# Icone MDI per il finto <ha-icon> (una volta sola)
if [ ! -f icons.js ]; then
    [ -d node_modules/@mdi/js ] || npm install --no-save --silent @mdi/js
    node build-icons.mjs
fi

shot() {
    "$CHROME" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$DIR/.profile" \
        --force-device-scale-factor=2 --allow-file-access-from-files --virtual-time-budget=3000 \
        --window-size="$2" --screenshot="$IMAGES/$3" "file:///$DIR/demo.html?view=$1" >/dev/null 2>&1
    echo "images/$3"
}

shot widgets 980,470 widget.png
shot entity 980,630 widget-entita-scorciatoie.png
shot dialog 980,560 widget-popup.png
