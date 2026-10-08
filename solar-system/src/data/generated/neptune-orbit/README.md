# Neptune orbit display extension

JPL Horizons target 899, geometric vectors relative to 500@10, ICRF/ecliptic,
TDB, daily samples from 1917-01-01 to 2183-01-01. SI double-precision data use
the existing IOMEPH binary format. See the manifest for retrieval dates, source
solution, checksum and provenance.

Used only to draw a complete 60,190-day Neptune path throughout the existing
2000-2100 simulation clock. OrbitDisplayProvider always selects the original
live provider inside its coverage. Planet positions, lighting, satellite
parameters and the clock range are unchanged. A sampled perturbed path remains
open; its endpoints are not artificially joined.

Regeneration (from solar-system):

```sh
node scripts/ephemeris/generate-ephemeris.mjs --body neptune --start 1917-01-01 --end 2183-01-01 --step 1d --output-dir src/data/generated/neptune-orbit
node scripts/ephemeris/fetch-validation-references.mjs --manifest src/data/generated/neptune-orbit/solar-system-ephemeris.manifest.json --body neptune --intervals 8 --output src/data/generated/neptune-orbit/validation-references.json
node scripts/ephemeris/validate-ephemeris.mjs --binary src/data/generated/neptune-orbit/solar-system-ephemeris.v1.bin --manifest src/data/generated/neptune-orbit/solar-system-ephemeris.manifest.json --references src/data/generated/neptune-orbit/validation-references.json --report src/data/generated/neptune-orbit/solar-system-ephemeris.validation.json
node scripts/ephemeris/verify-neptune-orbit.mjs
```

Validation uses separate withheld quarter-day JPL TLIST epochs with the existing
2,000 m position / 0.05 m/s velocity limits. It is a finite regression sample,
not a proof of maximum error over the entire interval. The build reruns it.

If this optional bundle cannot load or fails its checksum, the original
coverage-limited Neptune arc and warning remain available.

Sources: https://ssd.jpl.nasa.gov/horizons/manual.html and
https://ssd.jpl.nasa.gov/orbits_doc.html
