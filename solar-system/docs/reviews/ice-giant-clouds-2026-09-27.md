# Uranus and Neptune cloud-top review

The project has no measured global color map for either ice giant. Both use
explicitly labeled procedural cloud tops. No image request or texture decode
was failing in the reported views.

The previous visible-light correction multiplied a small palette difference by
only 0.035 (Uranus) or 0.09 (Neptune). This nearly removed zonal structure. The
Neptune cloud mask was also suppressed by a narrow noise gate and low opacity.
Removing the separate haze shell did not recover the missing structure.

The correction keeps the pale visible-light palettes, separates their color
from cloud contrast, and restores broad unequal zones and soft elongated cloud
filaments. Uranus remains lower contrast, with a smooth polar haze weighted
toward the summer hemisphere using the existing body-local Sun direction.
Neptune has stronger bands and broken methane cloud streaks. Cloud locations,
contrast, and the seasonal haze response are illustrative, not measured weather.
The existing dated storm lifecycle is unchanged; no permanent dark spot is added.

## References

- [Oxford visible-light color reassessment](https://www.ox.ac.uk/news/2024-01-05-new-images-reveal-what-neptune-and-uranus-really-look-0)
- [NASA Neptune atmosphere and transient dark spots](https://science.nasa.gov/neptune/neptune-facts/)

## Verification

Controlled captures: tmp/ice-giants-before and tmp/ice-giants-after, including
cloud albedo without illumination and the separate shell disabled. App captures:
tmp/ice-giants-app, including lit and oblique views and all four quality levels.

A WebGL fixture samples the production shader independently of illumination.
Regression checks bound visible zonal contrast, longitudinal variation, and
longitude seam discontinuity, retain pale colors, and verify deterministic
advection/replay. These are display regression bounds, not radiometric accuracy.
All four quality levels retain the cloud structure. Unit tests cover existing
profiles and body integration, and the dated Neptune storm browser check passes.
