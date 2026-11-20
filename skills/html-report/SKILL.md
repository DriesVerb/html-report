---
name: html-report
description: >-
  Generates publication-grade, interactive, theme-adaptive HTML5 analytical reports,
  business intelligence summaries, and data dashboards with a non-blocking CDN stack
  (Tailwind CSS, DaisyUI with all 32 themes defaulting to 'light', Lucide Icons, Alpine.js,
  and on-demand addons like Chart.js, Mermaid, and Grid.js). Use when the user asks for
  analytical reports, metrics, performance audits, business summaries, or data visualizations.
---

# HTML Analytical Report Generation Skill (`html-report`)

> **Domain:** `Delivery Archetype` | **Beneficiary:** `Hybrid` | **Serving:** `Static File` | **Behavior:** `Interactive / Reactive`

Synthesizes responsive, theme-adaptive reports via a **deterministic Assembly Pipeline**: agents emit **only the Semantic Fragment** (`<main id="report-main">`), while `build-report.mjs` compiles it with `template-shell.html` and `report-runtime.js` in <100ms—injecting the **Core 4** shell plus **only the addon libraries detected in `<main>`** (or `--only-addons`).

---

## Quick Reference

- **[Architecture & CDN Blueprint](./references/architecture-and-styling.md)**: Core 4 + on-demand addons, navbar, 32 themes, print cover, Leaflet/CSP.
- **[Charts & Mermaid Style Guide](./references/charts-and-mermaid-style-guide.md)**: Declarative widgets & OKLCH theme resolution for Chart.js & Mermaid.
- **[Reveal.js Presentation Style Guide](./references/reveal-presentation-style-guide.md)**: `#presentation-shell`, `.slide-body`, Fullscreen (`F`), Notes (`N`).
- **[Showcase Example](./examples/example.html)**: Canonical charts, tables, and themes reference.

---

## Assembly & Verification Workflow

### Step 1: Bootstrap Project or Synthesize Semantic `<main>` Fragment
```bash
# Bootstrap from workspace CSV/JSON (--ref inside workspaceRoot) + declarative widgets:
node skills/html-report/scripts/scaffold-project.mjs --project q4-audit --title "Q4 Audit" --ref projects/_uploads/data.csv --widgets kpi-row,chart-pair,grid-table --json
```
Emit `<main id="report-main" class="container mx-auto px-4 py-8 space-y-8">` in `projects/<slug>/fragment.html` (`x-data`, `data-*`, `aria-*` preserved; never write to root `report.html` or `index.html`):
- **Heading IDs**: Every `<h1>`/`<h2>`/`<h3>` needs a kebab-case `id` (e.g. `id="kpi-metrics"`) for TOC mapping.
- **Responsive Headers**: Wrap card headers in `flex flex-wrap sm:flex-nowrap justify-between items-center gap-3 w-full`.
- **Mermaid Diagrams**: `<div class="mermaid bg-base-200/50 p-4 rounded-box overflow-x-auto text-center">` or `data-mermaid-src="./diagram.mmd"` (`<!-- {{MERMAID:./diagram.mmd}} -->`).
- **Declarative Widgets (`data-chart`, `data-gridjs`, `data-leaflet`)**: Prefer zero-JS auto-hydration over inline `<script>` tags:
  - **Chart.js**: `<div class="relative h-72 sm:h-80 w-full min-w-0"><canvas data-chart='{"type":"bar","data":{...}}'></canvas></div>` (or `data-chart-source="#id"`; auto-syncs 32 themes via `window.reportCharts`).
  - **Grid.js**: `<div data-gridjs='{"columns":[...],"data":[...]}'></div>` (search, sort, 10-row pagination).
  - **Leaflet**: `<div class="h-72 w-full" data-leaflet='{"center":[51.5,-0.09],"zoom":12,"markers":[{"lat":51.5,"lng":-0.09,"popup":"HQ"}]}'></div>` (`file://`-safe Esri ArcGIS tiles).
- **Datastar Actions**: Use `@get('/events')` / `@post('/api/board/state')` expressions instead of bare paths.

### Step 2: Deterministic Assembly (`harness.mjs` Fast Inner Loop)
```bash
# One-shot <150ms inner loop: Lint + Auto-Fix + Assemble projects/<slug>/fragment.html -> index.html
node skills/html-report/scripts/harness.mjs run --project q4-audit --title "Q4 Audit" --fast
node skills/html-report/scripts/harness.mjs run --project q4-audit --published --fast
```

### Step 3: Verification & Live-Reload Server
```bash
# Omit --check-* to run ALL core + auto-detected addon checks (use --check-<name> to isolate one):
node skills/html-report/playwright/verify-report.mjs projects/q4-audit/index.html --quick --json projects/q4-audit/verify.json
node skills/html-report/playwright/verify-report.mjs projects/q4-audit/index.html --quick --review-packet projects/q4-audit/review.json --screenshots projects/q4-audit/screenshots
node skills/html-report/playwright/verify-report.mjs projects/q4-audit/index.html --check-mermaid --with-core --quick
# Serve on port 3031 (fallback 3032); wait for load + window.__REPORT_READY__ (never networkidle):
node skills/html-report/scripts/serve-report.mjs projects/q4-audit/index.html --port 3031 --no-open
```

---

## Sibling Skill Routing
- **Printable Invoices & Paged PDFs**: `@html-print` (`@page`, print breaks, A4 pagination)
- **Real-Time Telemetry & SSE**: `@html-dashboard` (Datastar hypermedia, agent monitoring)
- **Interactive Slide Decks**: `@html-presentation` (Reveal.js with Fullscreen & Notes; `--impress` for legacy 3D)
- **Offline Installable App**: `@html-pwa` (Service Worker, W3C manifest)
- **Onboarding Studio**: `@html-studio` (decision wizard, OKLCH studio)
