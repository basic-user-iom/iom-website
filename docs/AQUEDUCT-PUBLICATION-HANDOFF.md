# Aqueduct editorial candidate — awaiting public demo URL

Isolated checkout: F:/iom_website/.qa-out/release-worktrees/aqueduct-publication-20261106
Branch: codex/aqueduct-publication-20261106
Source baseline: be1a50d5e410fdd9d3d9e78d72ee4155c7715c19
Observed live production: dpl_3htf1ivjg2ajpv1upExZ72GFwN9g. This supersedes the October 27 Storm baseline. Remote source is preparation input only: it does not establish that all current production overlays are represented. Re-read full live composition before any publication.

## Prepared

AQVA card immediately before Gallery of Light in the 3D section. Storm remains first and featured. Every pre-existing project record is deep-equal to the source baseline. No CSS or shared ProjectCard change. Three optimized WebP copies of actual offline Blender renders: overview 49,210 bytes (1280 px), mobile overview 9,212 bytes (400 px), cutaway 82,948 bytes (1280 px). Originals unchanged. Captions explicitly identify offline renders, not browser screenshots.

Six localized card descriptions and articles: EN, DE, FR, NL, IT, ES. Article describes observed chapter/cutaway/flow-marker controls and clearly calls the scene illustrative, not a surveyed monument or hydraulic simulation. No invented historical dates, clients or performance claims. Demo UI is described accurately as English. Static article emitter includes localized metadata, canonical URLs, hreflang and sitemap entries. Exact four blog rewrite rules precede the SPA route. Existing CMS merge retains deduplication and requires no database write.

The public demo URL is intentionally null. The card has a working localized article link but no invented demo link; the existing card component shows its normal SAMPLE fallback until the actual URL is supplied. This is a preparation state, not the final publishable card. When a verified HTTPS URL arrives, populate demoUrl, add a localized demo CTA to each article, rebuild and check Open/CTA targets. Update publication date if release moves beyond November 6.

## Verification

TypeScript passed. Local editorial build passed. Focused test passed: preservation/order, all six locales, no localhost URL, static titles/canonicals/hreflang, sitemap entries, cross-links, CMS deduplication and exact image copies.

A separately approved headless Chromium tested the isolated website at 1280x900 and 390x844 in all six locales: 12 cases passed. Card images decoded, Storm remained first, AQVA preceded Gallery, article links opened their expected new tab, description click expansion and keyboard Enter collapse worked, and home/article widths did not overflow. External requests were blocked; no live database or CRM API was used. Screenshots were visually inspected, including Spanish mobile card/article and English desktop card/article. No foreground Chrome or CUA interaction.

Evidence (local, excluded from publication): .qa-out/aqueduct-browser/results.json, eight PNGs in that folder, aqueduct-browser.log, aqueduct-types.log, aqueduct-build.log. Original touched files are backed up under .qa-out/aqueduct-originals.

Standalone demo mobile rendering and interaction are not covered by these website tests. The source project's README and SOURCES-AND-LICENSES still note unverified distribution rights for selected library assets; coordinate with the standalone worker for current owner confirmation/rights resolution before publication. The supplied placement screenshot was not materialized; explicit requested ordering was sufficient. Actual source renders were inspected locally.

## Publication hold

No push, deployment, CMS write, shared checkout edit or standalone project change occurred. Shared F:/iom_website has many unrelated modifications, including CRM. Do not merge/copy that working tree. The exact proposed source scope is in AQUEDUCT-PUBLICATION-SCOPE.json; release tooling has not been widened or registered for this scope. Wait for the confirmed standalone URL and CRM coordinator. Use a fresh full composed production snapshot preserving WDA, seasonal changes, CRM/store/provenance and all other current overlays/media. Never deploy sparse dist. Only the repository's guarded npm run deploy workflow may publish after scope review and full verification.

Intended article routes: /blog/roman-aqueduct-living-water and /de, /fr, /nl, /it, /es prefixes. No case study was requested or added.
