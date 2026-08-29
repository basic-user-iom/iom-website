# Disabled manifest-v3 release gate

This gate assembles a production-shaped Web/Quest streaming candidate only after every input is exact-file pinned and independently validated. It never edits `public/models/manifest.json`, production GLBs, application routes, or activation flags. Both emitted manifests and the generated entry snippet always contain `enabled: false`.

## Commands

Create an exact request from an audited candidate and its evidence:

```powershell
npm run model:prepare-disabled-manifest-v3-request -- `
  --model-id icm-anim-2025 `
  --index tmp/<candidate>/detail-package-index.json `
  --audit tmp/<candidate>/shell-package-audit.json `
  --shared-evidence tmp/<candidate>/shared-texture-release-evidence.json `
  --browser-qa tmp/<candidate>/shared-texture-browser-qa.json `
  --shell-review tmp/<shell-review>/shell-visual-approval.json `
  --output tmp/<review>/request.json
```

Run the read-only review. A missing approval produces a successful command with a `blocked-fail-closed` report; it does not create a candidate:

```powershell
npm run model:review-disabled-manifest-v3-candidate -- `
  tmp/<review>/request.json `
  tmp/<review>/review.json
```

Only after the review reports `ready-for-disabled-candidate-emission`, create a new output directory:

```powershell
npm run model:emit-disabled-manifest-v3-candidate -- `
  tmp/<review>/request.json `
  tmp/<new-disabled-candidate>
```

The emitter refuses an existing output directory. A successful output contains:

- `manifest-v3-web.json` and `manifest-v3-quest.json`, each carrying the complete dual-variant runtime contract and an independent target-variant/hash pin;
- `disabled-hlod-streaming-entry.json`, with both entry and streaming flags disabled;
- copied, verified source/rig/collision/package assets below `assets/`;
- immutable audit, collision, texture and shell-review evidence below `evidence/`;
- `candidate-report.json` recording every passed gate.

## Fail-closed gates

Emission is rejected when any of these conditions is present:

- the shell is absent, unapproved, not persistent, or still requires ownership repartition;
- shell/detail source ownership overlaps or does not exactly cover the animated owner;
- the shell audit is missing, not `--require-shell`, has failures, or has stale coverage/payload pins;
- a production source, current animation rig, stream rig, collision file, contract, coverage report, package index, audit, or QA document differs from its SHA-256/byte pin;
- an offline payload inspection finds stale triangles, draws, bytes, bounds, texture costs, attributes, animation, cameras/lights, or source-path ownership;
- any embedded image lacks an exact `iomSharedTexture` content-hash/byte annotation;
- shared-texture evidence does not cover every Web/Quest runtime payload, or browser QA does not prove compatible GPU texture reuse;
- the existing collision activation validator rejects the exact GLB/contract/coverage bundle;
- the existing manifest-v3 validator rejects either final exact-file manifest.

## Current review state

The exact current evidence is pinned at `tmp/manifest-v3-release-candidate-review/request.json`. Its review is `tmp/manifest-v3-release-candidate-review/review.json` and is intentionally `blocked-fail-closed`: collision activation passes, but `shellCompletion.ready` is false and the projection audit explicitly requires manual structural-coverage approval. No manifests or copied release assets were emitted.

