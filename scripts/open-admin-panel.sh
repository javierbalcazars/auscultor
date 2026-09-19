#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PANEL_URL="http://127.0.0.1:3210"
LOG_DIR="$PROJECT_DIR/.local"
LOG_FILE="$LOG_DIR/admin-panel.log"

mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR"
touch "$LOG_FILE"
chmod 600 "$LOG_FILE"

if ! curl --fail --silent --output /dev/null "$PANEL_URL/api/config"; then
  cd "$PROJECT_DIR"
  if command -v systemd-run >/dev/null && systemd-run --user --collect \
      --unit=auscultor-admin \
      --property="WorkingDirectory=$PROJECT_DIR" \
      --property="StandardOutput=append:$LOG_FILE" \
      --property="StandardError=append:$LOG_FILE" \
      /usr/bin/npm run admin >/dev/null 2>&1; then
    :
  else
    nohup /usr/bin/npm run admin >>"$LOG_FILE" 2>&1 </dev/null &
  fi

  for _ in {1..40}; do
    if curl --fail --silent --output /dev/null "$PANEL_URL/api/config"; then
      break
    fi
    sleep 0.25
  done
fi

if ! curl --fail --silent --output /dev/null "$PANEL_URL/api/config"; then
  printf 'No se pudo iniciar el panel. Revisa: %s\n' "$LOG_FILE" >&2
  exit 1
fi

xdg-open "$PANEL_URL"
