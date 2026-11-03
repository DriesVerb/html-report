# Spec Delta

## Purpose

Defines the core requirements for the `html-report` skill, including the 11-library non-blocking CDN stack, DaisyUI navbar (left-aligned title, right-aligned heading TOC dropdown, DaisyUI color-swatch theme dropdown synchronized with Chart.js and CSS components, and icon-only CDN-inlining HTML download button), dedicated Chart.js and Mermaid style standards, horizontal-scrollbar insufficient-space indication, full-featured example report showcasing all CDNs by name, and Playwright multi-breakpoint pre-PDF verification.

## ADDED Requirements

### Requirement: Non-Blocking Multi-Library CDN Stack
The `html-report` skill SHALL include a standardized CDN stack for Tailwind CSS, DaisyUI (with full themes stylesheet), Lucide (icons), Alpine.js (reactive components), Leaflet (maps), Chart.js (charts), Mermaid (diagrams), Grid.js (data tables), KaTeX (math rendering), Marked (Markdown rendering), and Highlight.js (code formatting), using non-blocking script loading (`defer` or async initialization) and isolated feature guards so no library blocks initial rendering.

#### Scenario: Rendering a report with the full 11-library CDN stack
- **WHEN** an HTML report loads in the browser
- **THEN** HTML structure and styles render without blocking on JavaScript CDNs, and each interactive feature (Lucide, Alpine.js, Leaflet, Chart.js, Mermaid, Grid.js, KaTeX, Marked, Highlight.js) initializes independently via defensive guards

### Requirement: DaisyUI Navbar with Left-Aligned Title and Right-Aligned Controls
Every generated HTML report SHALL feature a sticky DaisyUI `navbar` containing the report title on the left (`navbar-start`) and the interactive controls (Contents TOC dropdown mapping all `h1`, `h2`, and `h3` headings via `#id` links, DaisyUI theme switcher dropdown, and icon-only Download button) on the right (`navbar-end`).

#### Scenario: Navigating report sections via the right-side DaisyUI navbar controls
- **WHEN** a user views the DaisyUI navbar and opens the Contents dropdown on the right (`navbar-end`)
- **THEN** the report title is displayed on the left (`navbar-start`) while the Contents dropdown, theme switcher, and icon-only download button are grouped on the right (`navbar-end`) and link smoothly to every `h1`, `h2`, and `h3` heading `id`

### Requirement: DaisyUI Theme Dropdown with Default Light Theme, Color-Scheme Swatch Previews, and Live Chart Synchronization
Every generated HTML report SHALL default to the `light` DaisyUI theme (`<html data-theme="light">`), display all 32 built-in DaisyUI themes in a dropdown where each theme option previews its own color scheme (`bg-base-100`, `text-base-content`, and `bg-primary`, `bg-secondary`, `bg-accent`, `bg-neutral` swatches inside `data-theme="<theme>"`), and dynamically update Chart.js instances, Mermaid diagrams, and CSS-themed components when switching themes.

#### Scenario: Loading default light theme and selecting a DaisyUI theme with color swatches
- **WHEN** a report loads initially or a user selects a theme from the navbar dropdown
- **THEN** the initial theme is `light`, each dropdown item displays its 4 color swatches, `<html data-theme="...">` updates immediately, and all Chart.js, Mermaid, and Grid.js elements recompute their palette colors from the active DaisyUI theme variables

### Requirement: Navbar Icon-Only Download Dropdown with HTML and PDF Export Options
The DaisyUI `navbar` SHALL include an icon-only Download dropdown trigger button (`#download-dropdown-btn`, no visible text on the navbar button) that opens a dropdown menu offering two options: **Download as HTML** (`#download-html-btn`, fetching and embedding all external CDN stylesheets and scripts inline into a standalone `.html` file) and **Download as PDF** (`#download-pdf-btn`, preparing charts/print layout and triggering PDF/print export).

#### Scenario: Opening the Download dropdown and choosing HTML or PDF
- **WHEN** a user opens the icon-only Download dropdown in the navbar
- **THEN** the menu presents both "Download as HTML" (which bundles all CDNs inline) and "Download as PDF" (which triggers print/PDF export)

### Requirement: Print Media Queries and First-Page Title plus Heading Table of Contents in PDF
Every generated HTML report SHALL include `@media print` CSS rules that hide the sticky navbar and non-printable interactive controls, preserve active DaisyUI theme colors (`print-color-adjust: exact`), and render a dedicated first-page cover section (`#print-cover-page`) displaying the report title and the full `h1`, `h2`, and `h3` Table of Contents (`#print-toc-list`) followed by a page break (`break-after: page`).

#### Scenario: Rendering the report in print / PDF media mode
- **WHEN** the report is rendered under `@media print` or exported to PDF
- **THEN** the navbar and interactive-only form controls are hidden, Page 1 displays the report title and the complete `h1`/`h2`/`h3` Table of Contents, and subsequent pages render static print-ready visuals in the active DaisyUI theme

### Requirement: Dedicated Charts and Mermaid Style Guide Standards
The skill SHALL provide a dedicated style guide (`references/charts-and-mermaid-style-guide.md`) enforcing DaisyUI CSS variable color resolution, explicit responsive container heights, typography scales, legend rules, and print/PDF rendering stability for all Chart.js and Mermaid visualizations.

#### Scenario: Generating a report containing Chart.js or Mermaid visuals
- **WHEN** an agent includes a Chart.js chart or Mermaid diagram in a report
- **THEN** the visuals adhere to the DaisyUI theme-reactive palette, container sizing, and print-resilience rules specified in `references/charts-and-mermaid-style-guide.md`

### Requirement: Horizontal Scrollbar Insufficient-Space Indication
When any element in a report develops a horizontal scrollbar (`scrollWidth > clientWidth`), the report runtime and the Playwright breakpoint verifier SHALL explicitly indicate that the element does not have enough horizontal space.

#### Scenario: Detecting an element with a horizontal scrollbar
- **WHEN** an element's `scrollWidth` exceeds its `clientWidth` at any viewport width
- **THEN** the runtime overflow detector marks the element with a visible insufficient-space warning indicator (`data-insufficient-space="true"`) and the Playwright verifier reports that the element does not have enough space at that breakpoint

### Requirement: Full-Featured Showcase Example HTML Featuring All CDN Names and Examples
The skill SHALL include `skills/html-report/examples/example.html` explicitly naming all 11 integrated CDNs (Tailwind CSS, DaisyUI, Lucide Icons, Alpine.js, Chart.js, Mermaid, Leaflet, Grid.js, KaTeX, Marked, Highlight.js) and demonstrating a live working example of every single one alongside the navbar controls.

#### Scenario: Inspecting the example report for CDN names and live examples
- **WHEN** `skills/html-report/examples/example.html` is opened or tested
- **THEN** all 11 CDN names are explicitly listed and each CDN's live example renders without errors or horizontal scrollbars across all Tailwind breakpoints

### Requirement: CSV-Backed Report Highlight, File Search Function, and Grid.js/Alpine.js Actions
When an HTML report or form is created on the basis of a CSV file, the report SHALL visually highlight that it is built around that CSV file, provide a file search/loader and filter control displaying the CSV filename (e.g., `example.csv`), and wire the CSV data to drive both Alpine.js reactive actions and a Grid.js interactive table, showcased at the bottom of `skills/html-report/examples/example.html` alongside `skills/html-report/examples/example.csv`.

#### Scenario: Interacting with the CSV-backed section at the bottom of example.html
- **WHEN** a user views or filters the CSV-backed section for `example.csv` at the bottom of `examples/example.html`
- **THEN** the UI highlights `example.csv` as the active data source, provides a search/file control naming `example.csv`, and updates both the Alpine.js reactive metrics/actions and the Grid.js table rows

### Requirement: Playwright Multi-Breakpoint and Pre-PDF Verification
The skill SHALL provide a Playwright verification tool in `skills/html-report/playwright/` that checks the HTML report across all 5 Tailwind CSS breakpoints (`sm`–`2xl`) for page-level and element-level horizontal scrollbars, validates the navbar, 32 theme swatches, 11 CDN examples, and CSV-backed form actions, and verifies PDF export readiness before delivering the report to the user.

#### Scenario: Running Playwright verification before sending PDF to the user
- **WHEN** the Playwright check script runs against an HTML report (including `examples/example.html`)
- **THEN** it tests layout and element-level horizontal scrollbars at `640px`, `768px`, `1024px`, `1280px`, and `1536px` widths, verifies zero console/page errors, valid `h1`/`h2`/`h3` TOC anchors, color-swatch theme dropdown reactivity, icon-only download button, and all 11 CDN examples, and confirms clean PDF generation

### Requirement: Interactive vs. Static Report Mode Discrimination & Conditional PDF Readiness
The skill SHALL ask or indicate upfront whether a requested report is **Interactive** (client-side filters, dynamic search, tabs, widget manipulation) or **Static** (print-first publication document). ONLY when the report is designated as **Static** SHALL the agent generate `@media print` queries, Page 1 print cover + TOC, static print fallbacks, and run print media/PDF verification. If generated in **Interactive Mode**, the navbar download dropdown PDF option SHALL indicate that it is not PDF-ready and suggest a prompt to make it PDF-ready with media print queries.

#### Scenario: User requests an Interactive report
- **WHEN** the user requests or selects an Interactive report
- **THEN** the agent focuses on client-side interactivity, omits print media queries and PDF verification overhead, and sets the navbar download dropdown PDF option to indicate "Not PDF Ready (Interactive Mode)" with a suggested conversion prompt to add print media queries

#### Scenario: User requests a Static report
- **WHEN** the user requests or selects a Static / print-first report
- **THEN** the agent includes comprehensive `@media print` rules, Page 1 cover + TOC, static fallbacks, and verifies print media queries and PDF export via Playwright

### Requirement: Content-Aware Favicon Emoticon
Every generated HTML report SHALL include a `<link rel="icon" ...>` featuring an emoji/emoticon favicon embedded as an inline SVG data URI based on the subject matter and content of the document (e.g., `📊` for analytics/data dashboards, `🗺️` for geospatial/maps, `⚡` for performance benchmarks, `🧪` for experiments/research, `💻` for developer/code reports), ensuring a visual tab icon with zero external image assets or HTTP requests.

#### Scenario: Inspecting the document `<head>` for a content-aware favicon
- **WHEN** an HTML report is generated for a given topic
- **THEN** the `<head>` contains a `<link rel="icon">` with an SVG data URI encoding an emoji that visually reflects the document's subject

### Requirement: Post-Generation Auto-Open and Single-Tab Live-Reload Sync
Upon completing report generation or updates, the skill SHALL automatically open the HTML report in the user's browser, preferably served via a local development server or live-reload watcher. When the report is updated, if an existing tab is already open, it SHALL reload the existing tab rather than spawning redundant duplicate tabs; if no tab is currently open, it SHALL reopen the report in a single browser tab.

#### Scenario: Report generation completes for the first time
- **WHEN** an HTML report is newly generated
- **THEN** it automatically opens in the user's default browser tab

#### Scenario: Report file is updated while already open in a browser tab
- **WHEN** changes are made and saved to an existing HTML report that is currently active in a browser tab
- **THEN** the existing tab live-reloads the updated content without opening a new browser tab

#### Scenario: Report file is updated while no browser tab is currently open
- **WHEN** changes are made and saved to an HTML report and no browser tab is currently displaying it
- **THEN** it automatically reopens in a single browser tab
