# Solar System visual artifact review — 2 October 2026

## Findings and fixes

- Unselected spacecraft locators produced bright yellow diamonds, then isolated yellow pixels. Locators now appear only for the selected artificial object. Catalogue selection, trajectories and the ISS/Voyager models remain available.
- Warm specular glints in the statistical asteroid belt accounted for additional gold pixels. Soft particle edges, restrained glints and neutral lighting remove their marker-like appearance. The distribution and orbital data are unchanged.
- A broad blue diagonal band during the 67P close-up came from the reference grid, confirmed by isolating grid, orbit, comet and moon layers in a frozen view. Independent grid segments now use the existing double-precision camera-relative clipping pipeline.
- Moon inspection used an inverted Sun direction and a distance floor that hid small moons. It now frames the illuminated side using the viewport and actual irregular silhouette. Manual zoom-out is no longer forcibly reset.
- Resizing or closing mobile drawers preserves inspection zoom relative to the viewport. Catalogue focus closes the mobile drawer. Automatic body focus avoids an enlarged nearby body blocking the target; Earth no longer hides the Moon in presentation scale.
- ISS inspection can choose its model framing direction before its asset finishes loading. Unrelated parent reticles are hidden during auxiliary-object inspection.

No ephemerides, astronomical parameters, physical radii, surface maps or scientific catalogue records were edited.

## Coverage and evidence

Chromium browser automation and visual inspection of contact sheets on Windows; mobile sizes are emulation, not physical-device testing.

- All **489 catalogue entries** selected and captured: 15 main bodies (including 5 comets), 23 other major moons, 432 minor-moon records, 5 Earth satellites and 14 spacecraft. No failed selections or page errors. Minor records retain their declared schematic marker rendering.
- The initial sweep was followed by **61 representative captures** after the marker/grid/Sun-direction corrections: all main bodies, all major moons, every artificial object, and one minor record per parent. All 15 main bodies were also viewed in presentation scale.
- After the final framing corrections, Mercury, Earth, Moon, Mars, Saturn and 67P were rechecked in true scale, wide view and presentation scale.
- **20 mobile framing cases** at 390×844 and 844×390: Saturn, Phobos, Hyperion, ISS and Voyager 1. True/presentation selections covered; detailed ISS/Voyager inspection intentionally returns to its existing physical-scale mode. Irregular moon bounds fit with a 15% margin, zoom-out remains free, and the page has no horizontal overflow.
- Extra dated comet views: NEOWISE (2020-07-03), Encke (2023-10-22), Halley (2061-07-28), 67P (2015-08-13), Hale–Bopp (2000-01-01; no active tail in this model).
- Earlier responsive review covers 360×800, 390×844, 768×1024, 1366×768 and mobile landscape, all drawers and scenarios: [responsive report](../responsive-ui-2026-10-02/README.md).
- **656 tests / 94 files passed**, TypeScript and ESLint on changed source passed, production build and bundled-data/asset verification passed.
- Original full-resolution captures and layer-isolation runs remain locally under solar-system/tmp. The JSON reports here preserve the inspected catalogue and rerun results.

No remaining yellow locator diamonds/dots or broad grid bands were seen in the reviewed views. This review does not claim exhaustive coverage of every date, camera angle, GPU or physical mobile browser.

## Screenshots

[Desktop](desktop.png) · [Mobile Phobos](mobile-phobos.png) · [Landscape Voyager](landscape-voyager.png)

[Mercury wide](mercury-wide.webp) · [Mars wide](mars-wide.webp) · [Moon in presentation scale](moon-presentation.webp)

[Main objects](planets-and-comets.jpg) · [Artificial objects](spacecraft.jpg) · [Dated comet views](comets.jpg)
