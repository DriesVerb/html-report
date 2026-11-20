# declarative-widget-hydration Specification

## Purpose

Provides zero-JavaScript declarative widget auto-hydration in `report-runtime.js` for `data-chart` (Chart.js), `data-gridjs` (Grid.js), and `data-leaflet` (Leaflet with Esri ArcGIS World Street Map tiles), eliminating imperative script boilerplate in Semantic Fragments while preserving DaisyUI 32-theme palette synchronization.

## Requirements

### Requirement: Declarative Chart.js Hydration (`data-chart`)
`report-runtime.js` SHALL automatically hydrate `<canvas data-chart="...">` and `<canvas data-chart-source="#...">` elements using `Chart.js`, applying active DaisyUI theme palette colors when dataset colors are omitted, defaulting to `responsive: true` and `maintainAspectRatio: false`, and registering instances in `window.reportCharts`.

#### Scenario: Agent authors a chart using only a declarative HTML attribute
- **WHEN** a Semantic Fragment contains `<canvas data-chart='{"type":"bar","data":{"labels":["Q1","Q2"],"datasets":[{"label":"Revenue","data":[42,58]}]}}'></canvas>` with no inline `<script>`
- **THEN** `buildReport()` auto-detects the `charts` addon and `report-runtime.js` renders a responsive Chart.js bar chart synchronized with the active DaisyUI theme.

### Requirement: Declarative Grid.js Hydration (`data-gridjs`)
`report-runtime.js` SHALL automatically hydrate `[data-gridjs]` and `[data-gridjs-source]` elements using `Grid.js` with default search, sort, and pagination (`limit: 10`) when those options are omitted.

#### Scenario: Agent authors an interactive data table via `data-gridjs`
- **WHEN** a Semantic Fragment contains `<div data-gridjs='{"columns":["Name","Score"],"data":[["Alice",98],["Bob",91]]}'></div>`
- **THEN** `buildReport()` auto-detects the `gridjs` addon and `report-runtime.js` mounts a searchable, sortable, paginated Grid.js table.

### Requirement: Declarative Leaflet Map Hydration (`data-leaflet`)
`report-runtime.js` SHALL automatically hydrate `[data-leaflet]` and `[data-leaflet-source]` elements using `Leaflet` and Esri ArcGIS World Street Map tiles (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}`).

#### Scenario: Agent authors a geospatial map via `data-leaflet` that works over `file://`
- **WHEN** a Semantic Fragment contains `<div class="h-72 w-full" data-leaflet='{"center":[51.505,-0.09],"zoom":12,"markers":[{"lat":51.505,"lng":-0.09,"popup":"London HQ"}]}'></div>`
- **THEN** `buildReport()` auto-detects the `leaflet` addon and `report-runtime.js` renders the map and markers with zero `file://` tile 403 errors.
