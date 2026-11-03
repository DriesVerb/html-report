# Tasks: Playwright Extensible Verification Harness, CDN Styleguide Matrix & Precision Flags

## Phase 1: Architecture Core & Check Registry
- [x] 1.1 Create `skills/html-report/playwright/harness/registry.mjs` defining the `VerificationCheck` contract, categories (`core`, `cdn`, `a11y`, `print`), and `CheckRegistry` registration/lookup API.
- [x] 1.2 Create `skills/html-report/playwright/harness/runner.mjs` orchestrating browser startup, context creation, check pipeline execution, bail handling, and timeout boundaries.
- [x] 1.3 Create `skills/html-report/playwright/harness/reporter.mjs` managing console status logging, execution timers, styleguide compliance tables, and structured JSON output.

## Phase 2: Core Check Modules Extraction
- [x] 2.1 Extract console error and network tile monitoring into `harness/checks/core/console-errors.mjs`.
- [x] 2.2 Extract default 'light' theme, favicon, navbar hierarchy, download dropdown, and centered footer into `harness/checks/core/structure.mjs`.
- [x] 2.3 Extract responsive viewport testing, badge pill overflow, and horizontal scrollbar detection into `harness/checks/core/responsive.mjs`.
- [x] 2.4 Extract DaisyUI 32-theme dropdown switching and palette sync into `harness/checks/core/theme-switcher.mjs`.
- [x] 2.5 Extract print media styling (@media print rules), cover page layout, and PDF generation into `harness/checks/core/print-pdf.mjs`.
- [x] 2.6 Extract WCAG AA color contrast and accessibility landmark audits into `harness/checks/core/a11y-contrast.mjs`.

## Phase 3: Dedicated CDN Styleguide Matrix
- [x] 3.1 Implement Chart.js styleguide check in `harness/checks/cdns/charts.mjs` (DaisyUI CSS variable palette sync `--p`, `--s`, `--a`, `--n`, responsive canvas resize, zero clipping).
- [x] 3.2 Implement Mermaid styleguide check in `harness/checks/cdns/mermaid.mjs` (SVG diagram render, dark/light theme sync, strict absence of `"Syntax error in text"`).
- [x] 3.3 Implement Leaflet styleguide check in `harness/checks/cdns/leaflet.mjs` (pane sanity, tile naturalWidth > 0, strict prevention of 403 HTTP errors).
- [x] 3.4 Implement Grid.js styleguide check in `harness/checks/cdns/gridjs.mjs` (table DOM, search input, pagination, zero horizontal overflow).
- [x] 3.5 Implement KaTeX styleguide check in `harness/checks/cdns/katex.mjs` (formatted `.katex` blocks, zero unrendered LaTeX syntax tokens leaking into DOM).
- [x] 3.6 Implement Highlight.js styleguide check in `harness/checks/cdns/highlight.mjs` (code block parsing, `.hljs-keyword` verification, theme styling).
- [x] 3.7 Implement Marked styleguide check in `harness/checks/cdns/marked.mjs` (clean semantic HTML elements, zero raw unparsed markdown symbols).
- [x] 3.8 Implement Lucide & Alpine styleguide check in `harness/checks/cdns/lucide.mjs` and `alpine.mjs` (SVG replacement, `x-data` reactivity).
- [x] 3.9 Implement FullCalendar styleguide check in `harness/checks/cdns/fullcalendar.mjs` (grid render, toolbar formatting, event presence).

## Phase 4: Precision CLI Flags Matrix
- [x] 4.1 Implement `--timeout <ms>` flag for configurable navigation and assertion timeout bounds.
- [x] 4.2 Implement `--suites <names>` and `--only <name>` filtering to selectively run check subsets.
- [x] 4.3 Implement `--grep <pattern>` filtering to execute checks or assertions matching regex patterns.
- [x] 4.4 Implement CDN styleguide targeting flags: `--all-cdns`, `--cdns <list>`, and individual flags (`--check-charts`, `--check-mermaid`, `--check-maps`, `--check-tables`, `--check-math`, `--check-code`, `--check-icons`, `--check-reactive`, `--check-calendar`).
- [x] 4.5 Implement `--themes <list>` to test specific DaisyUI themes instead of cycling through all themes.
- [x] 4.6 Implement `--viewports <list>` supporting named breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`) and custom dimensions (`WxH`).
- [x] 4.7 Implement `--bail` for immediate execution halt upon first failed assertion.
- [x] 4.8 Implement `--strict` flag treating layout warnings and console warnings as hard errors.
- [x] 4.9 Implement `--headed` flag to enable non-headless browser debugging.
- [x] 4.10 Implement `--json <path>` to export structured machine-readable test execution reports with styleguide compliance data.
- [x] 4.11 Implement `--screenshots [dir]` capturing PNG images of failed assertions and responsive viewports.

## Phase 5: Facade, Backward Compatibility & Verification
- [x] 5.1 Refactor `skills/html-report/playwright/verify-report.mjs` into a lightweight facade mapping legacy args (`--quick`, `--pdf`, `--mode`, `--caller`) to the new harness runner.
- [x] 5.2 Add comprehensive test suite in `tests/playwright-harness.test.mjs` verifying all CLI flags, CDN styleguide checks, bail behavior, and JSON report generation.
- [x] 5.3 Update `skills/html-report/SKILL.md` with Playwright flags documentation, CDN styleguide commands, and troubleshooting guide.
- [x] 5.4 Update companion `index.html` report and sync with `localhost:3000` (live on `http://localhost:3002`).
