# Night Grid mobile landscape repair — 2026-10-05

The gallery used a fixed estimate of header/control height when sizing photos. At 667 × 320 the image could shrink to roughly 14 × 8 CSS pixels, with navigation extending beyond the available stage. Wider landscape screens could overlap the image with the header.

The shared lightbox now uses the available dynamic viewport height and safe-area padding, with grid rows reserving the actual header and footer size. Landscape keeps the photo and side arrows inside the remaining space; portrait places both arrows below the photo. Controls retain 44 px touch targets and visible keyboard focus. Audio ownership, playback source and channel configuration are unchanged.

## Verification

`node scripts/verify-gallery-mobile.mjs` passed in Chromium and WebKit desktop-hosted mobile emulation at 390 × 844, 844 × 390, 667 × 320, 768 × 1024 and 1366 × 768, then returned to portrait (12 viewport checks in total).

Checks cover visible and reachable controls, next/previous images, no horizontal overflow, photo containment, play/pause/close, and the same playing Audio instance continuing across rotation/resizing. Local screenshots and metrics: `tmp/gallery-review-2026-10-05/`.

This is browser emulation, not a physical iPhone test. Physical speaker/stereo behaviour has not been measured; the fix addresses layout and playback continuity. A real-device follow-up from Ingo remains useful.

The narrow `project:night-grid` release contains the shared lightbox component, its scoped stylesheet and this regression script/report only.

## Fullscreen follow-up (2026-10-06)

Added a Full screen button to the shared photo gallery. The photo fills the available display without cropping, with reachable previous/next, Close and Exit full screen controls. Audio controls can be shown on demand, and the same audio element keeps playing through fullscreen and orientation changes.

Native fullscreen is requested from the user's button/keyboard action where available; an expanded in-page photo view handles missing or denied APIs. That fallback visibly notes that browser bars may remain. Native fullscreen changes are synchronized, owned fullscreen is released on close, and keyboard focus remains inside the gallery. Reference: [MDN requestFullscreen](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen) and [fullscreenchange](https://developer.mozilla.org/en-US/docs/Web/API/Document/fullscreenchange_event).

Validation passed in Chromium and WebKit: the original 12 viewport checks plus 6 fullscreen availability/denial/missing-API cases, photo navigation, rotation, playing-audio identity, play/pause, keyboard entry, Escape, close and reopen. Chromium exercised native fullscreen; WebKit automation used the expanded fallback. Chromium native fullscreen rotation uses CDP device metrics because the window-resize API rejects resizing a fullscreen host window. No physical iPhone or Safari browser-chrome behaviour is claimed.

Artifacts: `tmp/gallery-fullscreen-final-2026-10-06/` and `tmp/gallery-fullscreen-final.log`. TypeScript passed. Public-site checks follow the same verification script via `IOM_REVIEW_URL`.
