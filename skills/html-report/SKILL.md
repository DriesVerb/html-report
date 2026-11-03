---
name: html-report
description: >-
  Generates publication-grade, interactive, and print-ready HTML5 reports with a
  non-blocking 11-library CDN stack (Tailwind CSS, DaisyUI with all 32 themes
  defaulting to 'light', Lucide Icons, Alpine.js, Chart.js, Mermaid, Leaflet
  maps, Grid.js tables, KaTeX math, Marked markdown, and Highlight.js code
  formatting), a sticky DaisyUI navbar (left-aligned report title, right-aligned
  Table of Contents dropdown mapping h1/h2/h3 IDs, DaisyUI color-swatch theme
  dropdown synced to charts/diagrams, and icon-only Download dropdown for HTML
  or PDF), @media print rules with a Page 1 Cover + H1/H2/H3 TOC, horizontal-scrollbar
  insufficient-space detection, and Playwright multi-breakpoint & 5-theme PDF
  verification. Use when the user asks to create, design, or export an HTML
  report, dashboard report, or PDF-backed HTML summary.
---

# HTML Report Generation Skill (`html-report`)

This skill guides the creation of rich, responsive, theme-adaptive, and print/PDF-verified HTML5 reports using a **fast deterministic pipeline**.

Agents generate **only the semantic `<main>` content fragment** (stats, cards, charts, diagrams, tables), saving ~70% of output tokens. The deterministic builder CLI (`build-report.mjs`) stitches the fragment into the pre-bundled DaisyUI shell (`template-shell.html`) with client runtime (`report-runtime.js`) in <100ms, auto-detecting required CDNs. Lean Playwright verification (`--quick`) validates mobile and desktop responsiveness in <4 seconds.

---

## Progressive Disclosure Reference Files

Before writing any HTML report, read the relevant reference guides in this skill directory:

1. **[Architecture, 11-CDN Stack & DaisyUI Navbar Blueprint](./references/architecture-and-styling.md)** *(Required for all reports)*:
   - Modular CDN loading: Core 4 baseline (`Tailwind CSS`, `DaisyUI v4 full + all 32 themes`, `Lucide Icons`, `Alpine.js`) with on-demand addons (`Chart.js`, `Mermaid`, `Leaflet`, `Grid.js`, `KaTeX`, `Marked`, `Highlight.js`) auto-detected by `build-report.mjs`.
   - Pre-bundled **`assets/template-shell.html`** and **`assets/report-runtime.js`**.
   - Sticky **DaisyUI Navbar** structure (`print:hidden`, default theme always `data-theme="light"`):
     - **Left (`navbar-start`)**: Report Title (`#navbar-report-title`).
     - **Right (`navbar-end`)**: `Contents` dropdown mapping `h1`/`h2`/`h3` `#id` links, **DaisyUI 32-Theme Dropdown** where each theme option displays its color scheme swatches (`bg-primary`, `bg-secondary`, `bg-accent`, `bg-neutral`), and an **icon-only Download dropdown** (`#download-dropdown`).
   - Canvas 2D OKLCH color resolution and Mermaid numbered list syntax defense.
   - Horizontal-scrollbar insufficient-space detector (`checkInsufficientHorizontalSpace()`).
2. **[Charts (Chart.js) & Diagrams (Mermaid) Dedicated Style Guide](./references/charts-and-mermaid-style-guide.md)** *(Required whenever a report contains charts or Mermaid diagrams)*:
   - Universal DaisyUI theme color resolver (`resolveDaisyUIThemePalette()`) using an offscreen 1x1 `<canvas>` 2D context to convert `oklch(...)` colors into `#rrggbb` hex and `rgba(...)`.
   - Dynamic re-theming for **Chart.js** canvases and **Mermaid** SVG diagrams when switching across any of the 32 DaisyUI themes.
   - Fixed-height responsive containers (`h-72 sm:h-80`) and print/PDF resize hooks.
   - Defense against ordered list tokens (`1. `, `2. `) in Mermaid subgraphs.
3. **[Full-Featured Showcase Example (`example.html`)](./examples/example.html)**:
   - Complete working reference implementation explicitly demonstrating all 11 CDNs, top collapsible theme generator studio, and CSV-driven interactive workflows.
4. **[Custom DaisyUI Theme Engine & Compiler (`theme-compiler.mjs`)](./scripts/theme-compiler.mjs)**:
   - Zero-dependency pure JS matrix conversion (`sRGB` &rarr; `Linear` &rarr; `XYZ` &rarr; `OKLab` &rarr; `OKLCH`).
   - Base theme inheritance (`extends: "dark"` or any of 32 native DaisyUI themes) and automatic high-contrast content generator (`--pc`, `--sc`, etc.).
   - Support for both JSON configuration objects and raw CSS rules (`[data-theme="..."]`).
   - CLI integration via `build-report.mjs --custom-theme <path>` and in-browser top collapsible studio (`example.html`).
5. **[Caller-Aware Integration Registry (`caller-registry.mjs`)](./scripts/caller-registry.mjs)** *(Required when invoked by agent skills or CLI tools)*:
   - Dedicated gitignored vault at `.caller-requests/` holding persistent caller profiles (`profiles/<caller-id>.md`) and ephemeral run payloads (`runs/<caller-id>/<run-id>/`).
   - Zero-config auto-scaffolding, 10-run pruning, and non-destructive override hierarchy.
   - Default output routing: `./report-<caller-id>.html` and `./report-<caller-id>.pdf`.
5. **[Deterministic FSM Harness & Remediation Architecture (`harness-architecture.md`)](./references/harness-architecture.md)** *(Architecture & small-model remediation)*:
   - Zero-dependency Node.js Finite State Machine lifecycle: `IDLE` &rarr; `VALIDATING` &rarr; `AUTO_FIXING` &rarr; `ASSEMBLING` &rarr; `VERIFYING` &rarr; `COMPLETED` / `REMEDIATING` / `FAILED`.
   - Mechanical auto-fixes (stripping outer wrappers, generating heading IDs, wrapping bare tables).
   - "Small Model First" prescriptive JSON error payloads with `instruction_for_agent` fields and bounded 3-attempt retries.

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
  - Save the semantic fragment to a temporary file (e.g. `report-fragment.html`).

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

*(Low-Level Modular Alternative)*:
If you need to execute compilation and verification separately:
```bash
# Assembly only:
node skills/html-report/scripts/build-report.mjs --title "Report Title" --content report-fragment.html --output report.html --theme light

# Assembly with custom theme (JSON or CSS):
node skills/html-report/scripts/build-report.mjs \
  --title "Brand Report" \
  --content report-fragment.html \
  --custom-theme brand-theme.json \
  --output report.html

# Verification only:
node skills/html-report/playwright/verify-report.mjs report.html --quick
```

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

### Step 3: Auto-Open & Single-Tab Live-Reload Dev Server
Launch the local live-reload server to view and iterate on the report:

```bash
node skills/html-report/scripts/serve-report.mjs report.html
```

- **Single-Tab Live-Reload**: Broadcasts SSE to refresh the existing browser tab in place upon disk updates without opening redundant tabs.
