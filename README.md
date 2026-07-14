# IOM — Interactive Object Media

Agency website for **IOM (Interactive Object Media)** — a studio building software, 3D experiences, immersive tours, photography, music, and creative experiments.

**3D Viewer** ([3dbviewer.com](https://3dbviewer.com/)) is featured as one product among the portfolio. **IOM-Three** ([iom-three.vercel.app](https://iom-three.vercel.app/)) appears in Experiments.

## Design

- Dark cinematic aesthetic inspired by high-end interactive studios (e.g. Lusion)
- Electric cyan accent on deep charcoal
- Three.js hero “viewer object” with orbit-style HUD chrome
- CMS/archive-style project grid across six sections
- Raven mascot video in the header (`public/assets/raven.mp4`)

## Tech stack

- **Vite 6** + **React 19** + **TypeScript**
- **Three.js** for the hero 3D scene (vanilla, no R3F — lightweight)
- CSS custom properties, responsive layout, intersection-observer reveals

## Run locally

```bash
cd F:\iom_website
npm install
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

## Build for production

```bash
npm run build
npm run preview
```

## Project structure

```
iom_website/
├── public/
│   ├── assets/raven_crop.mp4  # Header mascot (~2.4 MB, shipped)
│   └── favicon.svg
├── src/
│   ├── components/         # Header, Hero, cards, sections
│   ├── data/projects.ts    # Section definitions + sample projects
│   ├── three/useHeroScene.ts
│   ├── App.tsx
│   └── index.css
└── package.json
```

## Sections

| Section      | Contents                                      |
|-------------|-----------------------------------------------|
| Software    | 3D Viewer, Streets GL Bridge, 360° Panorama Tour Editor, CRM Demo, Raven Path Animation  |
| 3D          | Art Gallery SSR, Dream — Ocean narrative, Volumetric Lighting  |
| 360 Tours   | The Black Witness — 360° Tour                 |
| Photography | Concrete & Light, Night Grid (samples)      |
| Music       | Tidal Score, Room Tone (samples)            |
| Experiments | IOM-Three (logo, Dream — Ocean ch. 1/9, weather runtime, shaders) |

## Notes

- Placeholder projects use archive IDs and sample copy; replace URLs and descriptions as real work ships.
- Header video uses `raven_crop.mp4` (~2.4 MB). The full-resolution `raven.mp4` source is kept in `_source/` (gitignored, not deployed).
- Mobile: hero uses 22 raymarch steps, DPR 1, single raven, 30 fps; embed iframes show static fallback.
- Desktop GPU budget (hero + embeds):
  - **Hero**: iq cloud raymarch (40 steps default, 36 mid-tier), DPR capped at 1.5, pauses when &lt;10% visible or tab hidden; mid-tier desktops use 2 ravens and 45 fps.
  - **Embeds**: at most **one** live iframe WebGL preview at a time; iframes unmount when scrolled away (&lt;12% visible).
  - **Ocean demo**: DPR capped at 1.5, render loop pauses when tab hidden.
  - **`prefers-reduced-motion`**: static hero gradient (no WebGL), header video shows poster only.
- Contact: `hello@iom.studio` (mailto in About + Footer).
- Custom domain DNS is user-managed — deploy target is `https://iomwebsite.vercel.app`.

## License

Private / agency use.
