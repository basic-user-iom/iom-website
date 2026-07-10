# Streets GL integration (OBJ-0033)

[Streets GL](https://github.com/StrandedKitty/streets-gl) is an MIT-licensed WebGL2 renderer for OpenStreetMap data. The IOM site embeds the official live map at [streets.gl](https://streets.gl/) — no API keys required.

## Demo URLs

| Context | URL |
|---------|-----|
| IOM wrapper page | `/demos/streets-gl/` |
| Embedded map (iframe) | `https://streets.gl/` |
| Project card OPEN link | `/demos/streets-gl/` |

## Data sources (no secrets)

Streets GL pulls public tile data at runtime:

- **Vector tiles** — `tiles.streets.gl` (OSM-derived, maintained by the Streets GL project)
- **Terrain** — Esri Terrain 3D elevation tileset
- **Search** — Nominatim (OpenStreetMap)

No environment variables or API keys are needed for the embed demo.

## Vendor source (local dev / future self-host)

```bash
# One-time: clone + build into vendor/streets-gl/
node scripts/build-streets-gl.mjs

# Dev server (webpack, hot reload)
cd vendor/streets-gl
npm run dev
# → http://localhost:8080 (default webpack-dev-server port)

# Or serve production build
npm start
# → http://localhost:8080
```

`vendor/streets-gl/` is gitignored. CI/Vercel builds only ship the lightweight wrapper in `public/demos/streets-gl/`.

### Self-hosting note

The upstream webpack build hard-codes root-absolute asset paths (`/textures/…`, `/models/…`). Hosting the ~100 MB build under a subpath (e.g. `/demos/streets-gl/app/`) requires reverse-proxy rewrites or a patched `publicPath` rebuild. The IOM demo intentionally embeds `streets.gl` until a dedicated subdomain or root-path deploy is set up.

## Related work

The 3D Viewer project (`F:\3d-viever-backup\v3.18`) includes `streets-gl-alt` — a forked copy used for OSM ground-layer bridge experiments in the desktop viewer. That integration is separate from this portfolio embed.

## License

Streets GL — [MIT](https://github.com/StrandedKitty/streets-gl/blob/master/LICENSE). OpenStreetMap data — [ODbL](https://www.openstreetmap.org/copyright).
