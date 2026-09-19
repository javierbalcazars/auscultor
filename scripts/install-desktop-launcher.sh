#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAUNCHER="$PROJECT_DIR/Abrir panel.desktop"

cat >"$LAUNCHER" <<EOF
[Desktop Entry]
Type=Application
Name=Abrir panel de Auscultor
Comment=Inicia y abre la configuración local del bot
Exec=$PROJECT_DIR/scripts/open-admin-panel.sh
Icon=preferences-system
Terminal=false
Categories=Utility;
EOF

chmod 755 "$PROJECT_DIR/scripts/open-admin-panel.sh" "$LAUNCHER"
printf 'Lanzador actualizado para: %s\n' "$PROJECT_DIR"
