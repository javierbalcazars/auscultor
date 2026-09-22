#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_DIR="${AUSCULTOR_APPIMAGE_OUTPUT_DIR:-$(dirname "$ROOT")/Auscultor-AppImages}"
UPDATE_INFO="${AUSCULTOR_UPDATE_INFO:-gh-releases-zsync|javierbalcazars|auscultor|latest|Auscultor-v*-x86_64.AppImage.zsync}"
ZSYNCMAKE_BIN="${ZSYNCMAKE:-$(command -v zsyncmake || true)}"

if [[ -z "$ZSYNCMAKE_BIN" || ! -x "$ZSYNCMAKE_BIN" ]]; then
  printf 'Falta zsyncmake. Instala el paquete zsync o define ZSYNCMAKE con su ruta.\n' >&2
  exit 1
fi

cd "$ROOT"
rm -rf dist-electron
npx electron-builder --linux AppImage --x64 --publish never
mapfile -t images < <(find dist-electron -maxdepth 1 -type f -name '*.AppImage' -print)
if [[ "${#images[@]}" -ne 1 ]]; then
  printf 'Se esperaba exactamente una AppImage y se encontraron %s.\n' "${#images[@]}" >&2
  exit 1
fi

image="${images[0]}"
node scripts/appimage-update-info.js embed "$image" "$UPDATE_INFO"
node scripts/appimage-update-info.js verify "$image" "$UPDATE_INFO"
"$ZSYNCMAKE_BIN" -u "$(basename "$image")" -o "$image.zsync" "$image"
test -s "$image.zsync"

mkdir -p "$OUTPUT_DIR"
mv -f "$image" "$image.zsync" "$OUTPUT_DIR/"
printf 'AppImage actualizable y archivo zsync guardados en %s\n' "$OUTPUT_DIR"
