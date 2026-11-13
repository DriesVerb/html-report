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

This specialized skill guides the rapid synthesis of rich, responsive, theme-adaptive analytical reports using a **deterministic Assembly & Pipeline workflow**.

Agents generate **only the Semantic Fragment** (`<main id="report-main">`: KPI cards, stats, charts, diagrams, tables), saving ~70% of output tokens. The shared CLI builder (`build-report.mjs`) automatically assembles the Semantic Fragment into the pre-bundled DaisyUI Template Shell (`template-shell.html`) and client runtime (`report-runtime.js`) in <100ms.

---

## Quick Reference & Progressive Disclosure

Before writing report fragments, refer to the shared core guides:
- **[Architecture & CDN Blueprint](./references/architecture-and-styling.md)**: Shell structure, DaisyUI navbar, 32-theme switcher, and container spacing.
- **[Charts & Mermaid Style Guide](./references/charts-and-mermaid-style-guide.md)**: OKLCH theme resolution for Chart.js canvases and Mermaid diagrams.
- **[Showcase Example](./examples/example.html)**: Canonical reference implementation with charts, tables, and themes.

---

## Assembly & Verification Workflow

### Step 1: Synthesize Semantic `<main>` Fragment Only
Emit only `<main id="report-main" class="container mx-auto px-4 py-8 space-y-8">` (`x-data`, `x-init`, `data-*`, `aria-*` attributes on `<main>` are preserved):
- **Heading IDs**: Every `<h1>`, `<h2>`, and `<h3>` must have a kebab-case `id` (e.g. `<h2 id="kpi-metrics">`) for TOC mapping.
- **Responsive Headers**: Wrap card headers in `flex flex-wrap sm:flex-nowrap justify-between items-center gap-3 w-full`.
- **Chart.js Canvases**: Wrap `<canvas>` in `<div class="relative h-72 sm:h-80 w-full min-w-0">` inside `min-w-0` grid/flex items and place scripts **inside** `<main>`.
- **Datastar Actions**: Use action expressions (`data-on-load="@get('/events')"`, `data-on-click="@post('/api/board/state')"`) rather than bare URL paths.
- **Mermaid Diagrams**: Wrap in `<div class="mermaid bg-base-200/50 p-4 rounded-box overflow-x-auto text-center">...</div>`.
- Save fragment to disk (e.g. `report-fragment.html`).

### Step 2: Deterministic Assembly
Compile the fragment into a standalone HTML document (use `--no-ai-dock` when no AI assistant dock is needed):
```bash
node skills/html-report/scripts/build-report.mjs \
  --title "Quarterly Performance Report" \
  --content report-fragment.html \
  --output report.html
```

### Step 3: Dual-Path Verification & Quality Assurance
1. **Preflight & Deterministic Gate**: Run `preflight.mjs --json` to check ports/browser/AI providers, then run `verify-report.mjs` on a file or live `--url`:
```bash
node skills/html-report/playwright/verify-report.mjs report.html --quick --json verify.json
node skills/html-report/playwright/verify-report.mjs --url http://localhost:3031 --quick
```
2. **Agentic Assembly Review (Round 1 or Round 2+ Edits)**: Generate an Assembly Review Packet with screenshots and section telemetry to inspect visual layout and content:
```bash
node skills/html-report/playwright/verify-report.mjs report.html --quick --review-packet review-packet.json --screenshots ./screenshots
```
3. **Final Published Round**: Ephemeral verification classes/attributes (`verify-*`, `data-insufficient-space`, `data-verify-*`, `#html-report-verify-styles`) and authoring/AI dock chrome are automatically stripped when publishing:
```bash
node skills/html-report/scripts/build-report.mjs --content report-fragment.html --published --output published.html
```

### Step 4: Local Live-Reload & Turnkey AI Bridge Server
Launch the single-tab live-reload & Turnkey AI Bridge server on default port 3031 (fallback 3032):
```bash
node skills/html-report/scripts/serve-report.mjs report.html --port 3031 --no-open
```

---

## Sibling Skill Routing

If your immediate task requires a different primary output, delegate to the specialized sibling skill:
- **Printable Invoices & Paged PDFs**: Use `@html-print` (handles `@page`, print breaks, A4 pagination).
- **Real-Time Telemetry & SSE**: Use `@html-dashboard` (handles Datastar live hypermedia, agent monitoring).
- **3D Pitch Decks & Slides**: Use `@html-presentation` (handles Impress.js 3D transitions).
- **Offline Installable App**: Use `@html-pwa` (handles Service Worker, W3C manifest).
- **Interactive Onboarding Studio**: Use `@html-create` (decision wizard, OKLCH studio).
