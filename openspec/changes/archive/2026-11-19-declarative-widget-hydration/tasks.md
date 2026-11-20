# Tasks: Declarative Widget Auto-Hydration (`data-chart`, `data-gridjs`, `data-leaflet`)

> **Companion Dashboard:** [index.html](index.html) | **Proposal:** [proposal.md](proposal.md) | **Design:** [design.md](design.md) | **Delta Spec:** [declarative-widget-hydration](specs/declarative-widget-hydration/spec.md)

## Phase 1: Runtime Declarative Hydrators (`@html-report/core`)

- [x] 1.1 Create `packages/core/assets/runtime/05b-widget-hydrators.js` with `initDeclarativeCharts()`, `initDeclarativeGridjs()`, and `initDeclarativeLeaflet()`.
- [x] 1.2 Wire `initDeclarativeCharts()`, `initDeclarativeGridjs()`, and `initDeclarativeLeaflet()` into `DOMContentLoaded` and `reinitReportContent()` in `06-public-feeds.js` / `08-publisher-and-board.js`.
- [x] 1.3 Export the new hydrator functions in `packages/core/assets/report-runtime.js` using `cjs-module-lexer`-compatible shorthand syntax.

## Phase 2: Style Guide & Skill Documentation Update

- [x] 2.1 Update `skills/html-report/references/charts-and-mermaid-style-guide.md` to lead with zero-JS `data-chart`, `data-gridjs`, and `data-leaflet` examples and remove the redundant 100-line palette resolver copy-paste block.
- [x] 2.2 Update `skills/html-report/SKILL.md` Step 1 bullets to highlight declarative `data-chart`, `data-gridjs`, and `data-leaflet` attributes while staying under the 5,120-byte facade budget.

## Phase 3: Verification & Live Journey Sync

- [x] 3.1 Add unit and Playwright tests verifying declarative Chart.js, Grid.js, and Leaflet auto-hydration and DaisyUI 32-theme reactivity.
- [x] 3.2 Update companion [index.html](index.html) and sync `implementation-progress.html` on `localhost:3031`.
