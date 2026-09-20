#!/usr/bin/env bash
set -euo pipefail
OPTIONAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$OPTIONAL_DIR/../.." && pwd)"
NODE_BIN="$(command -v node)"
CURRENT_USER="$(id -un)"
TEMP_FILE="$(mktemp)"
trap 'rm -f "$TEMP_FILE"' EXIT
sed -e "s|__USER__|$CURRENT_USER|g" -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" -e "s|__NODE__|$NODE_BIN|g" "$OPTIONAL_DIR/auscultor.service" > "$TEMP_FILE"
sudo install -m 644 "$TEMP_FILE" /etc/systemd/system/auscultor.service
sudo systemctl daemon-reload
sudo systemctl enable --now auscultor.service
sudo systemctl status auscultor.service --no-pager
