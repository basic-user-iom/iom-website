# Sun corona fix ? 2026-09-26

The displaced sphere normal was used as an approximate ray radius, while the deformation was not represented in the limb cutoff or clipping bounds. Strong additive emission over the photosphere produced a thick white ring.

Changed the shared Sun corona shader to use camera-relative rays in photosphere-radius units. It masks the opaque disk, uses a steep inner falloff plus faint Sun-anchored radial streamers, and fades before the envelope boundary. Back-face rendering and depth testing preserve foreground occlusion and support a camera inside the outer envelope. Geometry and clipping bounds now agree at 2.4 solar radii. Photosphere and physical Sun radius are unchanged. The existing Low-quality policy still disables the corona.

Validation: 21 relevant tests passed; TypeScript, targeted ESLint and isolated Vite build passed. Browser captures covered all four quality settings, suppression during red-giant evolution and restoration after reset to the normal observatory. No shader or runtime errors.

Reproduce: `$env:CORONA_OUT='tmp/corona-after'; node scripts/verify-sun-corona.mjs`.

Comparison: http://127.0.0.1:5194/demos/solar-system/tmp/corona-review/index.html

Build output: F:/iom_website/tmp/sun-corona-build. No production deployment.
