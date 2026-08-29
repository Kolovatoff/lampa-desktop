#!/usr/bin/env bash
# Build a complete Apple .icns from assets/icon.png (or assets/icon.svg).
# Requires Python 3. Optional on macOS: sips, rsvg-convert/magick, iconutil.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS="$ROOT/assets"
MASTER_PNG="$ASSETS/icon.png"
MASTER_SVG="$ASSETS/icon.svg"
OUT_ICNS="$ASSETS/mac.icns"
BUILD_PY="$ROOT/scripts/build-mac-icns.py"

# Prefer regenerating PNG from SVG when a renderer is available.
if [[ -f "$MASTER_SVG" ]]; then
  if command -v rsvg-convert >/dev/null 2>&1; then
    echo "Rasterizing SVG with rsvg-convert..."
    rsvg-convert -w 1024 -h 1024 "$MASTER_SVG" -o "$MASTER_PNG"
  elif command -v magick >/dev/null 2>&1; then
    echo "Rasterizing SVG with ImageMagick..."
    magick -background none "$MASTER_SVG" -resize 1024x1024 "$MASTER_PNG"
  else
    echo "No SVG rasterizer found (rsvg-convert/magick); using existing ${MASTER_PNG}"
  fi
fi

if [[ ! -f "$MASTER_PNG" ]]; then
  echo "error: missing ${MASTER_PNG}" >&2
  exit 1
fi

python3 "$BUILD_PY" "$MASTER_PNG" "$OUT_ICNS"
echo "Done: ${OUT_ICNS}"

# Optional verification with Apple's iconutil when available.
if [[ "$(uname -s)" == "Darwin" ]] && command -v iconutil >/dev/null 2>&1; then
  VERIFY="/tmp/lampa-mac-verify.iconset"
  rm -rf "$VERIFY"
  if iconutil -c iconset "$OUT_ICNS" -o "$VERIFY" 2>/dev/null; then
    echo "Verified representations:"
    ls -1 "$VERIFY"
    rm -rf "$VERIFY"
  fi
fi
