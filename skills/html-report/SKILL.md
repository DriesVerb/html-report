---
name: html-report
description: >-
  Generates publication-grade, interactive, theme-adaptive HTML5 analytical reports,
  business intelligence summaries, and data dashboards with a non-blocking CDN stack
  (Tailwind CSS, DaisyUI with all 32 themes defaulting to 'light', Lucide Icons, Alpine.js,
  Chart.js, Mermaid diagrams, and Grid.js tables). Use when the user asks for analytical
  reports, metrics, performance audits, business summaries, or data visualizations.
---

# HTML Analytical Report Generation Skill (`html-report`)

> **Domain:** `Delivery Archetype` | **Beneficiary:** `Hybrid` | **Serving:** `Static File` | **Behavior:** `Interactive / Reactive`

This skill synthesizes responsive, theme-adaptive reports via a **deterministic Assembly Pipeline**: agents emit **only the Semantic Fragment** (`<main id="report-main">`), saving ~70% of tokens, while `build-report.mjs` compiles it with `template-shell.html` and `report-runtime.js` in <100ms.

---

## Quick Reference

Refer to these shared guides before writing fragments:
- **[Architecture & CDN Blueprint](./references/architecture-and-styling.md)**: Shell, navbar, 32 themes, container spacing, Leaflet/CSP.
- **[Charts & Mermaid Style Guide](./references/charts-and-mermaid-style-guide.md)**: OKLCH theme resolution for Chart.js & Mermaid.
- **[Reveal.js Presentation Style Guide](./references/reveal-presentation-style-guide.md)**: `#presentation-shell`, `.slide-body`, Fullscreen (`F`), Notes (`N`).
- **[Showcase Example](./examples/example.html)**: Canonical charts, tables, and themes reference.

---

## Assembly & Verification Workflow

### Step 1: Synthesize Semantic `<main>` Fragment Only
Emit `<main id="report-main" class="container mx-auto px-4 py-8 space-y-8">` (`x-data`, `data-*`, `aria-*` preserved):
- **Heading IDs**: Every `<h1>`/`<h2>`/`<h3>` needs a kebab-case `id` (e.g. `id="kpi-metrics"`) for TOC mapping.
- **Responsive Headers**: Wrap card headers in `flex flex-wrap sm:flex-nowrap justify-between items-center gap-3 w-full`.
- **Chart.js Canvases**: Wrap `<canvas>` in `<div class="relative h-72 sm:h-80 w-full min-w-0">`; place scripts inside `<main>`.
- **Datastar Actions**: Use expressions (`data-on-load="@get('/events')"`, `data-on-click="@post('/api/board/state')"`) instead of bare paths.
- **Mermaid Diagrams**: Wrap in `<div class="mermaid bg-base-200/50 p-4 rounded-box overflow-x-auto text-center">...</div>`.

### Step 2: Deterministic Assembly
```bash
node skills/html-report/scripts/build-report.mjs --title "Quarterly Report" --content report-fragment.html --output report.html
```

### Step 3: Verification & Publishing
```bash
# Deterministic gate & live URL check
node skills/html-report/playwright/verify-report.mjs report.html --quick --json verify.json
node skills/html-report/playwright/verify-report.mjs --url http://localhost:3031 --quick

# Visual review packet (Round 1 / Round 2+ edits)
node skills/html-report/playwright/verify-report.mjs report.html --quick --review-packet review-packet.json --screenshots ./screenshots

# Clean published export (strips verify-* and authoring chrome)
node skills/html-report/scripts/build-report.mjs --content report-fragment.html --published --output published.html
```

### Step 4: Live-Reload & AI Bridge Server
Serve on default port 3031 (fallback 3032):
```bash
node skills/html-report/scripts/serve-report.mjs report.html --port 3031 --no-open
```

---

## Sibling Skill Routing
- **Printable Invoices & Paged PDFs**: `@html-print` (`@page`, print breaks, A4 pagination)
- **Real-Time Telemetry & SSE**: `@html-dashboard` (Datastar hypermedia, agent monitoring)
- **Interactive Slide Decks**: `@html-presentation` (Reveal.js with Fullscreen & Notes; `--impress` for legacy 3D)
- **Offline Installable App**: `@html-pwa` (Service Worker, W3C manifest)
- **Onboarding Studio**: `@html-create` (decision wizard, OKLCH studio)
