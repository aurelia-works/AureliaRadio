#!/bin/sh
# Reads the 20 scripted calls in apps/desktop/src-tauri/fixtures/asr/lines.tsv with the macOS voice
# and writes one 16 kHz mono 16-bit WAV per line next to it. The WAVs are synthetic speech, not a pilot,
# and are gitignored. Usage: scripts/make-asr-fixtures.sh [voice]   (default: Samantha; some system voices come out garbled)
set -eu
dir="$(cd "$(dirname "$0")/.." && pwd)/apps/desktop/src-tauri/fixtures/asr"
voice="${1:-Samantha}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
grep -v '^#' "$dir/lines.tsv" | while IFS="$(printf '\t')" read -r id _ text; do
  [ -n "$id" ] || continue
  printf '%s' "$text" > "$tmp/line.txt"
  if [ -n "$voice" ]; then
    say -v "$voice" -f "$tmp/line.txt" -o "$tmp/$id.aiff"
  else
    say -f "$tmp/line.txt" -o "$tmp/$id.aiff"
  fi
  afconvert -f WAVE -d LEI16@16000 -c 1 "$tmp/$id.aiff" "$dir/$id.wav"
done
printf "%s WAV fixtures in %s
" "$(ls "$dir"/*.wav | wc -l | tr -d " ")" "$dir"
