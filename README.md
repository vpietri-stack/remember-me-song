# Remember Me - picture-led song practice

Public student page: https://vpietri-stack.github.io/remember-me-song/
Repository: https://github.com/vpietri-stack/remember-me-song

- Tap a picture for the teacher's spoken phrase; tap a music-note lyric line for its sung clip.
- 听完整歌曲 opens an illustrated player with automatic picture/caption changes, pause, restart and seeking. It does not scroll the page.
- At the bottom, 录整首歌 opens the karaoke video recorder. There is no individual-line recording.
- Wear headphones, allow the microphone, wait for 3-2-1 and sing. Recording stops at the song's end; stopping early keeps a partial take.
- Replay shows the karaoke video with the student's voice mixed over the original. Original/voice volume and voice timing can be adjusted separately.
- Keep or discard a take before replacing a previous take; download the mixed audio as WAV if desired.
- Simplified Chinese instructions; optional Chinese lyric meanings. No accounts, external media player, font or UI framework.

## Recording privacy

Microphone access begins only on an explicit recording-button press. Only audio is captured, with no live microphone monitoring, transcription, scoring or uploads. A kept whole-song take is stored in this browser's IndexedDB database, remember-me-student-overdub-v1. Clearing browser data or changing device/browser can remove access; download wanted takes. Closing during recording stops the microphone and presents the take; navigation warns about unkept work. Backgrounding interrupts recording safely.

## Video and synchronization

The user-supplied MKV was converted to H.264/AAC MP4 (1280x720, fast-start metadata), retaining source interval 1.55-66.15 seconds, matching the 64.6-second full-song audio. The skull animation and its embedded soundtrack stay together. During recording/replay, the video is the master clock; the separate voice buffer follows video time and is rescheduled on seeking/resuming or timing adjustment. WAV export uses the same film-song performance from the existing full-song MP3. Physical device/headphone latency can be adjusted by the parent.

## Hosting and media delivery

GitHub Pages publishes main, repository root, with .nojekyll. Pictures, audio and video follow the existing Classroom Survivors asset-delivery pattern:

1. On github.io, prefer the gh-proxy.com mirror for raw repository assets.
2. On mirror failure use GitHub Pages; start a parallel fallback after a 1.2-second stall.
3. Validate size and SHA-256 against asset-manifest.js.
4. Keep media in IndexedDB and reuse blob URLs, with three background downloads and priority for taps.
5. Normal playback remains available if persistent storage is unavailable.

The pack contains 11 images, 11 teacher-spoken phrases, 13 sung clips, the full-song MP3 and the karaoke MP4: 37 assets, about 12.52 MiB. The MP4 is 6,737,974 bytes. It is included in background preparation and persistent caching. Network reachability/speed varies; Mainland China/WeChat microphone behavior still needs hands-on device verification. No Classroom Survivors game files, APIs, student records or deployment settings are changed.

## Verification and updates

Run python build-asset-manifest.py after changing media, then npm test. The checks cover all asset hashes/sizes and lyric mapping, mirror/fallback behavior, retries, invalid content and bounded jobs. All 13 sung lines and original spoken phrases remain unchanged.

The approved local prototype was tested with a simulated microphone: full 64.6-second capture, karaoke replay, seek/pause/resume/end, independent gains, timing correction, WAV export, saved-take reload, cancellation/microphone release, permission refusal, bottom-only recording, illustrated full-song playback without scrolling, preserved individual listening, and 390px layouts. No real student/user voice was used for automated QA. Real microphone/headphone latency and WeChat remain hands-on checks.

Bump the shell/module query versions when changing code. Commit explicit source/media paths only; qa/ is ignored and includes no publishable student data. Wait for Pages deployment and verify served source/media hashes after publishing.
