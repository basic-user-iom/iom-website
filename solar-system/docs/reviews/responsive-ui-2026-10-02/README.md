# Solar System responsive UI review — 2026-10-02

Local preview: http://127.0.0.1:5194/demos/solar-system/

Status: implemented and tested locally. No deployment or remote push. Astronomical parameters, ephemerides, textures, scenario physics and scientific descriptions were not changed.

## Reproduced causes and corrections

| Reproduced problem | Correction |
| --- | --- |
| The shared IOM script injected a fixed Back link above the brand and panels. | Adopt the original anchor into the header, retain its destination and navigation handler, and override its fixed positioning only within this demo. The fallback remains `/#experiments`. Strict Mode replay preserves the original anchor. |
| Absolute fullscreen, information badges and planet shortcuts competed for the same canvas corners. | Put these controls in normal layout flow; information and planet shortcuts are keyboard accessible disclosures. |
| The 821/1120 px breakpoints assigned incompatible rows to tablet and landscape rails. | One bounded workspace, with desktop rails, a bottom panel in portrait and a separate side panel in landscape. |
| Permanently expanded time controls displaced the scene. | Time controls open explicitly, scroll inside their own panel, and can be closed without losing the scene. |
| Long laboratories, names and controls exceeded available space. | Internally scrolling panels, wrapping labels, flexible inputs and minimum 44 × 44 px controls. |
| Mobile browser chrome and device edges were not consistently accounted for. | Dynamic viewport height, safe-area padding and 16 px mobile input text. |

Objects, Time, View and Tools share one mobile panel slot. Help, provenance and scenario confirmations retain their modal focus handling. Footer source links remain available in Tools. Desktop visual identity and existing functions are retained.

## Selection and camera

- Planet disc picking, scene label buttons, the navigator and planet shortcuts call the same selection/focus handler.
- The selected navigator item and object information are synchronized. A manual selection closes an inactive lab preview.
- Camera distance uses the actual canvas aspect/FOV and rendered object extent, including rings, in true and presentation scales. Existing smooth transitions and floating-origin tracking are retained.
- Programmatic focus clears residual orbit damping. Manual orbit and zoom remain available. System overview provides an explicit return action.
- A stationary primary-pointer tap selects; dragging, multi-touch, cancelled gestures, long presses and wheel interruptions do not. UI controls are separate from the canvas event target.
- Scene labels are real keyboard accessible buttons with visible focus. Hidden labels do not intercept input.

## Browser verification — emulation, not physical devices

Chromium / Playwright, local WebGL renderer. Baseline reproduction used the public demo; verification used the local source. The shared production Back script was also injected to check coexistence.

| Viewport | Verified |
| --- | --- |
| 360 × 800 | Scene, Objects, Time, View, Tools, all labs, Help, provenance |
| 390 × 844 | Same; touch interaction, moving Earth, Saturn rings, both scales |
| 768 × 1024 | Scene and all panels/dialogs |
| 1366 × 768 | Desktop rails, time panel, all labs/dialogs, object selection |
| 844 × 390 | Landscape side panels, all labs/dialogs and active scenario HUDs |
| 667 × 375 | Additional narrow landscape coverage |
| 390 × 600 | Shortened mobile browser viewport |

- 60 layout/panel states: no horizontal page/panel overflow, no Back/brand overlap, no measured button/select/summary below 44 × 44 px.
- 24 additional active-scenario states: Impact Lab; scientific solar evolution; fictional supernova; physics flyby; cinematic consumption. Includes confirmations, portrait/landscape panels and expanded scene information.
- Final repeatable check: 27 layouts plus Back-link coexistence, shortened viewport, keyboard disclosure and planet shortcut selection; zero page or console errors.
- Interaction checks: mesh click, scene-label click/tap, keyboard navigator selection, repeated selection, long 67P name, both scales, Saturn ring bounds with a panel open, manual orbit, emulated two-finger pinch, UI click isolation, Escape/focus restoration, full screen and system overview.
- Moving Earth at one simulated day per second remains centered after the focus transition settles. The follow probe distinguished the intentional transition from steady tracking.

No physical phone/tablet, Safari or real browser keyboard/notch behavior was tested. Safe-area and dynamic-viewport support is implemented; device verification remains a separate step.

## Build and tests

- `npm run build`: passed (asset verification, TypeScript and local demo build).
- `npm test -- --reporter=dot`: 646 tests passed across 91 files.
- `npx eslint src scripts/verify-responsive-ui.mjs`: passed.
- The repository-wide `npm run lint` also scans pre-existing scratch/diagnostic scripts and reports unrelated errors; those files were not changed.
- Existing bundle-size warnings remain. No unrelated build configuration was changed.

To repeat the final browser check from `solar-system`, with the dev server running:

```sh
node scripts/verify-responsive-ui.mjs
```

Raw evidence: [layout audit](layout-audit.json), [active scenarios](scenario-audit.json), [interactions](interaction-checks.json), [final verification](final-verification.json).

## Screenshots

[Desktop](desktop.png) · [Mobile](mobile.png) · [Mobile panel](mobile-panel.png) · [Landscape](landscape.png) · [Landscape tools](landscape-tools.png) · [Mobile Saturn](mobile-saturn.png) · [Active Solar Fate](mobile-solar-fate.png)

Baseline: [mobile before](before-mobile.png) · [landscape before](before-landscape.png).
