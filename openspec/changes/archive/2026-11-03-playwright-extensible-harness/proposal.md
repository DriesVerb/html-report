# Proposal: Playwright Extensible Verification Harness, CDN Styleguide Matrix & Precision Flags

## Why
`skills/html-report/playwright/verify-report.mjs` was created as an all-in-one verification script to validate HTML reports across breakpoints, theme switches, and PDF output. However, as the `html-report` project has expanded (adding dynamic caller awareness, custom theme compilers, print covers, and 12+ CDN addons), the monolithic structure faces serious limitations:

1. **Tight Coupling & Monolithic Architecture**: All checks (DOM inspection, console logging, network tile errors, breakpoint resizing, theme switching, PDF export, caller integration) are hardcoded into a single 658-line procedural script. Adding a new check or addon assertion requires modifying the entire verification file.
2. **Missing Granular CDN Styleguide Verification**: The report template supports 16 CDN libraries (Chart.js, Mermaid, Leaflet, Grid.js, KaTeX, Marked, Highlight.js, FullCalendar, Impress.js, Mock.js, Day.js, Lucide, Alpine.js, DaisyUI, Tailwind, Canvas-Confetti). Currently, there is no way to selectively test individual CDNs or enforce their specific styleguides (e.g. Chart.js DaisyUI color palette sync, Mermaid dark/light SVG re-rendering without syntax errors, Leaflet unblocked tile provider compliance, Grid.js responsive wrapping, KaTeX unparsed token prevention).
3. **Limited Invocational Precision**: Currently, the CLI only supports coarse controls (`--quick`, `--mode`, `--pdf`, `--caller`). Authors and automated agent pipelines cannot selectively run just theme tests, adjust timeouts for slow CI runners, filter test steps, or capture debug screenshots on failure.
4. **Missing Machine-Readable Diagnostics**: When tests fail in automated agent workflows, the output is unstructured terminal text, making programmatic diagnosis, auto-remediation, and CI status reporting brittle.
5. **Lack of Accuracy Flags**: Agents need precision controls such as `--strict` (turn warnings into hard errors), `--bail` (fail fast on first regression), `--timeout` (prevent hangs in resource-constrained environments), `--themes` (test specific palettes without waiting for 32 theme switches), and `--all-cdns` / `--check-<cdn>` (deterministic styleguide checks).

Refactoring the Playwright verification suite into an **extensible, pluggable check pipeline** with a **dedicated CDN Styleguide Matrix** and **fine-grained precision flags** provides a modern, robust, and highly extensible testing foundation.

---

## Architectural Decisions
* **D1 (Pluggable Check Pipeline)**: Break verification into isolated, reusable check modules conforming to a standard `VerificationCheck` contract: `async execute({ page, context, options, reporter })`.
* **D2 (Decoupled Core vs CDN Subsystems)**:
  - `checks/core/`: console errors, structural navbar/footer, responsive viewports, 32 DaisyUI themes, print media & PDF.
  - `checks/cdns/`: dedicated deterministic styleguide validators for each library (Chart.js, Mermaid, Leaflet, Grid.js, KaTeX, Marked, Highlight.js, FullCalendar, Lucide, Alpine).
* **D3 (Rich Precision CLI Flags & CDN Styleguide Flags)**:
  - Execution control: `--timeout <ms>`, `--bail`, `--strict`, `--headed`
  - CDN targeting: `--cdns <list>`, `--all-cdns`, `--check-charts`, `--check-mermaid`, `--check-maps`, `--check-tables`, `--check-math`, `--check-code`, `--check-icons`, `--check-reactive`, `--check-calendar`
  - Filtering: `--suites <names>`, `--only <name>`, `--grep <regex>`
  - Visual & environmental targeting: `--themes <list>`, `--viewports <list>`, `--screenshots [dir]`
  - Diagnostics & reporting: `--json <path>`, `--quiet`, `--verbose`
* **D4 (Deterministic Quality Assertions)**: Replace arbitrary delays with explicit DOM ready-state predicates and deterministic assertion schemas returning `{ id, passed, durationMs, styleguide: { rulesChecked, compliant }, errors, warnings }`.
* **D5 (100% Backward Compatibility)**: The existing `node skills/html-report/playwright/verify-report.mjs <file> [--quick] [--pdf <path>] [--mode <mode>] [--caller <caller>]` command signature remains fully supported as a transparent facade delegating to the new pipeline.

---

## What Changes

### 1. Modular Directory Structure
Under `skills/html-report/playwright/`:
* `harness/runner.mjs`: Orchestrates browser launch, context creation, check scheduling, timeout boundaries, and bail handling.
* `harness/registry.mjs`: Manages standard checks, CDN checks, and dynamically registered custom check plugins.
* `harness/reporter.mjs`: Handles console formatting, badges, timers, verbose logs, and structured JSON output.
* `harness/checks/core/`:
  - `console.mjs`: Monitors console errors, unhandled exceptions, and bad network responses.
  - `structure.mjs`: Verifies default 'light' theme, favicon, navbar hierarchy, download dropdown, centered footer, and TOC anchors.
  - `responsive.mjs`: Tests layout across specified viewports, badge wrapping, and detects `data-insufficient-space`.
  - `themes.mjs`: Switches themes, tests DaisyUI swatches, and validates Chart/Mermaid color palette sync.
  - `print.mjs`: Verifies `@media print` rules, cover page layout, and PDF generation.
  - `a11y.mjs`: Performs WCAG AA contrast and accessibility landmark checks.
* `harness/checks/cdns/`:
  - `charts.mjs`: Chart.js canvas rendering, theme CSS variable palette sync (`--p`, `--s`, `--a`, `--n`), responsive canvas scaling.
  - `mermaid.mjs`: SVG diagram rendering, DaisyUI dark/light theme re-render, strict `syntax error in text` inspection.
  - `leaflet.mjs`: Leaflet panes, tile decoding, unblocked tile servers (enforcing no OSM/Carto direct 403s).
  - `gridjs.mjs`: Table rendering, search/sort UI, pagination, zero horizontal overflow.
  - `katex.mjs`: Math formula formatting, ensuring zero unparsed LaTeX syntax leaks.
  - `highlight.mjs`: Code block parsing, `.hljs-keyword` verification, theme styling.
  - `marked.mjs`: Semantic HTML rendering from markdown.
  - `lucide.mjs`: Replacement of all `[data-lucide]` with valid SVGs.
  - `alpine.mjs`: Alpine.js component reactivity, `x-data` mounting.
  - `fullcalendar.mjs`: Calendar grid, toolbar formatting, event rendering.
* `verify-report.mjs`: Light CLI entrypoint parsing arguments and passing them into `runner.mjs`.

### 2. Expanded CLI Flag Matrix
Full documentation and implementation of:
`--timeout`, `--suites`, `--only`, `--grep`, `--cdns`, `--all-cdns`, `--check-charts`, `--check-mermaid`, `--check-maps`, `--check-tables`, `--check-math`, `--check-code`, `--check-icons`, `--check-reactive`, `--check-calendar`, `--themes`, `--viewports`, `--screenshots`, `--bail`, `--strict`, `--json`, `--color-contrast`, and `--headed`.

---

## Capabilities

### New Capabilities
* `playwright-extensible-harness`: Modular check execution, custom check registration, deterministic CDN styleguide testing, fine-grained test filtering, structured JSON reporting, and precision execution flags for the Playwright verification suite.

---

## Impact
* **Modularity**: New checks (e.g. verifying new CDN libraries or custom themes) can be added as self-contained files without touching the runner.
* **Deterministic CDN Quality**: Each CDN library has automated styleguide assertions verifying color sync, tile validity, and error-free rendering.
* **Performance & Speed**: Developers and CI can run targeted checks (e.g. `--check-mermaid` or `--suites themes --themes dark,dracula`) in milliseconds rather than running the full 30-second suite.
* **Agent Integration**: Machine-readable JSON output (`--json`) provides LLMs with exact line numbers, failed assertions, and screenshot paths for automated self-healing.
