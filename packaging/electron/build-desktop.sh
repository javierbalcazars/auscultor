#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_DIR="${AUSCULTOR_APPIMAGE_OUTPUT_DIR:-$(dirname "$ROOT")/Auscultor-AppImages}"
cd "$ROOT"
rm -rf dist-electron
npx electron-builder --linux AppImage --x64 --publish never
mkdir -p "$OUTPUT_DIR"
find dist-electron -maxdepth 1 -type f -name '*.AppImage' -exec mv -f {} "$OUTPUT_DIR/" \;
printf 'AppImage de escritorio guardada en %s\n' "$OUTPUT_DIR"
