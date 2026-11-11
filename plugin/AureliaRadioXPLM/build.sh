#!/bin/sh
set -eu

SDK="${XPLANE_SDK:-$HOME/Developer/XPlaneSDK}"
ARCH="${ARCH:-x86_64}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/Dist/AureliaRadioXPLM/mac_${ARCH}"

if [ ! -d "$SDK/CHeaders/XPLM" ]; then
    echo "X-Plane SDK not found at $SDK" >&2
    echo "Set XPLANE_SDK to the extracted SDK directory." >&2
    exit 1
fi

mkdir -p "$OUT"

clang -dynamiclib -arch "$ARCH" -mmacosx-version-min=10.15 -fvisibility=hidden \
    -DAPL=1 -DIBM=0 -DLIN=0 \
    -DXPLM200 -DXPLM210 -DXPLM300 -DXPLM301 -DXPLM303 \
    -I"$SDK/CHeaders/XPLM" \
    "$ROOT/AureliaRadioXPLM.c" \
    -F"$SDK/Libraries/Mac" -framework XPLM -framework CoreFoundation \
    -o "$OUT/AureliaRadioXPLM.xpl"

echo "built $OUT/AureliaRadioXPLM.xpl"
