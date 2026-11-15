#!/bin/sh
# Downloads whisper.cpp's tiny English weights (75 MB) into the app's data folder and checks the hash.
set -eu
dest="$HOME/Library/Application Support/com.aurelia.radio/models"
file="$dest/ggml-tiny.en.bin"
sha=921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f
mkdir -p "$dest"
if [ ! -f "$file" ]; then
  curl -fL --progress-bar -o "$file.part" \
    https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin
  mv "$file.part" "$file"
fi
echo "$sha  $file" | shasum -a 256 -c -
