# Tasks: Core Runtime Chart Palette/Legend & Playwright Harness Fixes

> **Companion Dashboard:** [index.html](index.html) | **Proposal:** [proposal.md](proposal.md) | **Design:** [design.md](design.md) | **Delta Specs:** [declarative-widget-hydration](specs/declarative-widget-hydration/spec.md), [playwright-extensible-harness](specs/playwright-extensible-harness/spec.md)

## Phase 1: Audit Core Runtime & Harness Changes

- [x] 1.1 Audit `packages/core/assets/runtime/02-theme-switcher.js` and `packages/core/assets/runtime/05b-widget-hydrators.js` for 8-token `paletteSequence` (including `"neutral"`) and compact bottom legend defaults on `> 4` label pie/doughnut/polarArea charts.
- [x] 1.2 Audit `packages/core/playwright/harness/runner.mjs` to confirm `isTargeted` excludes `cdnCache` and `--review-packet` captures both `review_desktop` (`1280x900`) and `review_mobile` (`640x800`).

## Phase 2: Verification & Spec Synchronization

- [x] 2.1 Run `node --test packages/core/tests/runtime-assets.test.mjs packages/core/tests/playwright-harness.test.mjs packages/core/tests/codebase-digestibility.test.mjs` and confirm all tests pass.
- [x] 2.2 Sync delta specs (`declarative-widget-hydration` and `playwright-extensible-harness`) to `openspec/specs/` and validate with `openspec validate eval-runtime-and-harness-fixes`.

## Phase 3: Journey Update, Archive & Git Commit

- [x] 3.1 Update companion [index.html](index.html) to reflect `100%` completion (`Shipped / Archived`) and sync `implementation-progress.html`.
- [x] 3.2 Archive `eval-runtime-and-harness-fixes` via `openspec archive eval-runtime-and-harness-fixes --yes` and commit all Plan 1 changes (`packages/core/**`, synced specs, archived change, and `implementation-progress.html`) with a clear commit message.
