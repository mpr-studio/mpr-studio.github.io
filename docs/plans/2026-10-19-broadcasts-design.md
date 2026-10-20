# Broadcasts: design

Recorded shows on the MPR Studio site. Agreed 2026-10-19; details may change during implementation.

## Site

The top menu becomes Radio · Broadcasts · Course. `#broadcasts` is a plain list, newest first, one line per show: number, date, theme, guest. Each show has its own page, `#broadcast-N`: title ("Broadcast 1: Architectural discourse"), date and length, the show player, credits (hosts by full name once each has agreed; produced by Rodrigo Escandón Cesarman), a two or three sentence description with the vignettes discussed, 5 to 10 timestamped chapters that jump the player, the guest's bio and a few links, and a download link. The Radio home gets one line linking to the latest broadcast. Texts are edited in `cornell-2026-fall-mpr/Course/site-texts.md` and copied into the site.

## Player

A small custom player in the same style as the floating live player (not the browser's native controls): play/pause button, a waveform of the whole show drawn like the live one with the played part filled and click-to-seek, elapsed and total time, and the same volume control. Chapters seek it. Playing a show pauses the live player and vice versa. No podcast feed yet (parked).

## Audio

Per show: Mixxx's WAV is converted to FLAC and backed up to the studio Google Drive folder (the WAV is deleted only after the FLAC is checked). The web version is trimmed, processed (high-pass, leveling between hosts and guest, about -16 LUFS and -1 dBTP) and encoded as MP3, encoded at 56 kbps mono, 32 kHz so it stays under Cloudflare Pages' 25 MiB file limit, and committed to the site repo in `broadcasts/` with a small precomputed waveform peaks file (`broadcast-N.json`, made with `Radio/Tools/peaks.py`). R2 was considered and dropped to avoid another service and card. The transcript is used for trims and chapters, not published.

## Build

Hand-written HTML sections in `index.html`, like the existing pages; no data file. Audio and peaks are served from the same origin as the site.
