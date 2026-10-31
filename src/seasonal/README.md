# IOM seasonal themes

The neutral setting is **off**. The currently approved manual selection is **Halloween**. This layer changes public-site accents and decorative CSS only. It never schedules holidays or changes content, demos, models, emails or CRM.

## One production switch

Set `ACTIVE_SEASONAL_THEME` in `src/seasonal/config.ts`:

```ts
export const ACTIVE_SEASONAL_THEME: SeasonalThemeSelection = 'halloween'
// Restore the original site:
export const ACTIVE_SEASONAL_THEME: SeasonalThemeSelection = 'off'
```

Changing production requires the normal reviewed site release. From a clean, synchronized release checkout, commit only the seasonal change and use `npm run deploy -- --scope seasonal-theme`. The scope preserves the existing production composition; do not use a full-site release to switch the theme.

## Local review

On a localhost Vite dev server, open `/?iom-season=halloween`. The selection is remembered **only for that browser tab**, so normal site links and language switching retain the preview. Open `/?iom-season=off` to turn it off. `default`, unknown IDs and unfinished themes also resolve to off. Close the tab to discard its preview; clear session key `iom:seasonal-preview:v1` to return to the configured value without closing it.

Preview queries and storage are ignored in production builds. The query remains functional if browser storage is unavailable; navigation then follows the configured value unless the query is retained.

## Scope and accessibility

Only home, blog, case studies, pricing (`/project-costs`, `/start`) and privacy/terms/cookies pages are eligible, in the site's six locales. Tools, CRM, recordings, standalone demos, unknown routes, iframe documents and any `?embed` route are excluded. CSS custom properties do not cross iframe boundaries.

The Halloween palette uses warm orange and a quiet violet secondary detail. Text, photography and 3D assets retain their original colors. The two small pumpkin lanterns are decorative SVG backgrounds, contain no readable text and receive no focus/pointer events. A gentle 5.8-second sway/bob and small opacity change suggest warm lantern light. The halo is drawn into the SVG: only transform and opacity animate, with no animated blur, shadow or filter. The local SVG is inlined by the production build; no video, 3D, audio, timers or new dependencies are added. Animation pauses while the document is hidden. Reduced-motion users receive a fully static pumpkin. Print and forced-colors modes suppress decoration and animation. Off removes both marks and all theme animation.

## Add a reviewed theme

1. Add its ID/name to `registry.ts` with `status: 'planned'` while preparing it.
2. Add scoped rules under `html[data-iom-season='your-id']` in `seasonal.css`. Keep every selector scoped; do not style canvases, media, embeds or operational tools.
3. Check original/off equivalence, exclusions, keyboard focus, contrast, mobile, all locale routes, print and reduced motion.
4. After review, mark it `ready` and manually select it in `config.ts` when desired.

Christmas, Easter, Chinese/Lunar New Year and Hanukkah are placeholders only. They have no visual treatment or activation dates. Any future date scheduling needs explicitly reviewed dates/timezone and activation approval; movable dates must not be guessed.

## Remove completely

Remove the `SeasonalTheme` import and `<SeasonalTheme />` from `src/main.tsx`, then delete `src/seasonal/` and `tests/seasonal-theme.test.mjs`. No data migrations, storage migrations or asset cleanup are required. Off already removes the root attribute and leaves original CSS untouched.
