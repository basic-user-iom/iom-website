# Orbit and trajectory alignment ? 2026-09-27

The reported detached paths and rapidly changing Voyager line had several independent causes:

- Even-sized, uniformly sampled paths did not contain the current object epoch. At JD 2451545.1234 (or the nearest valid mission date), the original nearest-chord errors were 113.93 km for Voyager 1 and 715.62 km for Voyager 2. Some other mission segments had substantially larger errors.
- Satellite worker states up to 0.05 days old were displayed alongside paths sampled at the current epoch. That tolerance is 72 minutes, a large fraction of an ISS orbit.
- Moon and probe path coordinates were narrowed to Float32 at heliocentric scene distances. The GPU then subtracted a nearly equal camera coordinate and clipped very long segments, losing the metre-scale detail needed near Voyager.
- Cached planet/comet paths did not update their exact current vertex between rebuilds. Past/future trail endpoints could therefore lag behind the body.

## Changes

1. Split path sampling around the exact current epoch while preserving endpoints and sample counts. Clamp Earth-satellite arcs to the OMM hard window; invalid propagation is represented as a gap, never a line to the Earth's centre.
2. Accept background-worker results only at the exact requested epoch; otherwise sample the same provider synchronously. Avoid resubmitting identical paused epochs.
3. Retain Float64 offsets about each body/spacecraft. Subtract the final camera position and clip all six frustum planes on the CPU before converting the visible segments to Float32. Upload from the scene pre-render hook, before Three uploads attributes; object pre-render hooks are too late and cause a one-frame lag.
4. Apply this to planet/comet strokes, major-moon orbits and selected satellite/spacecraft trajectories. Preserve line colour, width, depth testing and the physical/presentation position scaling.
5. Pin cached ephemeris paths to the live state and trim history/future trails in either playback direction. Do not close missing coverage or invent an ellipse for an incomplete ephemeris arc.

## Validation

- All 629 unit tests pass, including bundled vectors for all eight planets, Earth's Moon and five comets; all 14 spacecraft; five Earth satellites; and 23 major moons.
- Precision tests cover camera distances from 5 m to 10,000 km around an anchor at roughly 200 AU, multiple viewing angles, invalid samples and near-plane clipping.
- Chromium reads back the actual Voyager GPU vertex buffer on each observed frame during wheel zoom and camera rotation: it must exactly match the current CPU buffer and pass within one screen pixel of the spacecraft centre. Both Voyagers pass.
- Existing Voyager zoom, tracking, orbit and missing-model fallback acceptance tests pass.
- Planet selection, Neptune following, previous/next trails, Io framing and ISS/OMM trajectory browser regressions pass.
- TypeScript and source/e2e lint pass; the workspace-wide lint command also scans old untracked scripts and temporary probes unrelated to this release.

## Boundaries and sources

Alignment is with the project's declared position providers. This does not increase the scientific accuracy of approximate moon propagation, extend JPL coverage, add high-precision TEME precession, or turn OMM data into a long-term prediction.

- JPL Horizons reference frames and geometric vectors: https://ssd.jpl.nasa.gov/horizons/manual.html
- Three BufferGeometry: https://threejs.org/docs/pages/BufferGeometry.html
- The installed Three r181 WebGLRenderer/WebGLObjects ordering was inspected to ensure preparation precedes GPU buffer upload.
