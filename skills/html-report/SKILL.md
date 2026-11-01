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

This skill guides the creation of rich, responsive, theme-adaptive, and print/PDF-verified HTML5 reports. Every report is a single `.html` file powered by a non-blocking 11-library CDN stack and verified across all Tailwind CSS breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`) using Playwright before delivery.

---

## Progressive Disclosure Reference Files

Before writing any HTML report, read the relevant reference guides in this skill directory:

1. **[Architecture, 11-CDN Stack & DaisyUI Navbar Blueprint](./references/architecture-and-styling.md)** *(Required for all reports)*:
   - Exact CDN links (`Tailwind CSS`, `DaisyUI v4 full + all 32 themes`, `Lucide Icons`, `Alpine.js`, `Chart.js`, `Mermaid`, `Leaflet`, `Grid.js`, `KaTeX`, `Marked`, `Highlight.js`) with `defer` non-blocking loading.
   - Sticky **DaisyUI Navbar** structure (`print:hidden`, default theme always `data-theme="light"`):
     - **Left (`navbar-start`)**: Report Title (`#navbar-report-title`).
     - **Right (`navbar-end`)**: `Contents` dropdown mapping `h1`/`h2`/`h3` `#id` links, **DaisyUI 32-Theme Dropdown** where each theme option displays its color scheme swatches (`bg-primary`, `bg-secondary`, `bg-accent`, `bg-neutral` inside `data-theme="<theme>"`), and an **icon-only Download dropdown** (`#download-dropdown`) with options to **Download as HTML** (`#download-html-btn`, inlines all CDNs) or **Download as PDF** (`#download-pdf-btn`, prints/exports with `@media print`).
   - **`@media print` & Page 1 Cover + H1/H2/H3 TOC**: Navbar hidden in print (`display: none !important`), Page 1 (`#print-cover-page`) displays the report title and complete table of contents of all `h1`, `h2`, `h3` tags with `page-break-after: always`, interactive controls hidden (`.print-interactive-control`), and static print fallbacks shown (`.print-only-summary`).
   - **Horizontal Scrollbar / Insufficient-Space Detector**: Indicates whenever any element has a horizontal scrollbar (`scrollWidth > clientWidth`) that it does not have enough space.
2. **[Charts (Chart.js) & Diagrams (Mermaid) Dedicated Style Guide](./references/charts-and-mermaid-style-guide.md)** *(Required whenever a report contains charts or Mermaid diagrams)*:
   - Universal DaisyUI theme color resolver (`resolveDaisyUIThemePalette()`) that converts active `data-theme` colors into `#rrggbb` and `rgba(...)` values.
   - Dynamic re-theming for **Chart.js** canvases and **Mermaid** SVG diagrams when switching across any of the 32 DaisyUI themes.
   - Fixed-height responsive containers (`h-72 sm:h-80`) and print/PDF resize hooks.
3. **[Full-Featured Showcase Example (`example.html`)](./examples/example.html)**:
   - Complete working reference implementation explicitly listing the names of all 11 CDNs and demonstrating live examples of each.

---

## Step-by-Step Workflow

### Step 1: Clarify Report Mode (Interactive vs. Static), Favicon & Document Hierarchy
- **Determine / Ask Report Mode (Interactive vs. Static)**:
  - **Interactive Mode** (`<html lang="en" data-theme="light" data-report-mode="interactive">`): Best for rich browser applications, dashboards, sliders, dynamic filtering, CSV file loaders, or tabbed views.
    - **RULE**: In Interactive Mode, **DO NOT** create print media queries or spend time focusing on PDF readiness. Instead, the navbar Download Dropdown's PDF option displays `"Not PDF-Ready"` and clicking it opens a notice modal (`#pdf-not-ready-modal`) suggesting a prompt to make it PDF ready:
      ```text
      Convert this interactive HTML report into a print/PDF-ready publication report with @media print queries, static fallbacks, and Page 1 TOC
      ```
  - **Static Mode** (`<html lang="en" data-theme="light" data-report-mode="static">`): Best for print-first documents, summaries, and publication-grade reports intended for physical printing or PDF export.
    - **RULE**: **ONLY** when the report is designated as Static Mode should you create `@media print` queries, Page 1 Cover + TOC (`#print-cover-page`), static print fallback views, and run Playwright print media & multi-theme PDF verification.
- **Content-Aware Favicon Emoticon**:
  - Always include a `<link rel="icon">` in `<head>` featuring an emoji/emoticon embedded as an SVG data URI matching the document's content (e.g., `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📊</text></svg>` for metrics/dashboards, `🗺️` for maps, `⚡` for benchmarks, `🧪` for experiments), with zero external assets.
- **Document Hierarchy & Heading IDs**:
  - Structure the report inside `<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">`.
  - Assign every `<h1>`, `<h2>`, and `<h3>` element a unique, descriptive `id` attribute (e.g., `<h2 id="executive-summary" class="scroll-mt-20 ...">`) so the navbar **Contents** dropdown links directly to every section.
  - Start `<main>` with a high-impact Hero / Executive Summary and DaisyUI `stats` KPI overview before diving into detailed sections.

### Step 2: Assemble the Non-Blocking 11-CDN Stack, Favicon & Swapped DaisyUI Navbar
- Follow **[architecture-and-styling.md](./references/architecture-and-styling.md)** to include the non-blocking CDN tags (`defer`), the content-aware favicon emoticon, `<html lang="en" data-theme="light" data-report-mode="..." class="scroll-smooth">` (default theme is always `light`), and the sticky DaisyUI `navbar` (`print:hidden`):
  - **Left (`navbar-start`)**:
    - The **Report Title** (`#navbar-report-title`) aligned to the left.
  - **Right (`navbar-end`)**:
    1. **Contents Dropdown (`#toc-dropdown`)** mapping all `h1`, `h2`, and `h3` headings via `#id` anchors.
    2. **DaisyUI Theme Dropdown (`#theme-dropdown`)** populated with all 32 DaisyUI themes (defaulting to `light`), where each item previews its color scheme swatches (`bg-primary`, `bg-secondary`, `bg-accent`, `bg-neutral`) and updates `<html data-theme="...">`, Chart.js instances, Mermaid diagrams, and CSS components.
    3. **Icon-Only Download Dropdown (`#download-dropdown`)** with an icon-only trigger button (`#download-dropdown-btn`, no text label) opening a dropdown menu (`#download-dropdown-menu`) with two options:
       - **Download as HTML (`#download-html-btn`)**: Wired to `window.buildInlinedHtmlSnapshot()` so clicking it fetches and embeds all external CDN stylesheets and scripts directly into the downloaded `.html` file.
       - **Download as PDF (`#download-pdf-btn`)**:
         - In **Static Mode**: Triggers `window.exportReportPdf()` (`window.print()`).
         - In **Interactive Mode**: Displays a badge `"Not PDF-Ready"` and opens `#pdf-not-ready-modal` suggesting the conversion prompt to add print media queries.
  - **`@media print` & Page 1 Cover + H1/H2/H3 TOC (`#print-cover-page`)** *(Static Mode Only)*:
    - When generating a Static report, hide `header, .navbar, .print\:hidden, .print-interactive-control, .gridjs-head, .gridjs-pages` (`display: none !important`), show `.print-only-summary` static fallbacks, and render `#print-cover-page` on Page 1 displaying the report title (`#print-cover-title`) and the complete Table of Contents of all `h1`, `h2`, and `h3` headings (`#print-toc-list`), followed by `break-after: page; page-break-after: always`.

### Step 3: Build Visuals, Maps, Tables, Math, Markdown, Code & CSV-Driven Controls with Zero Horizontal Scrollbars
- Initialize each subsystem (`initMarkdown()`, `initTOC()`, `initThemeDropdown()`, `initDownloadButton()`, `initLucide()`, `initKaTeX()`, `initGridJs()`, `initCsvShowcase()`, `initCodeHighlight()`, `initCharts()`, `initMermaid()`, `initMaps()`, `checkInsufficientHorizontalSpace()`) inside independent `try / catch` and feature-detection guards.
- **CSV-Driven HTML Reports**: Whenever an HTML report or form is built on the basis of a `.csv` file (such as `examples/example.csv`):
  1. Visually **highlight** that the form/section is built around that CSV file (`data-csv-highlight="true"` banner + badge showing the CSV filename).
  2. Start the CSV workspace **completely empty** (`csvLoaded: false`) until the **Load CSV** control at the top loads the CSV file (`#csv-file-input` or `#load-example-csv-btn`).
  3. Place the **Search File Function naming the CSV** (`#csv-search-input`) and **custom DaisyUI + Alpine.js filter controls** (e.g., DaisyUI `select` dropdown, `join` segmented status buttons, `range` sliders, and `toggle`) directly **underneath** the Load CSV control.
  4. Render the **Grid.js** table (`#csv-gridjs-table`) underneath the search/filter panel, and the **Chart.js** visualization (`#csvChart`) **underneath the Grid.js table**, all updating in lockstep when searching or filtering.
- Design all components to fit cleanly across every Tailwind breakpoint (`sm`: 640px through `2xl`: 1536px) without horizontal scrollbars. Whenever an element develops a horizontal scrollbar (`scrollWidth > clientWidth`), `checkInsufficientHorizontalSpace()` marks it with `data-insufficient-space="true"` to indicate it does not have enough space.

### Step 4: Run the Mandatory Playwright Multi-Breakpoint Verification (and Multi-Theme PDFs if Static)
Before delivering the HTML report or its exported PDF to the user, run the Playwright verifier in `./playwright/`:

```bash
# For Interactive reports (verifies breakpoints, CDNs, themes, and PDF readiness warning):
node skills/html-report/playwright/verify-report.mjs <path-to-report.html> --mode interactive

# For Static / Print-First reports (verifies breakpoints, @media print rules, and exports 5 mock PDFs):
node skills/html-report/playwright/verify-report.mjs <path-to-report.html> --mode static --pdf <path-to-output.pdf>
```

The Playwright script checks:
1. Default theme is always `light` (`data-theme="light"`), content-aware favicon emoticon is present in `<head>`, and all 5 Tailwind CSS breakpoints (`sm`: 640px, `md`: 768px, `lg`: 1024px, `xl`: 1280px, `2xl`: 1536px) have zero page-level overflow and zero element-level horizontal scrollbars (reporting `"Element does not have enough space"` if any element has a horizontal scrollbar).
2. DaisyUI navbar layout: report title on the left (`navbar-start`) and `Contents` dropdown, 32-theme color-swatch dropdown, and icon-only Download dropdown (`#download-dropdown` with **Download as HTML** and **Download as PDF**) on the right (`navbar-end`).
3. If `--mode interactive`: verifies that the PDF download option indicates "Not PDF-Ready" and provides `#pdf-not-ready-modal` suggesting the conversion prompt to add print media queries, while skipping print media assertion overhead.
4. If `--mode static`: verifies `@media print` queries (`page.emulateMedia({ media: "print" })`), navbar hidden (`display: none`), Page 1 Cover (`#print-cover-page`) visible with report title + full `h1`/`h2`/`h3` TOC (`#print-toc-list`) and page break, interactive controls hidden, static print summary visible, and generates 5 mock PDFs across DaisyUI themes (`light`, `dark`, `cupcake`, `synthwave`, `nord`).
5. Live DaisyUI theme switching across `data-theme` and Chart.js / Mermaid color updates, restoring to `light`.
6. Self-contained CDN-inlining HTML Download (`window.buildInlinedHtmlSnapshot()`).
7. Zero console errors or uncaught page exceptions.

### Step 5: Auto-Open & Single-Tab Live-Reload Dev Server
When report generation is complete, launch the local live-reload dev server:

```bash
node skills/html-report/scripts/serve-report.mjs <path-to-report.html>
```

- **Auto-Open on Completion**: Automatically opens `http://localhost:3000/` in the user's browser.
- **Single-Tab Live-Reload & Deduplication**:
  - When the HTML file is updated while the browser tab is **already open**, the server broadcasts a Server-Sent Event (SSE) to reload the existing tab in place without launching redundant duplicate tabs.
  - When the HTML file is updated while the tab was **closed** (zero active tabs detected), the server automatically reopens the report in a single browser tab.
