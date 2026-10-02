# Saturn orientation and accelerated wheel navigation

The previous constant-rate rotation assigned Saturn's tilt node to inertial +X. The catalog obliquity alone did not define the pole direction and therefore disagreed with the independent JPL-anchored moon planes. Saturn now uses the IAU 2015 constants distributed in NASA/JPL NAIF pck00011, transformed into ECLIPJ2000. The body, rings and lighting share that orientation. Other planet rotation models are unchanged.

The existing Saturn rings preset deliberately views the ring plane from 20 degrees latitude. A separate Saturn from Earth preset follows the geometric Earth-Saturn sightline at the selected simulation date. It magnifies the view, uses equatorial north for camera roll and does not change the clock. It omits light-time and topocentric corrections; the default epoch remains J2000.

## Numerical validation

Using the bundled planet ephemerides, signed opening angles (north face positive) are:

| UTC, 12:00 | Ring opening |
| --- | ---: |
| 2025-03-23 | +0.01275 deg |
| 2026-10-02 | -7.51632 deg |
| 2032-06-01 | -26.90081 deg |

The sign changes between March 22 and 25, 2025, consistent with NASA's March 23 Earth ring-plane crossing date. These values describe this geometric model, not an apparent-place observing ephemeris.

At 2026-10-02 12:00 UTC the orbital normals from the bundled JPL moon anchors differ from Saturn's ring normal by 0.0089 degrees for Enceladus, 0.0291 for Dione, 0.3053 for Rhea and 0.4038 for Titan. Iapetus remains inclined by 15.8118 degrees; moon paths were not flattened to match the rings.

## Verification

- All 639 unit tests passed, including pole frame conversion, quaternion norm and repeatability, angular velocity, Earth ring crossing, moon inclinations and observer camera invariance under body spin and floating-origin changes.
- TypeScript and ESLint passed for the changed source and tests.
- Playwright captured the Earth-view preset at all three dates, checked the 390-pixel mobile layout and recorded no browser errors.
- Browser wheel measurements confirmed a 4x logarithmic dolly rate with Shift held. Normal scrolling restores the base rate; existing camera distance bounds remain active.
- Reproduce browser checks with `node scripts/verify-saturn-orientation.mjs`; set SATURN_REVIEW_URL to test another deployment. Captures and numerical camera records are written to tmp/saturn-review by default.

## Sources

- [NASA/JPL NAIF pck00011](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc).
- [NASA: Hubble Views Saturn Ring-Plane Crossing](https://science.nasa.gov/missions/hubble/hubble-views-saturn-ring-plane-crossing/).
