---
name: html-report
description: >-
  Generates publication-grade, interactive, and print-ready HTML5 reports with a
  non-blocking 11-library CDN stack (Tailwind CSS, DaisyUI with all 32 themes,
  Lucide Icons, Alpine.js, Chart.js, Mermaid, Leaflet maps, Grid.js tables,
  KaTeX math, Marked markdown, and Highlight.js code formatting), a sticky
  DaisyUI navbar (left-aligned report title, right-aligned Table of Contents
  dropdown mapping h1/h2/h3 IDs, DaisyUI color-swatch theme dropdown synced to
  charts/diagrams, and icon-only self-contained CDN-inlining HTML download
  button), horizontal-scrollbar insufficient-space detection, and Playwright
  multi-breakpoint pre-PDF verification. Use when the user asks to create,
  design, or export an HTML report, dashboard report, or PDF-backed HTML summary.
---

# HTML Report Generation Skill (`html-report`)

This skill guides the creation of rich, responsive, theme-adaptive, and print/PDF-verified HTML5 reports. Every report is a single `.html` file powered by a non-blocking 11-library CDN stack and verified across all Tailwind CSS breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`) using Playwright before delivery.

---

## Progressive Disclosure Reference Files

Before writing any HTML report, read the relevant reference guides in this skill directory:

1. **[Architecture, 11-CDN Stack & DaisyUI Navbar Blueprint](./references/architecture-and-styling.md)** *(Required for all reports)*:
   - Exact CDN links (`Tailwind CSS`, `DaisyUI v4 full + all 32 themes`, `Lucide Icons`, `Alpine.js`, `Chart.js`, `Mermaid`, `Leaflet`, `Grid.js`, `KaTeX`, `Marked`, `Highlight.js`) with `defer` non-blocking loading.
   - Sticky **DaisyUI Navbar** structure:
     - **Left (`navbar-start`)**: Report Title (`#navbar-report-title`).
     - **Right (`navbar-end`)**: `Contents` dropdown mapping `h1`/`h2`/`h3` `#id` links, **DaisyUI 32-Theme Dropdown** where each theme option displays its color scheme swatches (`bg-primary`, `bg-secondary`, `bg-accent`, `bg-neutral` inside `data-theme="<theme>"`), and an **icon-only Download button** (`#download-html-btn`, no visible text) that inlines all external CDNs.
   - **Horizontal Scrollbar / Insufficient-Space Detector**: Indicates whenever any element has a horizontal scrollbar (`scrollWidth > clientWidth`) that it does not have enough space.
2. **[Charts (Chart.js) & Diagrams (Mermaid) Dedicated Style Guide](./references/charts-and-mermaid-style-guide.md)** *(Required whenever a report contains charts or Mermaid diagrams)*:
   - Universal DaisyUI theme color resolver (`resolveDaisyUIThemePalette()`) that converts active `data-theme` colors into `#rrggbb` and `rgba(...)` values.
   - Dynamic re-theming for **Chart.js** canvases and **Mermaid** SVG diagrams when switching across any of the 32 DaisyUI themes.
   - Fixed-height responsive containers (`h-72 sm:h-80`) and print/PDF resize hooks.
3. **[Full-Featured Showcase Example (`example.html`)](./examples/example.html)**:
   - Complete working reference implementation explicitly listing the names of all 11 CDNs and demonstrating live examples of each.

---

## Step-by-Step Workflow

### Step 1: Plan the Document Hierarchy & Heading IDs
- Structure the report inside `<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">`.
- Assign every `<h1>`, `<h2>`, and `<h3>` element a unique, descriptive `id` attribute (e.g., `<h2 id="executive-summary" class="scroll-mt-20 ...">`) so the navbar **Contents** dropdown links directly to every section.
- Start `<main>` with a high-impact Hero / Executive Summary and DaisyUI `stats` KPI overview before diving into detailed sections.

### Step 2: Assemble the Non-Blocking 11-CDN Stack & Swapped DaisyUI Navbar
- Follow **[architecture-and-styling.md](./references/architecture-and-styling.md)** to include the non-blocking CDN tags (`defer`) and the sticky DaisyUI `navbar`:
  - **Left (`navbar-start`)**:
    - The **Report Title** (`#navbar-report-title`) aligned to the left.
  - **Right (`navbar-end`)**:
    1. **Contents Dropdown (`#toc-dropdown`)** mapping all `h1`, `h2`, and `h3` headings via `#id` anchors.
    2. **DaisyUI Theme Dropdown (`#theme-dropdown`)** populated with all 32 DaisyUI themes, where each item previews its color scheme swatches (`bg-primary`, `bg-secondary`, `bg-accent`, `bg-neutral`) and updates `<html data-theme="...">`, Chart.js instances, Mermaid diagrams, and CSS components.
    3. **Icon-Only Download Button (`#download-html-btn`)** with a download icon and `aria-label="Download HTML"` (no text label), wired to `window.buildInlinedHtmlSnapshot()` so clicking it fetches and embeds all external CDN stylesheets and scripts directly into the downloaded `.html` file.

### Step 3: Build Visuals, Maps, Tables, Math, Markdown, Code & CSV-Driven Controls with Zero Horizontal Scrollbars
- Initialize each subsystem (`initMarkdown()`, `initTOC()`, `initThemeDropdown()`, `initDownloadButton()`, `initLucide()`, `initKaTeX()`, `initGridJs()`, `initCsvShowcase()`, `initCodeHighlight()`, `initCharts()`, `initMermaid()`, `initMaps()`, `checkInsufficientHorizontalSpace()`) inside independent `try / catch` and feature-detection guards.
- **CSV-Driven HTML Reports**: Whenever an HTML report or form is built on the basis of a `.csv` file (such as `examples/example.csv`):
  1. Visually **highlight** that the form/section is built around that CSV file (`data-csv-highlight="true"` banner + badge showing the CSV filename).
  2. Start the CSV workspace **completely empty** (`csvLoaded: false`) until the **Load CSV** control at the top loads the CSV file (`#csv-file-input` or `#load-example-csv-btn`).
  3. Place the **Search File Function naming the CSV** (`#csv-search-input`) and **custom DaisyUI + Alpine.js filter controls** (e.g., DaisyUI `select` dropdown, `join` segmented status buttons, `range` sliders, and `toggle`) directly **underneath** the Load CSV control.
  4. Render the **Grid.js** table (`#csv-gridjs-table`) underneath the search/filter panel, and the **Chart.js** visualization (`#csvChart`) **underneath the Grid.js table**, all updating in lockstep when searching or filtering.
- Design all components to fit cleanly across every Tailwind breakpoint (`sm`: 640px through `2xl`: 1536px) without horizontal scrollbars. Whenever an element develops a horizontal scrollbar (`scrollWidth > clientWidth`), `checkInsufficientHorizontalSpace()` marks it with `data-insufficient-space="true"` to indicate it does not have enough space.

### Step 4: Run the Mandatory Playwright Multi-Breakpoint & Pre-PDF Verification
Before delivering the HTML report or its exported PDF to the user, run the Playwright verifier in `./playwright/`:

```bash
node skills/html-report/playwright/verify-report.mjs <path-to-report.html> --pdf <path-to-output.pdf>
```

The Playwright script checks:
1. All 5 Tailwind CSS breakpoints (`sm`: 640px, `md`: 768px, `lg`: 1024px, `xl`: 1280px, `2xl`: 1536px) for both page-level overflow and element-level horizontal scrollbars (reporting `"Element does not have enough space"` if any element has a horizontal scrollbar).
2. DaisyUI navbar layout: report title on the left (`navbar-start`) and `Contents` dropdown, 32-theme color-swatch dropdown, and icon-only download button on the right (`navbar-end`).
3. Live DaisyUI theme switching across `data-theme` and Chart.js / Mermaid color updates.
4. Self-contained CDN-inlining Download button (`window.buildInlinedHtmlSnapshot()`).
5. Zero console errors or uncaught page exceptions, plus clean PDF generation.
