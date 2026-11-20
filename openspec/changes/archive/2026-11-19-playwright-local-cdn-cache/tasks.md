# Tasks: On-Demand Disk Package Downloading & Local CDN Cache (`playwright-local-cdn-cache`)

> **Companion Dashboard:** [index.html](index.html) | **Proposal:** [proposal.md](proposal.md) | **Design:** [design.md](design.md) | **Delta Spec:** [playwright-local-cdn-cache](specs/playwright-local-cdn-cache/spec.md)

## Phase 1: On-Demand Disk Vendor Cache (`@html-report/core`)

- [x] 1.1 Add `.cache/` to `.gitignore` and create `packages/core/scripts/lib/build/vendor-disk-cache.mjs` to extract and lazily download only the CDN URLs used by a report (`Core 4` + active addons).
- [x] 1.2 Implement atomic disk read/write (`<sha256>.body` + `<sha256>.meta.json`) and optional SRI integrity verification in `vendor-disk-cache.mjs`.

## Phase 2: Playwright Disk Interception (`cdn-cache.mjs` & `runner.mjs`)

- [x] 2.1 Create `packages/core/playwright/harness/cdn-cache.mjs` (`attachCdnDiskCache`) to serve cached packages from disk in `<1ms` and lazily download+persist cache misses on demand.
- [x] 2.2 Wire `attachCdnDiskCache()` into `packages/core/playwright/harness/runner.mjs` and add `--no-cdn-cache` / `--cache-dir` flags in `packages/core/playwright/verify-report.mjs`.

## Phase 3: Verification & Live Journey Sync

- [x] 3.1 Add unit and Playwright tests verifying on-demand disk downloading, cache hit fulfillment (`0` external network requests on second run), and `--no-cdn-cache` opt-out.
- [x] 3.2 Update companion [index.html](index.html) and sync `implementation-progress.html` on `localhost:3031`.
