# Automotive Studio code review

**Date:** 2026-08-10  
**Reviewed scope:** `public/demos/automotive-studio/` and its source in `automotive-studio/`  
**Review mode:** Read-only inspection and validation; no application code or production assets were changed.

## Executive summary

The generated production output is structurally coherent: its JavaScript bundles parse, its HTML asset references resolve, strict TypeScript checking passes, and the shared demo-gate validation passes. The implementation is not release-ready, however. The review identified a high-risk cross-project data-loss path, missing enforcement for the stated access policy, one consistently failing behavioral test, and several correctness, resource-management, and security issues.

## Findings

### 1. High — saving one project can delete assets belonging to other projects

`purgeOrphanAssetBlobs()` reads every blob ID from the shared Automotive Studio IndexedDB database, but calculates references from only the currently active project. It then deletes every blob not referenced by that one project.

Manual Save enables this purge. Because the application can retain multiple project documents and resolve projects by ID, saving project B can remove GLBs, textures, videos, or hotspot media still required by project A. Project A's metadata remains, but restoring it later can fail because its blobs are gone.

Evidence:

- [`assetGc.ts`](../automotive-studio/src/persistence/assetGc.ts#L50) compares the global blob list against one `AutomotiveProject`.
- [`studio-main.ts`](../automotive-studio/src/studio-main.ts#L150) enables orphan purging during manual Save.
- [`localDb.ts`](../automotive-studio/src/persistence/localDb.ts#L103) lists multiple stored project summaries.

Recommended fix:

Build the referenced-asset set across every saved project before deleting any blob. Alternatively, namespace blobs by project and only collect within that namespace. Add a test with two saved projects sharing and not sharing assets, then verify that saving either project preserves every blob referenced by the other.

### 2. High — the stated access policy is not enforced

The Studio and Presentation pages describe themselves as local-only or access-controlled, but they are static files under `public/demos/` and no route-level authentication protects them. `ACCESS.txt` explicitly says edge authentication does not exist yet.

This does not expose another visitor's IndexedDB data, and the artifact check excludes prototype GLBs, but it does publicly expose the authoring application and contradicts the documented access policy.

Evidence:

- [`ACCESS.txt`](../public/demos/automotive-studio/ACCESS.txt#L5) says access control is pending edge authentication.
- [`index.html`](../public/demos/automotive-studio/index.html#L10) labels the authoring shell access-controlled/local.
- [`presentation.html`](../public/demos/automotive-studio/presentation.html#L10) labels the client shell access-controlled.
- [`vercel.json`](../vercel.json#L17) excludes `/demos/` from the SPA rewrite but defines no authentication rule for this route.

Recommended fix:

Add real edge or platform authentication before production deployment, or intentionally classify the shell as public/unlisted and remove claims that access is enforced. Keep the build-time GLB/source-map exclusion as a separate defense.

### 3. Medium — the lamp-beam behavioral test fails

The `lampBeams.ts` test consistently fails because the synthetic vehicle ends with zero tail-light proxies where one is expected. The asymmetric-tail promotion logic changes the only tail target into an indicator target. That leaves no target in the tail group for marker-proxy creation and can make the tail count or control appear inert.

Evidence:

- [`vehicleLights.ts`](../automotive-studio/src/vehicle/vehicleLights.ts#L900) promotes outer tail targets to indicators.
- [`vehicleLights.ts`](../automotive-studio/src/vehicle/vehicleLights.ts#L1946) mutates the existing target's group.
- [`lampBeams.ts`](../automotive-studio/src/tests/lampBeams.ts#L147) expects one tail proxy and receives zero.

Observed failure:

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
0 !== 1
```

Recommended fix:

Preserve the original tail target when deriving an indicator target, most likely by cloning the binding/material state needed for the indicator rather than reclassifying the only tail binding. Keep the tail and indicator visual behavior independent, then rerun the complete lamp suite.

### 4. Medium — shared mutable stage textures can overwrite each other's settings

Stage textures are cached by asset ID and the same `Texture` object is reused across bindings. During material application, that shared object is mutated with per-surface and per-map-slot repeat, offset, rotation, anisotropy, and color-space settings.

If the same uploaded texture is assigned to multiple stage surfaces or slots with different settings, the most recent application wins globally. Earlier materials can silently change appearance. Concurrent cache misses for the same ID can also create duplicate textures/object URLs before either request populates the cache.

Evidence:

- [`stageMaterials.ts`](../automotive-studio/src/stage/stageMaterials.ts#L16) caches one texture per asset ID.
- [`stageMaterials.ts`](../automotive-studio/src/stage/stageMaterials.ts#L34) does not deduplicate in-flight loads.
- [`stageMaterials.ts`](../automotive-studio/src/stage/stageMaterials.ts#L327) mutates the cached texture's binding-specific transform.

Recommended fix:

Cache the immutable loaded source and clone a texture for each material binding, or include binding/transform properties in the cache key. Track in-flight promises by asset ID to prevent duplicate loads and revoke every superseded object URL.

### 5. Medium — asynchronous hotspot rendering is not cancellation-safe

`show()` waits for IndexedDB media blobs before updating the card. There is no request generation token or abort state. If the user closes a hotspot or opens another hotspot while an image/video is loading, the older request can finish later and repopulate or overwrite the card.

The same race can also revoke object URLs belonging to a newer request.

Evidence:

- [`hotspotCard.ts`](../automotive-studio/src/hotspots/hotspotCard.ts#L32) closes and clears the current card.
- [`hotspotCard.ts`](../automotive-studio/src/hotspots/hotspotCard.ts#L45) starts asynchronous rendering without a generation guard.
- [`hotspotCard.ts`](../automotive-studio/src/hotspots/hotspotCard.ts#L74) awaits media before committing the card at line 100.

Recommended fix:

Increment a render generation for every `show()` and `close()`. After each await, stop and revoke newly created URLs if the generation is stale. Commit DOM content only when the request is still current.

### 6. Medium security — imported hotspot URLs are not scheme-validated

Hotspot CTA URLs are escaped for HTML attributes, but escaping does not make a URL safe. Imported project data can provide `javascript:`, `data:`, or other unwanted schemes. CTA links place the value directly in `href`, while `link.open` passes it to `window.open()`.

The plain JSON import path also loads parsed data directly without migration or runtime validation.

Evidence:

- [`studio-main.ts`](../automotive-studio/src/studio-main.ts#L183) parses and loads JSON directly.
- [`hotspotCard.ts`](../automotive-studio/src/hotspots/hotspotCard.ts#L71) inserts the escaped URL into `href`.
- [`hotspotCard.ts`](../automotive-studio/src/hotspots/hotspotCard.ts#L196) opens an action URL without scheme validation.

Recommended fix:

Normalize imported projects through one strict runtime validator. Permit an explicit URL-scheme allowlist such as `https:`, optionally `http:` for local development, and approved `mailto:`/`tel:` use cases. Reject or disable every other scheme before rendering and again before opening.

### 7. Medium — cyclorama “contain” mode does not provide contain behavior

The contain branch uses centered texture repeats below `1`, which samples a smaller portion of the source and stretches/crops it across the wall. It does not create letterboxing or preserve the complete frame as object-fit `contain` would.

Evidence:

- [`cycloramaVideo.ts`](../automotive-studio/src/stage/cycloramaVideo.ts#L44) implements cover.
- [`cycloramaVideo.ts`](../automotive-studio/src/stage/cycloramaVideo.ts#L54) implements the current contain branch using cropping-style UV transforms.

Recommended fix:

Implement contain with a shader or geometry/material layout that renders the full video and fills the unused area with a selected background color. Add tests for both wide-video/narrow-wall and narrow-video/wide-wall cases.

### 8. Low/medium — preview object URLs are never disposed by callers

The stage-map preview module exposes per-asset revocation and full disposal functions, but neither function is called elsewhere in the source. A long authoring session that imports or replaces many high-resolution maps can retain their blobs through object URLs until the entire page unloads. Concurrent preview requests for the same uncached ID can also create an untracked duplicate URL.

Evidence:

- [`stageMapPreviews.ts`](../automotive-studio/src/stage/stageMapPreviews.ts#L3) stores preview URLs indefinitely.
- [`stageMapPreviews.ts`](../automotive-studio/src/stage/stageMapPreviews.ts#L16) defines revocation functions that currently have no callers.

Recommended fix:

Revoke a preview URL when its asset is removed and call full disposal during Studio teardown. Deduplicate in-flight preview requests.

## Validation results

The following read-only checks were completed:

- Strict Automotive Studio TypeScript check: passed.
- Generated JavaScript syntax check: all 7 bundles passed.
- HTML asset-reference verification: every referenced bundle and stylesheet exists.
- Shared demo-card gate validation: passed for all 24 `/demos/` archive embeds.
- Git diff whitespace/error check for Automotive Studio files: passed; only line-ending conversion warnings were reported.
- Behavioral TypeScript tests: 21 of 22 passed.
- Consistent failing test: `src/tests/lampBeams.ts`.

The full production build was intentionally not run because it empties and rewrites `public/demos/automotive-studio/`, which was outside the requested read-only review.

## Generated-output and release-state note

The current HTML references the new hashed bundle names correctly, and those files exist locally. However, the new bundles are currently untracked while the previous hashed bundles are deleted. Any eventual commit must include both the HTML changes, removal of obsolete bundles, and all replacement bundles together. Otherwise production HTML will reference files absent from Git.

## Recommended order of work

1. Fix cross-project asset garbage collection and add multi-project data-preservation tests.
2. Decide and enforce the real production access policy.
3. Repair the tail/indicator target promotion and make all behavioral tests pass.
4. Isolate stage texture instances and deduplicate asynchronous texture/preview loads.
5. Add cancellation guards to hotspot media rendering.
6. Add strict imported-project validation and URL-scheme allowlisting.
7. Correct cyclorama contain rendering and clean up preview object URLs.
8. Run the full Automotive Studio build, inspect generated output, and commit source plus replacement bundles atomically.

