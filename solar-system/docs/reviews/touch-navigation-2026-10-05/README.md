# Mobile pinch navigation repair — 2026-10-05

## Report and cause

Selecting Sun, opening System overview, then repeatedly pinching could shift the target out of view or interrupt zoom. OrbitControls combined two-finger dolly with pan, and was attached only to the canvas while DOM object names sat above it. Starting a gesture over a name therefore did not consistently route both pointers through the camera controls.

## Change

- Route canvas and label gestures through their common scene frame.
- Suspend pan for the full touch sequence, restoring its prior state on release/cancellation, window blur or disposal. Mouse right-drag pan is preserved.
- Keep the original pressed label ID for taps after pointer capture; multi-pointer and drag sequences still do not select objects.
- Keep camera distance bounds, scale rules, astronomical data and physical parameters unchanged.

## Verification

- Chromium: 3 native CDP multi-touch cases at 390 × 844 and 844 × 390 in true scale, plus 667 × 320 in presentation scale. Each begins over the Sun label, repeats five inward and three outward pinches, asserts Sun remains centred, reaches less than 1% of overview distance, and verifies overview reset and label tap.
- WebKit: the same 3 viewport/scale cases via synthetic PointerEvents. Its automation does not expose native multi-touch dispatch. These exercise the event handlers but are not physical iOS gesture validation.
- Existing object-name acceptance test passed in both engines, including Moon selection by tap and keyboard, name toggling and responsive toolbar checks.
- Desktop Chromium smoke passed for wheel input over labels, Shift acceleration, drag orbit and intentional right-drag pan.
- 20 unit regressions passed across touch lifecycle, wheel multiplier, selection gestures, camera control and responsive framing.
- Targeted ESLint, TypeScript and the Solar System production build passed, including all bundled astronomy-asset verification. Existing large-bundle warnings remain.

Browser results: 9 passing cases across Chromium and WebKit. Logs are under `solar-system/tmp/pinch-*.log`, `touch-desktop.log`, `touch-unit.log`, and `touch-build.log`. No physical phone was available for verification. Real-device feedback remains useful.

The label touch-target assertion permits 0.001 CSS px of DOMRect rounding; the actual CSS target remains at least 44 px.

## Follow-up: selected planet zoom pivot (2026-10-06)

Reproduced the client's Jupiter case with normal camera animation: manual zoom could inherit the Sun pivot from overview, or a partially interpolated pivot when the user interrupted a focus flight. The previous reduced-motion regression did not expose the latter case.

The first manual gesture now anchors overview/plain planet-follow views to the selected body's mapped position, translating the camera and pivot together so the viewing direction and distance are retained. Close-up presets keep their own pivot metadata during handoff. Astronomy data, body sizes and orbital parameters are unchanged.

Validation: Chromium selected Jupiter/Earth/Saturn through menus, interrupted focus immediately, returned to overview, pinched in/out, and reselected a scene label; desktop orbit, right-drag pan and Shift wheel also passed. WebKit repeated the selected-planet flow and the Sun overview pinch case. Chromium uses native CDP touch input; WebKit uses synthetic multi-pointer events. All 21 focused camera/touch unit tests, targeted lint, TypeScript and the demo build passed. These are desktop-hosted browser checks, not physical iPhone tests.

Logs: `solar-system/tmp/selected-planet-chromium.log`, `pivot-webkit.log`, `pivot-unit.log`, `pivot-build.log`. The original failing three-path probe is in `selected-planet-before.log`.


## Follow-up: full selected orbit (2026-10-07)

The renderer deliberately hid the selected planet's orbit whenever its short history trail was present. This made selection appear to remove most of the orbit. Selection now keeps the complete available ephemeris orbit and hides the overlapping short trail instead, matching the existing comet treatment. Dataset/astronomical parameters and camera behavior are unchanged. Coverage-limited outer-planet/comet paths remain limited to supplied data; no artificial closing segment is introduced.

Validation: 71 tests passed across orbit geometry/coverage, line presentation, distance fading and epoch alignment. A Chromium/WebKit acceptance test selects Earth, Mars, Jupiter, Saturn, Neptune and Earth again, checks full-orbit visibility and suppressed duplicate trails, returns to overview, switches rendering scale and rotates/resizes the viewport. The existing selected-planet zoom/pinch regression also passed in WebKit. Targeted lint and the Solar build (including ephemeris asset checks and TypeScript) passed. No physical iPhone was available.

Evidence: `solar-system/tmp/orbit-*-2026-10-07.log`, `tmp/solar-orbit-build-2026-10-07.log` and acceptance-test screenshots under `solar-system/test-results/`.
