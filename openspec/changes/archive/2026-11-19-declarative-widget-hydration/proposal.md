# Proposal: Declarative Widget Auto-Hydration (`data-chart`, `data-gridjs`, `data-leaflet`)

> **Change:** `declarative-widget-hydration` | **Journey Companion:** [index.html](index.html) | **Design:** [design.md](design.md) | **Tasks:** [tasks.md](tasks.md) | **Delta Spec:** [declarative-widget-hydration](specs/declarative-widget-hydration/spec.md)

## Why

While `report-runtime.js` already provides zero-JS declarative hydration for Mermaid (`.mermaid`), FullCalendar (`[data-fullcalendar]`), Showdown (`[data-showdown]`), and Day.js (`[data-dayjs]`), agents authoring reports with **Chart.js**, **Grid.js**, or **Leaflet** still have to emit large imperative `<script>` blocks inside `<main id="report-main">`.

Furthermore, `skills/html-report/references/charts-and-mermaid-style-guide.md` still instructs agents to copy-paste 100+ lines of `cssColorToHexAndRgba`, `resolveDaisyUIThemePalette`, and `applyThemeToCharts` helper functions that are **already pre-bundled** inside `packages/core/assets/runtime/02-theme-switcher.js`. This doubles fragment token generation latency and creates opportunities for syntax or resize bugs.

## What Changes

1. **Declarative Chart.js Hydrator (`initDeclarativeCharts`)**:
   - Auto-hydrates `<canvas data-chart='{...}'>` (or `data-chart-source="#json-script-id"`).
   - Automatically applies active DaisyUI theme palette colors (`resolveDaisyUIThemePalette()`) to dataset borders/fills, axis ticks, and grid lines when explicit colors are omitted.
   - Enforces `responsive: true, maintainAspectRatio: false` by default and pushes instances to `window.reportCharts` for instant 32-theme switching.
2. **Declarative Grid.js Hydrator (`initDeclarativeGridjs`)**:
   - Auto-hydrates `<div data-gridjs='{...}'>` (or `data-gridjs-source="#json-script-id"`).
   - Defaults to `{ search: true, sort: true, pagination: { limit: 10 } }` so agents only pass `columns` and `data`.
3. **Declarative Leaflet Hydrator (`initDeclarativeLeaflet`)**:
   - Auto-hydrates `<div data-leaflet='{...}'>` with `{ center, zoom, markers }`.
   - Automatically binds Esri ArcGIS World Street Map tiles (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}`) so agents never accidentally trigger `file://` 403 errors with OpenStreetMap or CartoDB.
4. **Streamlined Style Guide (`charts-and-mermaid-style-guide.md`)**:
   - Removes the redundant 100-line palette resolver copy-paste block and promotes declarative `data-chart`, `data-gridjs`, and `data-leaflet` attributes as the primary agent authoring pattern.
