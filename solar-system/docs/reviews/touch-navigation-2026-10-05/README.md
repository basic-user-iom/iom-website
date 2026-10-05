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
