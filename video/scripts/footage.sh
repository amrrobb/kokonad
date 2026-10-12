#!/bin/sh
# Turns the Playwright recordings of one public game into the clips the video uses.
#   sh scripts/footage.sh            (reads footage-raw/*.webm, writes public/footage/*.mp4)
# The recordings come from `E2E_TARGET=public E2E_VIDEO=1 pnpm e2e game.spec.ts` in web/ (one .webm per
# tab under test-results/videos/<tab>/), copied to footage-raw/ as host, big-screen, Eka, Fajar, Gita.
# Playwright's webm has no seek index and a variable frame rate, so Studio cannot scrub it: every clip
# becomes constant 30 fps H.264 with a keyframe each second.
set -e
cd "$(dirname "$0")/.."
mkdir -p public/footage
enc="-r 30 -g 30 -keyint_min 30 -c:v libx264 -crf 17 -preset slow -pix_fmt yuv420p -an -movflags +faststart"
for n in big-screen Eka Fajar Gita; do
  out=$(echo "$n" | tr 'A-Z' 'a-z')
  ffmpeg -v error -y -i "footage-raw/$n.webm" $enc "public/footage/$out.mp4"
done
# The host recording of room RN2U3C (12 Oct 2026) has two bursts of torn frames (a grey band on the right
# and bottom, frames 2663-2665 and 4718-4721 at 30 fps). Each burst is replaced by the frame before it.
ffmpeg -v error -y -i footage-raw/host.webm -filter_complex \
  "[0]fps=30,split=3[a][b][c];[a][b]freezeframes=first=2663:last=2665:replace=2662[d];[d][c]freezeframes=first=4718:last=4721:replace=4717" \
  $enc public/footage/host.mp4
ls -la public/footage
