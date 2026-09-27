# Public media on Cloudflare R2

The standard `npm run deploy` flow prepares public media after building its isolated committed snapshot. It copies new or changed media to `iom-website-assets`, verifies the public object and byte ranges, generates exact URL rewrites, and removes verified media copies only from the temporary deployment package. Local originals stay in `public/`.

The runtime site keeps its existing URLs. The corresponding R2 destination contains a SHA-256 content hash. Updates get a new key; old objects remain available for previous deployments and rollback. Site URLs must revalidate so an updated file at the same path is not held in a browser for a year.

## Adding future media

Add or update supported images, audio, video, documents, fonts, models or textures under `public/`, commit the intended project scope, and use the usual `npm run deploy -- --scope ...` command. New committed media in that release is handled automatically. Files excluded by the Vercel upload manifest remain excluded.

Upload credentials are read locally from the git-ignored `.env.r2-assets.local`. The dedicated bucket-scoped upload credential is separate from the temporary Cloudflare administration token; expiration of that administration token does not disable ongoing uploads. No upload credential is put in the frontend or temporary release package.

`--verify-only` never uploads a missing object: it stops with the missing path. Public R2 availability, CORS and byte ranges are required before copies can be removed from the isolated package. A changed build copy, failed upload, unsupported path or excessive route count stops publication.

## Implementation and validation

- `config/website-r2.json` enables the integration in a committed snapshot.
- `scripts/prepare-r2-release.mjs` scans only public files included in Vercel's upload manifest, uploads immutable objects and prepares source/config changes in an isolated release.
- `scripts/finalize-r2-build.mjs` validates any remaining build copies before removing them. Raven assets are generated and uploaded by the initial isolated build; the remote build verifies that manifest instead of regenerating those assets.
- `node --test scripts/test-r2-release.mjs` checks that altered content or invalid paths cannot cause partial cleanup, originals remain intact, and route/cache constraints are enforced.

Initial migration release scope: `media-assets`. Production is always published through `npm run deploy`, with preview and public URL checks completed first.
