#!/usr/bin/env bash
set -euo pipefail
sudo systemctl disable --now auscultor.service 2>/dev/null || true
sudo rm -f /etc/systemd/system/auscultor.service
sudo systemctl daemon-reload
printf 'Servicio opcional de Auscultor eliminado.\n'
