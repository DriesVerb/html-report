# Design: Core Runtime Chart Palette/Legend & Playwright Harness Fixes

> **Change:** `eval-runtime-and-harness-fixes` | **Proposal:** [proposal.md](proposal.md) | **Tasks:** [tasks.md](tasks.md) | **Journey:** [index.html](index.html)

## Technical Decisions

### 1. 8-Token Semantic Palette & Compact Legend Defaults
- **Files**: `packages/core/assets/runtime/02-theme-switcher.js`, `packages/core/assets/runtime/05b-widget-hydrators.js`.
- Extend `paletteSequence` from 7 to 8 semantic DaisyUI tokens:
  `["primary", "secondary", "accent", "info", "success", "warning", "error", "neutral"]`.
- In `initDeclarativeCharts()`, when `baseChartType` is `"pie"`, `"doughnut"`, or `"polararea"` and `labels.length > 4`:
  - Default `legend.position` to `"bottom"` (only when `undefined`).
  - Default `legend.labels.boxWidth` to `10` and `legend.labels.padding` to `8` (only when `undefined`).

### 2. Playwright Harness `isTargeted` & Dual-Viewport Review Capture
- **File**: `packages/core/playwright/harness/runner.mjs`.
- Restrict `isTargeted` key prefix matching to `k.startsWith("check")` so `options.cdnCache === true` does not misclassify standard runs as `TARGETED`.
- During `--review-packet` capture, snapshot `review_desktop` at `1280x900`, resize to `640x800` for `review_mobile`, and restore `1280x900` before DOM inventory evaluation.

### 3. Verification & Commit Scope
- Validate with `node --test packages/core/tests/runtime-assets.test.mjs packages/core/tests/playwright-harness.test.mjs packages/core/tests/codebase-digestibility.test.mjs`.
- Sync delta specs to `openspec/specs/`, archive the change via `openspec archive`, and commit only Plan 1 files (`packages/core/**`, synced specs, archived change, and `implementation-progress.html`).
