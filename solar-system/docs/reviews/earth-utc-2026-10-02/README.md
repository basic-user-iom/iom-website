# UTC Earth orientation and header order

The Earth previously inherited the generic seed rotation: Greenwich had a zero phase at J2000, and the tilt axis pointed to negative ecliptic Y. Consequently a geographic location could be shaded as night at a UTC time when it was in daylight. Pausing the simulation was not the cause of that error.

Earth now uses Greenwich mean sidereal rotation and the inverse IAU 1976 precession, followed by the equatorial-J2000 to ECLIPJ2000 transform. Geographic Greenwich/east/north axes, the surface normal, night-light mask and sunlight shader use the same orientation. Ephemeris positions and catalog physical parameters are unchanged. Time remains global UTC, independent of the browser's locale or time zone. The displayed stage date now explicitly says UTC. Paused time still remains paused.

At the reported 2026-10-02 14:30:33 UTC, the subsolar point is approximately 3.732 degrees south, 40.307 degrees west. The independent USNO solar-coordinate approximation gives 3.728 degrees south. The prior model failed the daylight regression at 45 N, 15 E; the corrected model gives a solar elevation of about 20.8 degrees there. This coordinate is a regression sample, not a location setting.

Back to IOM now precedes the Solar System / Living Observatory brand in DOM order and visual order. Its destination and behavior are unchanged.

## Validation

- 673 unit tests passed, including 17 Earth orientation tests.
- Independent USNO comparisons for 48 monthly dates in 2000, 2026, 2050 and 2099 differ by less than 0.04 degrees in subsolar direction; additional NOAA comparisons cover the screenshot epoch, equinoxes and solstices.
- Continuous UTC midnight crossing, reverse/unordered sampling, normalized quaternions and angular velocity checked.
- Chromium verification: identical Earth orientation, lighting and simulation epoch in UTC, America/Los_Angeles and Asia/Tokyo browser time zones at the same fixed instant.
- Actual renderer surface-normal lighting and body-local day/night lighting agree. Changing the UTC input updates the Earth rotation.
- Header order, single back link, 44 px touch height and no horizontal overflow verified at 360x800, 390x844, 768x1024, 1366x768 and 844x390.
- TypeScript, changed-source ESLint, asset validation and production build passed. Browser console and page error collections were empty.
- Desktop and mobile screenshots are Chromium desktop/emulation evidence. No physical mobile-device test was performed.

## Approximation boundaries and references

UTC is used as a UT1 approximation; TDB approximates TT for precession. Nutation, polar motion and measured Earth-orientation corrections are not included. The shared app time converter retains its existing fixed leap-second approximation; this is adequate for this visualization, not precision geodesy.

- [USNO mean sidereal time](https://aa.usno.navy.mil/faq/GAST)
- [USNO independent solar coordinates](https://aa.usno.navy.mil/faq/sun_approx)
- [ERFA IAU 1976 precession angles](https://github.com/liberfa/erfa/blob/master/src/prec76.c)
- [NOAA solar equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF)
