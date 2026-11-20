# Design: Declarative Widget Auto-Hydration (`data-chart`, `data-gridjs`, `data-leaflet`)

> **Change:** `declarative-widget-hydration` | **Proposal:** [proposal.md](proposal.md) | **Tasks:** [tasks.md](tasks.md) | **Journey:** [index.html](index.html)

## Technical Decisions

### 1. New Runtime Module Chunk (`05b-widget-hydrators.js`)
- Because `packages/core/assets/runtime/05-cdn-hydrators.js` is currently 515 lines and the repository enforces a strict `<= 650`-line limit per module (`packages/core/tests/codebase-digestibility.test.mjs`), we will place the three new declarative widget hydrators in `packages/core/assets/runtime/05b-widget-hydrators.js`.
- `getBundledRuntimeSource()` in `packages/core/assets/report-runtime.js` sorts `assets/runtime/*.js` lexicographically (`01..08`), so `05b-widget-hydrators.js` will automatically concatenate immediately after `05-cdn-hydrators.js` and before `06-public-feeds.js`.
- Export `initDeclarativeCharts`, `initDeclarativeGridjs`, and `initDeclarativeLeaflet` in `packages/core/assets/report-runtime.js` using shorthand object syntax (`module.exports = { ... }`) to preserve Node `cjs-module-lexer` named ESM export compatibility.

### 2. Declarative Chart.js Hydration Contract (`initDeclarativeCharts`)
- Selector: `canvas[data-chart], canvas[data-chart-source]`
- Guard: Skips elements where `el.dataset.chartInitialized === "true"` or `Chart.getChart(el)` is already truthy.
- Config parsing: Reads JSON directly from `data-chart` or from the `<script type="application/json" id="...">` referenced by `data-chart-source`.
- Theme palette defaults: Resolves `const palette = resolveDaisyUIThemePalette()` and assigns `primary`, `secondary`, `accent`, `info`, `success`, `warning`, `error` colors to datasets that omit `borderColor`/`backgroundColor`.
- Registers every created instance in `window.reportCharts` so `setReportTheme()` in `02-theme-switcher.js` re-colors charts on theme change without custom scripts.

### 3. Declarative Grid.js Hydration Contract (`initDeclarativeGridjs`)
- Selector: `[data-gridjs], [data-gridjs-source]`
- Guard: Skips elements where `el.dataset.gridjsInitialized === "true"` or `el.querySelector(".gridjs-container")` exists.
- Merges `{ search: true, sort: true, pagination: { limit: 10 }, ...parsedConfig }` and invokes `new window.gridjs.Grid(config).render(el)`.

### 4. Declarative Leaflet Hydration Contract (`initDeclarativeLeaflet`)
- Selector: `[data-leaflet], [data-leaflet-source]`
- Guard: Skips elements where `el.dataset.leafletInitialized === "true"` or `el._leaflet_id` exists.
- Uses `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}` by default and creates `L.marker([lat, lng]).addTo(map).bindPopup(label)` for each item in `markers`.
