---
name: html-report
description: >-
  Generates publication-grade, interactive, and print-ready HTML5 reports with a
  non-blocking 17-library CDN stack (Tailwind CSS, DaisyUI with all 32 themes
  defaulting to 'light', Lucide Icons, Alpine.js, Chart.js, Mermaid, Leaflet
  maps, Grid.js tables, KaTeX math, Marked markdown, Highlight.js code
  formatting, Day.js dates, Impress.js presentations, Mock.js data, Showdown
  markdown, FullCalendar schedules, and Datastar.js live hypermedia streaming), a sticky DaisyUI navbar (left-aligned
  report title, right-aligned Table of Contents dropdown mapping h1/h2/h3 IDs,
  DaisyUI color-swatch theme dropdown synced to charts/diagrams, and icon-only
  Download dropdown for HTML or PDF), @media print rules with a Page 1 Cover +
  H1/H2/H3 TOC, horizontal-scrollbar insufficient-space detection, and Playwright
  multi-breakpoint & 5-theme PDF verification. Use when the user asks to create,
  design, or export an HTML report, dashboard report, or PDF-backed HTML summary.
---

# HTML Report Generation Skill (`html-report`)

This skill guides the creation of rich, responsive, theme-adaptive, and print/PDF-verified HTML5 reports using a **fast deterministic pipeline**.

Agents generate **only the semantic `<main>` content fragment** (stats, cards, charts, diagrams, tables), saving ~70% of output tokens. The deterministic builder CLI (`build-report.mjs`) stitches the fragment into the pre-bundled DaisyUI shell (`template-shell.html`) with client runtime (`report-runtime.js`) in <100ms, auto-detecting required CDNs. Lean Playwright verification (`--quick`) validates mobile and desktop responsiveness in <4 seconds.

---

## Progressive Disclosure Reference Files

Before writing any HTML report, read the relevant reference guides in this skill directory:

1. **[Architecture, 16-CDN Stack & DaisyUI Navbar Blueprint](./references/architecture-and-styling.md)** *(Required for all reports)*:
   - Modular CDN loading: Core 4 baseline (`Tailwind CSS`, `DaisyUI v4 full + all 32 themes`, `Lucide Icons`, `Alpine.js`) with on-demand addons (`Chart.js`, `Mermaid`, `Leaflet`, `Grid.js`, `KaTeX`, `Marked`, `Highlight.js`, `Day.js`, `Impress.js`, `Mock.js`, `Showdown`, `FullCalendar`) auto-detected by `build-report.mjs`.
   - **Impress.js Presentation Guard**: Impress.js receives the same treatment as printable output by default. Interactive 3D presentation transitions ONLY activate when explicitly requested (via `--presentation`, `--addons impress`, or `data-presentation="true"`). In all other modes, `.step` elements render as clean static printable stacked cards.
   - Pre-bundled **`assets/template-shell.html`** and **`assets/report-runtime.js`**.
   - Sticky **DaisyUI Navbar** structure (`print:hidden`, default theme always `data-theme="light"`):
     - **Left (`navbar-start`)**: Report Title (`#navbar-report-title`).
     - **Right (`navbar-end`)**: `Contents` dropdown mapping `h1`/`h2`/`h3` `#id` links, **DaisyUI 32-Theme Dropdown** where each theme option displays its color scheme swatches (`bg-primary`, `bg-secondary`, `bg-accent`, `bg-neutral`), and an **icon-only Download dropdown** (`#download-dropdown`).
   - Canvas 2D OKLCH color resolution and Mermaid numbered list syntax defense.
   - Horizontal-scrollbar insufficient-space detector (`checkInsufficientHorizontalSpace()`).
2. **[Charts (Chart.js) & Diagrams (Mermaid) Dedicated Style Guide](./references/charts-and-mermaid-style-guide.md)** *(Required whenever a report contains charts or Mermaid diagrams)*:
   - Universal DaisyUI theme color resolver (`resolveDaisyUIThemePalette()`) using an offscreen 1x1 `<canvas>` 2D context to convert `oklch(...)` colors into `#rrggbb` hex and `rgba(...)`.
   - Dynamic re-theming for **Chart.js** canvases, **Mermaid** SVG diagrams, and **FullCalendar** grids when switching across any of the 32 DaisyUI themes.
   - Fixed-height responsive containers (`h-72 sm:h-80`) and print/PDF resize hooks.
   - Defense against ordered list tokens (`1. `, `2. `) in Mermaid subgraphs.
3. **[Full-Featured Showcase Example (`example.html`)](./examples/example.html)**:
   - Complete working reference implementation explicitly demonstrating all 16 CDNs, top collapsible theme generator studio, and CSV-driven interactive workflows.
4. **[Custom DaisyUI Theme Engine & Compiler (`theme-compiler.mjs`)](./scripts/theme-compiler.mjs)**:
   - Zero-dependency pure JS matrix conversion (`sRGB` &rarr; `Linear` &rarr; `XYZ` &rarr; `OKLab` &rarr; `OKLCH`).
   - Base theme inheritance (`extends: "dark"` or any of 32 native DaisyUI themes) and automatic high-contrast content generator (`--pc`, `--sc`, etc.).
   - Support for both JSON configuration objects and raw CSS rules (`[data-theme="..."]`).
   - CLI integration via `build-report.mjs --custom-theme <path>` and in-browser top collapsible studio (`example.html`).
5. **[Caller-Aware Integration Registry (`caller-registry.mjs`)](./scripts/caller-registry.mjs)** *(Required when invoked by agent skills or CLI tools)*:
   - Dedicated gitignored vault at `.caller-requests/` holding persistent caller profiles (`profiles/<caller-id>.md`) and ephemeral run payloads (`runs/<caller-id>/<run-id>/`).
   - Zero-config auto-scaffolding, 10-run pruning, and non-destructive override hierarchy.
   - Default output routing: `./report-<caller-id>.html` and `./report-<caller-id>.pdf`.
6. **[Deterministic FSM Harness & Remediation Architecture (`harness-architecture.md`)](./references/harness-architecture.md)** *(Architecture & small-model remediation)*:
   - Zero-dependency Node.js Finite State Machine lifecycle: `IDLE` &rarr; `VALIDATING` &rarr; `AUTO_FIXING` &rarr; `ASSEMBLING` &rarr; `VERIFYING` &rarr; `COMPLETED` / `REMEDIATING` / `FAILED`.
   - Mechanical auto-fixes (stripping outer wrappers, generating heading IDs, wrapping bare tables).
   - "Small Model First" prescriptive JSON error payloads with `instruction_for_agent` fields and bounded 3-attempt retries.
7. **[Datastar.js Live Dashboards & Real-Time Hypermedia Architecture (`datastar-live-dashboards.md`)](./references/datastar-live-dashboards.md)** *(Real-time agent telemetry & live dashboards)*:
   - Real-time SSE hypermedia streaming using `@starfederation/datastar@1.0.0-beta.9` ESM with zero npm dependencies.
   - `TaskTelemetrySchema`, `SessionState`, `DatastarBridge`, and vendor-neutral LLM adapters for Google Antigravity (AGY) and OpenAI Codex.
   - Active dev server SSE endpoint `/__datastar_stream__` with live fragment morphing and reactive `$theme` signal sync.

---

## Caller-Aware Skill Integration Workflow

External agent skills (e.g. `memory-leak-debugging`, `debug-optimize-lcp`, `troubleshooting`), subagents, and automated CLI tools can invoke `html-report` as a shared visual rendering bus without repetitive styling instructions or workspace clutter:

```
html-report/ (Workspace Root)
├── .caller-requests/                     <-- Gitignored vault
│   ├── profiles/                         <-- Persistent caller rulebooks
│   │   ├── memory-leak-debugging.md
│   │   ├── debug-optimize-lcp.md
│   │   └── default.md
│   └── runs/                             <-- Ephemeral per-run payloads (pruned: max 10)
│       └── memory-leak-debugging/
│           ├── 2026-11-02T18-00-00Z/
│           │   ├── payload.json
│           │   └── overrides.json
│           └── ... (max 10 runs)
```

### Caller Registry CLI Usage

```bash
# Resolve or auto-scaffold a caller profile
node skills/html-report/scripts/caller-registry.mjs resolve <caller-id>

# Extract the direct leaf caller ID from a nested agent chain
node skills/html-report/scripts/caller-registry.mjs leaf teamwork/subagent/memory-leak-debugging
# Output: memory-leak-debugging
```

---

## Step-by-Step Workflow

### Step 1: Emit the Semantic `<main>` Content Fragment Only
- **DO NOT synthesize HTML wrappers, `<head>` tags, CDN `<script>` tags, navbar markup, or footer boilerplate.**
- Emit *only* the semantic `<main>` content fragment (Hero banner, stats, visual containers, charts, tables, cards):
  - Assign every `<h1>`, `<h2>`, and `<h3>` element a unique, descriptive `id` attribute (e.g., `<h2 id="executive-summary" class="scroll-mt-20 ...">`) so the navbar TOC dropdown maps them automatically. (If omitted, `--auto-fix` will automatically synthesize and inject unique IDs).
  - Wrap card/hero headers in `flex flex-wrap sm:flex-nowrap justify-between items-start sm:items-center gap-3 w-full` with `min-w-0 flex-1 break-words` on the text column and `shrink-0` with `whitespace-nowrap` on badges/buttons.
  - **Script Placement Guard**: If your fragment contains custom `<script>` tags (e.g. Chart.js initialization), keep them strictly **inside** `<main>...</main>` (never after `</main>`). Because CDNs load with `defer`, write auto-polling initializers (`setTimeout(..., 50)`) and always provide an offline zero-JS visual scorecard alongside canvases so charts never render as empty white boxes.
  - Save the semantic fragment to a temporary file (e.g. `report-fragment.html`).

> [!IMPORTANT]
> **Impress.js Presentation Guard & Proactive Presentation Offering**:
> - Impress.js receives the exact same treatment as printable output by default: all `.step` slide elements remain static, stacked printable cards unless interactive presentation mode is explicitly enabled.
> - **Agent Workflow Rule**: When a user explicitly mentions wanting a **slide deck**, **pitch presentation**, or **interactive 3D journey**, proactively offer the Impress.js CDN (`--addons impress` or `--presentation`). In standard analytical and printable reports, keep Impress in static print-safe fallback mode to prevent capturing document scroll.

### Step 2: Unified Execution via State Machine Harness (`harness.mjs run`)

The harness operates under the **Progressive Complexity Principle**, providing two distinct execution pathways:

#### Mode A: Standalone Self-Invocation (Zero Overhead & Zero Vault Clutter)
When invoked without `--caller`, the harness operates with zero standalone overhead:
- **Zero Vault Touches**: `.caller-requests/` is never read, created, or touched.
- **Zero Profile Overhead**: Bypasses caller profile resolution, schema checking, and run archiving.
- **Direct Deliverable**: Compiles directly to `./report.html` (or custom `--output`).

```bash
# Standalone execution (validates, auto-fixes, compiles, and verifies):
node skills/html-report/scripts/harness.mjs run report-fragment.html --title "Report Title"
```

#### Mode B: Caller-Aware Integration Mode (`--caller <id>`)
When invoked by external agent skills, subagents, or automated pipelines with `--caller <id>`:
- **Profile Resolution & Scaffolding**: Auto-scaffolds or loads `.caller-requests/profiles/<caller-id>.md`.
- **3-Tier Configuration Merge**: Merges `Runtime Overrides` (`--theme`, `--pdf`, `--mode`) > `Caller Profile Rules` > `Core Quality Baseline`.
- **Contextual CWD Routing**: Defaults output deliverables to `./report-<caller-id>.html` (and `./report-<caller-id>.pdf` if `--pdf` is requested).
- **Vault Trace Persistence & Pruning**: Writes `run.json` (state history, duration, attempt) and `trace.json` (prescriptive directives, lint issues, auto-fixes) into `.caller-requests/runs/<caller-id>/<run-id>/`, enforcing strict 10-run retention.
- **Multi-Attempt Correlation**: Retries with `--attempt 2 --run-id <run-id>` update the existing run directory across remediation retries.

```bash
# Standard caller-aware invocation:
node skills/html-report/scripts/harness.mjs run report-fragment.html --caller memory-leak-debugging

# Caller-aware with custom theme override, PDF deliverable, and machine JSON envelope:
node skills/html-report/scripts/harness.mjs run report-fragment.html \
  --caller debug-optimize-lcp \
  --theme synthwave \
  --pdf \
  --json

# Multi-attempt remediation retry correlated to previous run:
node skills/html-report/scripts/harness.mjs run report-fragment.html \
  --caller memory-leak-debugging \
  --attempt 2 \
  --run-id <run-id>
```

#### Deterministic FSM Lifecycle Summary
1. **RESOLVING_CALLER** *(Caller mode only)*: Auto-scaffold/resolve profile, validate schema compatibility, and merge 3-tier configuration hierarchy.
2. **VALIDATING**: Semantic pre-flight checks (boilerplate, heading IDs, responsive tables).
3. **AUTO_FIXING**: Mechanical deterministic transforms with zero LLM round-trips.
4. **ASSEMBLING (`build-report.mjs`)**: Stitches fragment into DaisyUI template shell, injecting profile/override theme and required CDNs in <100ms.
5. **VERIFYING (`verify-report.mjs`)**: Playwright multi-breakpoint and console verification with optional PDF export.
6. **RECORDING_RUN** *(Caller mode only)*: Persists `run.json`, `trace.json`, and `overrides.json` in caller vault and prunes to 10-run limit.
7. **COMPLETED / REMEDIATING / FAILED**: Prints success message or high-contrast remediation banner with spoon-fed prescriptive instructions for small models.

#### Distinguishable Rendering Modes & Dev Server Orchestration

The harness and builder enforce six canonical rendering modes with deterministic dev server orchestration policies:

| Mode | Stamped Tag | Dev Server Policy | Datastar Ingestion | Navbar Affordance |
| :--- | :--- | :--- | :--- | :--- |
| **`print`** | `data-report-mode="print"` | **NO Server** (`requiresServer: false`) | On-demand | `PRINT` badge + `PDF-Ready` highlight |
| **`report`** | `data-report-mode="report"` | **NO Server** (`requiresServer: false`) | On-demand | `REPORT` ghost badge |
| **`presentation`** | `data-report-mode="presentation"` | **NO Server** (`requiresServer: false`) | On-demand | `PRESENTATION` secondary badge |
| **`dashboard`** | `data-report-mode="dashboard"` | **Runs Server** (`localhost:3000`) | On-demand | `DASHBOARD` info badge |
| **`working-report`** | `data-report-mode="working-report"` | **Runs Server** (`localhost:3000`) | On-demand | `JOURNEY` accent badge + Showdown viewer |
| **`live-report`** | `data-report-mode="live-report"` | **Runs Server** (`localhost:3000`) | **Mandatory** | `LIVE` success badge with green pulse |

```bash
# Execute standalone print deliverable (zero server overhead):
node skills/html-report/scripts/harness.mjs run fragment.html --mode print

# Execute interactive dashboard with live dev server:
node skills/html-report/scripts/harness.mjs run fragment.html --mode dashboard

# Execute live real-time report with Datastar hypermedia streaming:
node skills/html-report/scripts/harness.mjs run fragment.html --mode live-report
```

*(Low-Level Modular Alternative)*:
If you need to execute compilation and verification separately:
```bash
# Assembly only:
node skills/html-report/scripts/build-report.mjs --title "Report Title" --content report-fragment.html --output report.html --theme light

# Assembly with real-time Datastar live hypermedia streaming:
node skills/html-report/scripts/build-report.mjs --title "Live Agent Dashboard" --content report-fragment.html --live --output report.html

# Dev server with live SSE stream & auto-reload:
node skills/html-report/scripts/serve-report.mjs report.html --port 3000

# Assembly with custom theme (JSON or CSS):
node skills/html-report/scripts/build-report.mjs \
  --title "Brand Report" \
  --content report-fragment.html \
  --custom-theme brand-theme.json \
  --output report.html

# Verification only:
node skills/html-report/playwright/verify-report.mjs report.html --quick

# Focused sub-second CDN check:
node skills/html-report/playwright/verify-report.mjs report.html --check-mermaid

# Full CDN styleguide matrix verification with machine-readable telemetry:
node skills/html-report/playwright/verify-report.mjs report.html --all-cdns --json results.json
```

### Playwright Extensible Verification Harness & CDN Styleguide Matrix
`verify-report.mjs` is powered by a modular, pluggable test harness (`skills/html-report/playwright/harness/`) built on the Strategy and Registry patterns.

#### Precision CLI Flags Matrix

| Flag | Argument | Default | Description |
|---|---|---|---|
| `--quick`, `-q` | None | `false` | Quick mode: test `sm` + `lg` breakpoints only, skip PDF, 5s timeout |
| `--pdf` | `<path>` | `null` | Render and export PDF to specified path |
| `--mode` | `<interactive\|static>` | auto | Override report execution mode |
| `--caller` | `<caller-id>` | `null` | Caller harness integration ID |
| `--timeout` | `<ms>` | `30000` (or `5000` in quick) | Page load and check assertion timeout bound |
| `--suites` | `<comma-list>` | all | Run only named suites (`core,cdns,responsive,themes,print,a11y`) |
| `--only` | `<name>` | `null` | Target single check or category (e.g. `--only mermaid`) |
| `--grep` | `<regex>` | `null` | Filter checks matching regex pattern (e.g. `--grep "^cdn:"`) |
| `--all-cdns` | None | `false` | Enforce full styleguide checks across all 10 CDN libraries |
| `--cdns` | `<comma-list>` | auto | Target specific CDNs (e.g. `--cdns mermaid,charts,leaflet`) |
| `--check-<cdn>` | None | `false` | Targeted flags: `--check-charts`, `--check-mermaid`, `--check-maps`, `--check-tables`, `--check-math`, `--check-code`, `--check-markdown`, `--check-icons`, `--check-reactive`, `--check-calendar` |
| `--themes` | `<comma-list>` | all (or light in quick) | Target specific DaisyUI themes (e.g. `--themes light,dark,cyberpunk`) |
| `--viewports` | `<comma-list>` | standard 5 (or 2 in quick) | Target breakpoints (`sm,md,lg,xl,2xl` or custom `1920x1080`) |
| `--bail` | None | `false` | Immediately abort execution upon first check failure |
| `--strict` | None | `false` | Fail on console warnings or layout badge wrapping alerts |
| `--json` | `<path>` | `null` | Export structured JSON telemetry report for automated agent workflows |
| `--screenshots` | `[dir]` | `null` | Capture full-page PNG screenshots on check failure or viewport |
| `--color-contrast` | None | `false` | Run automated WCAG AA color contrast and landmark audits |
| `--headed` | None | `false` | Run browser in headed mode for visual live debugging |

#### Deterministic CDN Styleguide Matrix
The harness enforces deterministic visual and behavioral styleguide rules across all 10 CDN libraries:
- **Chart.js (`--check-charts`)**: Canvas presence, DaisyUI CSS variable palette sync (`--p`, `--s`, `--a`, `--n`), responsive resize, zero NaN artifacts.
- **Mermaid (`--check-mermaid`)**: SVG diagram render, theme re-render, strict absence of `"Syntax error in text"` or error SVGs.
- **Leaflet (`--check-maps`)**: Map panes loaded, tiles decoded (`naturalWidth > 0`), zero 403 HTTP errors (strictly enforces ESRI/Voyager).
- **Grid.js (`--check-tables`)**: Table elements rendered, active search input and pagination, zero container overflow.
- **KaTeX (`--check-math`)**: Formatted `.katex` blocks rendered, zero raw unrendered LaTeX markers leaking into DOM text.
- **Highlight.js (`--check-code`)**: Code blocks highlighted with language classes, `.hljs-keyword` elements present.
- **Marked (`--check-markdown`)**: Semantic HTML elements rendered, zero raw unparsed markdown symbols.
- **Lucide & Alpine (`--check-icons`, `--check-reactive`)**: `[data-lucide]` replaced with inline SVGs; Alpine `[x-data]` mounted with zero hanging `x-cloak`.
- **FullCalendar (`--check-calendar`)**: Calendar grid rendered, toolbar formatted, events mounted cleanly.

#### Troubleshooting Guide
- **Sub-Second Feedback**: When actively iterating on a single component or CDN, pass `--check-<cdn>` (e.g. `verify-report.mjs report.html --check-mermaid`) to test in <800ms without cycling through all 5 viewports and 32 themes.
- **Bail on First Failure**: Use `--bail` in CI or agent retry loops to fail fast and receive immediate diagnostic feedback.
- **Strict Mode**: Pass `--strict` to prevent subtle regressions like multi-line badge wrapping or console warnings before merging changes.


### Custom DaisyUI Theme Specification & Studio
Reports support user-defined themes via:
1. **JSON Theme Definition**: Conforms to DaisyUI 4 format with optional base theme inheritance:
   ```json
   {
     "acme-brand": {
       "extends": "dark",
       "primary": "#3b82f6",
       "secondary": "#ec4899",
       "accent": "#10b981",
       "--rounded-box": "1rem",
       "--rounded-btn": "0.5rem"
     }
   }
   ```
2. **Raw CSS Passthrough**: `[data-theme="acme"] { --p: 62.3% 0.188 259.8; ... }`.
3. **In-Browser Top Collapsible Studio**: Expand the top accordion banner beneath the document title to customize colors in real-time with zero-dependency OKLCH monitors, live Chart.js/Mermaid reactivity, `localStorage` persistence, and one-click CSS & Tailwind export.

### Datastar.js Real-Time Live Dashboards (`--live`)
Reports support real-time hypermedia streaming and reactive signals via **Datastar.js**:
1. **CLI Flag (`--live`, `-l`)**:
   Enables the Datastar ESM bundle, sets `data-report-mode="live"`, and permits SSE stream ingestion without full-page reloads.
   ```bash
   node skills/html-report/scripts/build-report.mjs --title "Live Agent Dashboard" --content live-fragment.html --live --output live.html
   ```
2. **Server-Sent Events (SSE) Morphing**:
   The dev server (`serve-report.mjs`) provides `/__datastar_stream__` for streaming `datastar-fragment` DOM morphs (using Idiomorph) and `datastar-merge-signals` updates.
3. **Task & Session Telemetry Pipeline (`datastar-sse.mjs`)**:
   Standardized `TaskTelemetrySchema`, `AgyTelemetryAdapter` (Google Antigravity transcripts), and `CodexTelemetryAdapter` (OpenAI reasoning & tool chunks) stream agent Chain-of-Thought, live task checklist cards (`#task-${id}`), and tool invocation cards (`#tool-call-feed`) in real time.
4. **Post-Morph Icon Rehydration**:
   `report-runtime.js` automatically observes DOM morphs with a `MutationObserver` and rehydrates `<i data-lucide="...">` tags into SVG icons.

### Step 3: Auto-Open & Single-Tab Live-Reload Dev Server
Launch the local live-reload server to view and iterate on the report:

```bash
node skills/html-report/scripts/serve-report.mjs report.html
```

- **Single-Tab Live-Reload**: Broadcasts SSE to refresh the existing browser tab in place upon disk updates without opening redundant tabs.
