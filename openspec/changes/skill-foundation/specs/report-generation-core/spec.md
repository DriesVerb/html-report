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

### Requirement: DaisyUI Theme Dropdown with Color-Scheme Swatch Previews and Live Chart Synchronization
The DaisyUI `navbar` theme selector SHALL display all 32 built-in DaisyUI themes in a dropdown where each theme option previews its own color scheme (`bg-base-100`, `text-base-content`, and `bg-primary`, `bg-secondary`, `bg-accent`, `bg-neutral` swatches inside `data-theme="<theme>"`) matching the DaisyUI website, and selecting a theme SHALL dynamically update Chart.js instances, Mermaid diagrams, and CSS-themed components.

#### Scenario: Viewing and selecting a DaisyUI theme with color swatches
- **WHEN** a user opens the theme dropdown in the navbar and selects a theme
- **THEN** each theme option displays its live DaisyUI color swatches, `<html data-theme="...">` updates immediately, and all Chart.js charts, Mermaid diagrams, and CSS-driven report elements recompute their palette colors from the active DaisyUI theme variables

### Requirement: Navbar Icon-Only Self-Contained HTML Download Button with Inlined CDNs
The DaisyUI `navbar` SHALL include an icon-only Download button (with an accessible `aria-label` and tooltip, and no visible text label) that exports and downloads the HTML report as a standalone `.html` file with all external CDN stylesheets (`<link rel="stylesheet">`) and CDN scripts (`<script src="...">`) fetched and embedded inline into the downloaded file.

#### Scenario: Clicking the icon-only Download button
- **WHEN** a user inspects or clicks the Download button in the navbar
- **THEN** the button renders as an icon-only control without visible download text, fetches all referenced CDN CSS and JS assets, inlines them into `<style>` and `<script>` blocks inside the HTML snapshot while preserving the active `data-theme`, and triggers a `.html` file download

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
