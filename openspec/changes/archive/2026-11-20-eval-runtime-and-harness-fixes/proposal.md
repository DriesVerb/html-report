# Proposal: Core Runtime Chart Palette/Legend & Playwright Harness Fixes

> **Change:** `eval-runtime-and-harness-fixes` | **Journey Companion:** [index.html](index.html) | **Design:** [design.md](design.md) | **Tasks:** [tasks.md](tasks.md) | **Delta Specs:** [declarative-widget-hydration](specs/declarative-widget-hydration/spec.md), [playwright-extensible-harness](specs/playwright-extensible-harness/spec.md)

## Why

Empirical evaluation (`projects/agent-skill-eval-v2`) of the `html-report` pipeline surfaced two `@html-report/core` regressions/UX gaps:

1. **8+ Slice Pie/Doughnut Charts & Legend Sizing**: `paletteSequence` in `05b-widget-hydrators.js` and `02-theme-switcher.js` only included 7 DaisyUI tokens (`primary`..`error`), causing slice 8 to wrap back to `primary`. Additionally, pie/doughnut/polarArea charts with `> 4` labels defaulted to a top legend that consumed excessive vertical height.
2. **Playwright Harness `TARGETED` Misclassification & Missing Mobile Review Shot**: In `packages/core/playwright/harness/runner.mjs`, `k.startsWith("cdn")` matched `cdnCache: true`, causing every standard verification run to report `Check Selection: TARGETED`. Furthermore, `--review-packet` only captured `review_desktop` (1280x900), omitting mobile (`review_mobile`, 640x800) visual verification.

## What Changes

1. **8-Token DaisyUI Chart Palette & Compact Bottom Legend (`02-theme-switcher.js`, `05b-widget-hydrators.js`)**:
   - Append `"neutral"` as the 8th token in `paletteSequence` across both declarative hydration and live theme switching.
   - Auto-position pie/doughnut/polarArea legends at `"bottom"` with compact `boxWidth: 10` and `padding: 8` when label count exceeds 4 and explicit options are not provided.
2. **Accurate Check Selection & Mobile Review Screenshots (`runner.mjs`)**:
   - Remove the `k.startsWith("cdn")` check from `isTargeted` so `cdnCache: true` runs full `STANDARD` auto-detection.
   - Capture `review_mobile` at `640x800` alongside `review_desktop` at `1280x900` during `--review-packet`.
3. **Verification, Spec Sync & Clean Commit**:
   - Verify unit tests (`runtime-assets.test.mjs`, `playwright-harness.test.mjs`), sync delta specs, update companion `index.html`, archive the change, and commit all `@html-report/core` changes cleanly.
