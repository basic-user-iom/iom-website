# Stradivari V12 client review

Build only this demo from the repository root: `node demos/stradivari-cable/build.cjs`.

The four source viewers rebuild into `public/demos/stradivari-cable/`. Exact model and HDR bytes use immutable URLs on the existing assets.iobjectm.com host. They passed the existing release scanner, SHA-256 verification, CORS and byte-range checks before the public copies were removed from the deployment package. See `media-manifest.json`. Original Blender and runtime media files remain in the local V12 authoring workspace.

Release through `npm run deploy -- --scope demo:stradivari-cable`. No scanner limits, shared configuration, access settings or other demos are changed.
