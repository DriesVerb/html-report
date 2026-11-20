# Charts (Chart.js), Tables (Grid.js), Maps (Leaflet) & Diagrams (Mermaid) Style Guide

Whenever an HTML report includes **Chart.js** charts, **Grid.js** tables, **Leaflet** geospatial maps, or **Mermaid** diagrams, the agent MUST follow this style guide. Visuals must be responsive across all Tailwind breakpoints (`sm` through `2xl`), dynamically synchronize with all **32 DaisyUI themes**, and render cleanly in print/PDF export.

---

## 1. Zero-JS Declarative Widget Auto-Hydration (Preferred Pattern)

`report-runtime.js` automatically bundles `cssColorToHexAndRgba()`, `resolveDaisyUIThemePalette()`, `renderMermaidWithTheme()`, and declarative auto-hydrators (`initDeclarativeCharts()`, `initDeclarativeGridjs()`, `initDeclarativeLeaflet()`).

> [!IMPORTANT]
> **Do NOT copy-paste `cssColorToHexAndRgba`, `resolveDaisyUIThemePalette`, or `applyThemeToCharts` into your fragment `<script>`.** They are already pre-bundled in `report-runtime.js` (`02-theme-switcher.js` and `05b-widget-hydrators.js`). Prefer declarative `data-chart`, `data-gridjs`, and `data-leaflet` attributes so zero custom `<script>` tags are required.

### 1.1 Declarative Chart.js (`data-chart` / `data-chart-source`)
`initDeclarativeCharts()` automatically hydrates `<canvas data-chart='{...}'>` (or `<canvas data-chart-source="#json-script-id">`), applies active DaisyUI theme palette colors (`primary`, `secondary`, `accent`, `info`, `success`, `warning`, `error`) when dataset colors are omitted, enforces `responsive: true, maintainAspectRatio: false`, and registers instances in `window.reportCharts` for instant 32-theme switching:

```html
<div class="card bg-base-100 shadow-sm border border-base-300 break-inside-avoid">
  <div class="card-body p-4 sm:p-6">
    <h3 id="chart-revenue-heading" class="card-title text-base sm:text-lg scroll-mt-20">
      Quarterly Revenue &amp; Margin Trend
    </h3>
    <p class="text-xs sm:text-sm opacity-75">Figures in USD ($M) — Synchronized with active DaisyUI theme</p>
    <div class="relative w-full h-72 sm:h-80 min-w-0 mt-2">
      <canvas
        id="revenueChart"
        aria-label="Quarterly Revenue Chart"
        role="img"
        data-chart='{"type":"bar","data":{"labels":["Q1","Q2","Q3","Q4"],"datasets":[{"label":"Revenue ($M)","data":[42,58,65,81]},{"label":"Net Margin ($M)","data":[12,18,22,29]}]}}'
      ></canvas>
    </div>
  </div>
</div>
```

For larger datasets, store the JSON in `<script type="application/json" id="revenue-chart-data">` inside `<main>` and reference it with `<canvas data-chart-source="#revenue-chart-data"></canvas>`.

### 1.2 Declarative Grid.js (`data-gridjs` / `data-gridjs-source`)
`initDeclarativeGridjs()` automatically hydrates `[data-gridjs]` (or `[data-gridjs-source="#..."]`) and defaults to `{ search: true, sort: true, pagination: { limit: 10 } }`:

```html
<div
  id="regional-scorecard-table"
  data-gridjs='{"columns":["Region","Owner","ARR ($M)","YoY Growth"],"data":[["North America","A. Chen","$48.2M","+24%"],["EMEA","M. Weber","$31.5M","+19%"],["APAC","S. Tanaka","$22.8M","+31%"]]}'
></div>
```

### 1.3 Declarative Leaflet Maps (`data-leaflet` / `data-leaflet-source`)
`initDeclarativeLeaflet()` automatically hydrates `[data-leaflet]` (or `[data-leaflet-source="#..."]`) and binds Esri ArcGIS World Street Map tiles (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}`), preventing `file://` tile 403 errors from OpenStreetMap or CartoDB:

```html
<div
  id="global-footprint-map"
  class="h-72 sm:h-80 w-full rounded-box border border-base-300"
  data-leaflet='{"center":[51.505,-0.09],"zoom":12,"markers":[{"lat":51.505,"lng":-0.09,"popup":"London HQ"},{"lat":51.515,"lng":-0.08,"popup":"City Data Center"}]}'
></div>
```

---

## 2. Chart.js Layout & Custom Script Rules (When Custom JS Is Needed)

### 2.1 Container & Sizing Rules (Preventing Overflow & Resize Loops)
1. **Never place a `<canvas>` directly inside a flex/grid item without a relative fixed-height wrapper.**
2. Always wrap `<canvas>` in `<div class="relative w-full h-72 sm:h-80 min-w-0">`.
3. Add `break-inside-avoid` to the parent card so PDF/print export never splits a chart across pages.
4. **Offline Visual Context:** Accompany canvas charts with a KPI summary row, scorecard, or table so air-gapped viewers still see key figures.

### 2.2 Custom Imperative Chart.js Fallback Rules
If a chart requires custom JavaScript callbacks (e.g. custom tooltip formatters):
1. **Mandatory Script Enclosure:** Always place `<script>` tags **inside** `<main>...</main>`. `build-report.mjs` extracts `<main[^>]*>([\s\S]*?)<\/main>` and strips any script placed after `</main>`.
2. **Use Pre-Bundled Runtime Helpers:** Call `window.resolveDaisyUIThemePalette()` directly and push the created chart to `window.reportCharts = window.reportCharts || []` so `setReportTheme()` updates it automatically on theme change.
3. **Deferred CDN Auto-Polling:** Because Chart.js loads with `defer`, poll for `typeof Chart !== "undefined"` before instantiating.

---

## 3. Mermaid Diagram Standards

### 3.1 Container & Readability Rules
1. Wrap every `.mermaid` block inside a responsive, scrollable card container (`overflow-x-auto flex justify-center p-4 bg-base-200/50 rounded-box break-inside-avoid`) so wide diagrams never cause horizontal page overflow at `640px` (`sm`).
2. Keep node labels concise (max 4–6 words per node) and quote labels containing parentheses or special characters (`A["Ingestion Service (v2)"]`).
3. Prefer `flowchart LR` or `flowchart TD` with at most 12 nodes per diagram for clarity.
4. `report-runtime.js` automatically themes and re-renders `.mermaid` blocks on every DaisyUI theme switch via `renderMermaidWithTheme(resolveDaisyUIThemePalette())`.

### 3.2 Mermaid 11.4 Syntax Defense & Strict Parsing Rules
Mermaid 11.4 enforces strict token parsing that will throw `Syntax error in text` or fail silently if common text tokens are unescaped:

1. **Never use angle brackets (`<...>` or `&lt;...&gt;`) in node labels or messages**:
   - Mermaid parses `<...>` as custom unclosed HTML tags, throwing `Parse error ... got 'TAGSTART'`.
   - **Correct**: Use curly braces `{caller_id}`, square brackets `[run_id]`, or parentheses `(id)`.
   - **Wrong**: `P["profiles/<caller>.md"]` or `Reg->>Vault: Check profiles/<caller_id>.md`.
2. **Never use unquoted comparison operators (`>`, `<`) in sequence diagram messages**:
   - In sequence diagrams, `>` is parsed as an arrow operator syntax token (`->>`), triggering a syntax error.
   - **Correct**: Write descriptive English (`"Auto-prune runs exceeding 10"`) or explicitly quote the string (`"runs > 10"`).
   - **Wrong**: `Reg->>Vault: Auto-prune runs > 10`.
3. **Quote participant labels containing leading dots, slashes, or symbols**:
   - Participant paths with leading dots or path separators (e.g. `.caller-requests/`) cause parser errors unless quoted or aliased.
   - **Correct**: `participant Vault as ".caller-requests/"` or `participant Vault as Caller Vault`.
   - **Wrong**: `participant Vault as .caller-requests/`.
4. **Never start subgraph titles or node labels with ordered list patterns (`1. `, `2. `)**:
   - Mermaid 11 parses leading numbers with periods (e.g. `subgraph Input["1. User Request"]`) as markdown ordered list items, triggering `Unsupported markdown: list` syntax errors.
   - **Correct**: Use hyphens or descriptive words: `subgraph Input["Step 1 - User Request"]` or `subgraph Input["[1] User Request"]`.
   - **Wrong**: `subgraph Input["1. User Request"]`.
5. **Badge & Card Header Responsive Boundary Defense**:
   - Flex header rows containing badges and titles must use `flex flex-wrap items-center justify-between gap-2` with `shrink-0` on badges and `min-w-0 flex-1 break-words` on title containers.

---

## 4. Print & PDF Export Checklist for Visuals

- Listen for `window.addEventListener("beforeprint", () => window.reportCharts?.forEach(c => c.resize()))` so Chart.js canvases fit A4/Letter print margins cleanly.
- Ensure `.mermaid svg` has `max-width: 100%; height: auto;` so vector diagrams scale cleanly inside PDF pages.
