# Stradivari V12 client review

Build only this demo from the repository root: `node demos/stradivari-cable/build.cjs`.

The four source viewers rebuild into `public/demos/stradivari-cable/`. Runtime model, texture and comparison-image assets are preserved in that public directory. Original Blender source files are retained in the local V12 authoring workspace.

Release through the guarded workflow: `npm run deploy -- --scope demo:stradivari-cable`. No shared configuration or other demo is part of this scope.
