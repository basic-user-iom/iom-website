# Public media on Cloudflare R2

The standard `npm run deploy` flow authenticates and pins the current production media manifest before composing its isolated committed snapshot. Unchanged media is matched to committed source identities and omitted before checkout; it is never copied into the release merely to be removed again. It copies new or changed media to `iom-website-assets`, verifies the public object and byte ranges, generates exact URL rewrites, and removes verified media copies only from the temporary deployment package. Local originals stay in `public/`.

The runtime site keeps its existing URLs. The corresponding R2 destination contains a SHA-256 content hash. Updates get a new key; old objects remain available for previous deployments and rollback. Site URLs must revalidate so an updated file at the same path is not held in a browser for a year.

## Adding future media

Existing public media paths retain compatibility and their exact rewrites. For a NEW demo, keep original media under `public/demos/<slug>/` and explicitly classify it:

```bash
node scripts/create-demo-media-manifest.mjs <slug> --visibility public
```

The helper scans the files and writes a hash-pinned `media-manifest.json`; it does not upload. Have the demo load each asset using its manifest `url` (`/_assets/<sha256>/<filename>`), rather than its original local path. Commit the manifest, original media and application in the intended demo/project scope, then use the usual `npm run deploy -- --scope ...`. New media without explicit public approval remains in the normal guarded package. Private manifests never opt into public R2; moving already-public media to private requires a separately reviewed access migration. An unlisted client demo is still public media, not authenticated private storage.

New canonical media adds no per-file routing rules: all such assets share one strict hash route and immutable cache header. The existing 2048-rule guard remains active. The helper refuses multi-file OBJ/MTL/glTF relocation; use a self-contained GLB or separately review absolute dependency references. Vercel-excluded files remain excluded. Never commit credentials or remove source originals to make a package smaller.

Upload credentials are read locally from the git-ignored `.env.r2-assets.local`. The dedicated bucket-scoped upload credential is separate from the temporary Cloudflare administration token; expiration of that administration token does not disable ongoing uploads. No upload credential is put in the frontend or temporary release package.

`--verify-only` never uploads a missing object: it stops with the missing path. Public R2 availability, CORS and byte ranges are required before copies can be removed from the isolated package. A changed build copy, failed upload, unsupported path or excessive route count stops publication.

## Implementation and validation

- `config/website-r2.json` enables the integration in a committed snapshot.
- `scripts/prepare-r2-release.mjs` scans only public files included in Vercel's upload manifest, uploads immutable objects and prepares source/config changes in an isolated release.
- `scripts/finalize-r2-build.mjs` validates any remaining build copies before removing them. Raven assets are generated and uploaded by the initial isolated build; the remote build verifies that manifest instead of regenerating those assets.
- `node --test scripts/test-r2-release.mjs` checks that altered content or invalid paths cannot cause partial cleanup, originals remain intact, and route/cache constraints are enforced.

Initial migration release scope: `media-assets`. Production is always published through `npm run deploy`, with preview and public URL checks completed first.

## Reviewed public data

Three existing Solar System astronomy JSON files (the BSC5P bright-star catalogue and the published small-body ephemeris manifest/validation) are explicitly allowlisted by exact URL in `r2-release-manifest.mjs`. They use the same immutable hash, source-preservation, CORS, range, and build-copy checks as media. Arbitrary JSON, private records, app code and runtime decoder libraries remain ineligible. A newly hashed dataset filename needs an explicit public-access review before adding it.

Two large generated Solar System numerical-data modules (`spacecraft-data-BAKJSIXU.js` and `moon-anchor-data-BR6eL6pP.js`) are also explicitly reviewed by exact URL. They contain public Horizons tables and exports, with no imports or engine logic. They retain JavaScript MIME type and their existing same-origin URLs through the R2 rewrite; general JavaScript remains excluded.

## Incremental verification and rollback

Reuse receipts bind the exact committed Git blob (or validated bounded gzip recipe), deployed SHA-256 and current scanner policy. An absent/stale receipt gets a full scan; changed scanner policy or supplied known sensitive values forces rescanning. Receipts are accepted only from the authenticated current-production source manifest, checked against its provider file hash. A private access change, missing source, altered plan, hash mismatch, missing remote object, unavailable public byte range or unresolved canonical reference fails closed.

Every release rechecks all referenced R2 objects using authenticated metadata and public range/hash/CORS checks. New objects are created immutably and fully read back. No existing object is overwritten or deleted; old deployment manifests continue to reference old keys for rollback. Legacy URLs must revalidate; canonical URLs cache by content hash. The original 128 MiB file, 15,000-file, 1.2 GB pre-externalization and 1 GB final-package limits remain. Large batches of new media still need to fit those gates; existing remote payloads do not accumulate in the next package. Fresh receipt scans also have a 1.2 GB/15,000-file/120-second budget.

Validate without upload or publication with `npm run deploy -- --scope media-assets --verify-only`. New objects missing remotely deliberately stop this mode. Run `node --test scripts/test-incremental-r2.mjs scripts/test-r2-release.mjs scripts/test-deploy-secret-scan.mjs scripts/test-deploy-secret-containers.mjs` for offline integrity, private-media, missing-object, changed-policy, rollback and 50-demo growth coverage. Growth fixtures are temporary local files, never public demos.
