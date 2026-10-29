# Remember Me - picture-led song practice

A public, buildless student page for the approved Remember Me flashcards.

- Tap a picture for the teacher's spoken phrase.
- Tap its music-note lyric line for the supplied film-song recording.
- Play the continuous full song with picture highlighting.
- Simplified Chinese instructions; optional Chinese lyric meanings.
- No account, microphone access, YouTube player, external font, or UI framework.

## Hosting

GitHub Pages publishes main, repository root, with .nojekyll.
Public repository: https://github.com/vpietri-stack/remember-me-song
Website: https://vpietri-stack.github.io/remember-me-song/

The image/audio delivery follows the existing Classroom Survivors pattern:
1. On github.io, prefer the same China-facing gh-proxy.com mirror for raw repository assets.
2. If it fails, try same-origin GitHub Pages immediately; if it stalls, start the fallback after 1.2 seconds.
3. Validate the downloaded size and SHA-256 against asset-manifest.js.
4. Keep assets in a dedicated IndexedDB store and reuse blob URLs.
5. Warm all 36 picture/audio assets with three background jobs and give taps priority.
6. Keep normal media playback working if browser storage is unavailable.

No game files, production APIs, student records, or Classroom Survivors deployment settings were changed.
The entry HTML, CSS, and modules are served directly by GitHub Pages.
Mirror speed and reachability can vary by network; the persistent cache avoids repeat media downloads.
The page reports when its pictures and sounds are ready.

## Audio and pictures

11 teacher-spoken phrases, 13 film-song line clips, and one continuous full-song MP3.
11 approved bear-family pictures, reused at the repeated song lines.
Assets total about 6.09 MiB. Source files and the teacher's complete original backup remain outside this repository.

## Verification

- node test-assets.mjs: six delivery checks covering mirror choice, deduplication, fallback, stalled downloads, invalid content, retries, and bounded jobs.
- node check-site.mjs: all 36 asset sizes and hashes, approved lyric mapping, unique HTML IDs, and Chinese instructions.
- Browser checks: all picture placements, all sung clips, full-pack prefetch, persisted-cache reload with asset hosts blocked, mirror failure, and 390px layout.
- Existing full-song timing, playback controls, Chinese meanings, and removed bottom note are preserved.

## Updating media

Replace only the intended files under assets/, then run:
python build-asset-manifest.py
node test-assets.mjs
node check-site.mjs

Bump the shell version query in index.html and its module imports when changing executable code.
Commit and push explicit paths to main, then wait for Pages and verify the served bytes.
