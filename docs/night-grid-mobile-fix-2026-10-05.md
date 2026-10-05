# Night Grid mobile landscape repair — 2026-10-05

The gallery used a fixed estimate of header/control height when sizing photos. At 667 × 320 the image could shrink to roughly 14 × 8 CSS pixels, with navigation extending beyond the available stage. Wider landscape screens could overlap the image with the header.

The shared lightbox now uses the available dynamic viewport height and safe-area padding, with grid rows reserving the actual header and footer size. Landscape keeps the photo and side arrows inside the remaining space; portrait places both arrows below the photo. Controls retain 44 px touch targets and visible keyboard focus. Audio ownership, playback source and channel configuration are unchanged.

## Verification

`node scripts/verify-gallery-mobile.mjs` passed in Chromium and WebKit desktop-hosted mobile emulation at 390 × 844, 844 × 390, 667 × 320, 768 × 1024 and 1366 × 768, then returned to portrait (12 viewport checks in total).

Checks cover visible and reachable controls, next/previous images, no horizontal overflow, photo containment, play/pause/close, and the same playing Audio instance continuing across rotation/resizing. Local screenshots and metrics: `tmp/gallery-review-2026-10-05/`.

This is browser emulation, not a physical iPhone test. Physical speaker/stereo behaviour has not been measured; the fix addresses layout and playback continuity. A real-device follow-up from Ingo remains useful.

The narrow `project:night-grid` release contains the shared lightbox component, its scoped stylesheet and this regression script/report only.
