# Design

## Context

This repository builds the LLM-agnostic `html-report` Agent Skill using OpenSpec (`v1.16.0`). See `proposal.md` for motivation. The skill equips any LLM agent to generate rich, interactive, publication-grade HTML reports using a comprehensive 11-library non-blocking CDN stack (Tailwind CSS, DaisyUI with all 32 themes, Lucide Icons, Alpine.js, Chart.js, Mermaid, Leaflet, Grid.js, KaTeX, Marked, Highlight.js), a sticky DaisyUI navigation bar (with the report title on the left in `navbar-start`, and the Table of Contents dropdown, DaisyUI color-swatch theme dropdown, and icon-only CDN-inlining HTML download button on the right in `navbar-end`), horizontal-scrollbar insufficient-space indication, strict visualization standards in a separate style guide, a complete `example.html` naming and demonstrating all 11 CDNs, and an automated Playwright verification suite that checks all Tailwind breakpoints before delivering a PDF or HTML report.

## Goals / Non-Goals

**Goals:**
- Ensure **zero blocking**: both at runtime (scripts use `defer`/async and isolated `try/catch` feature initializers so one library never blocks DOM rendering or another library) and in task execution.
- Enforce the **DaisyUI Navbar Layout**:
  - **Left (`navbar-start`)**: Report title (`#navbar-report-title`).
  - **Right (`navbar-end`)**: Contents (`h1`/`h2`/`h3`) TOC dropdown, DaisyUI 32-theme dropdown with **per-theme color scheme swatches** (matching the DaisyUI website), and an **icon-only Download button** (no visible download text).
- Synchronize **all 32 DaisyUI themes** with **Chart.js**, **Mermaid**, and CSS-styled components dynamically via computed CSS token resolution.
- Detect **horizontal scrollbars on any element** (`el.scrollWidth > el.clientWidth + 1`) both visually in the browser (`data-insufficient-space="true"` indicator badge) and in Playwright across all 5 Tailwind breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`) to indicate when an element does not have enough space.
- Showcase all **11 CDNs by name and with live examples** in `skills/html-report/examples/example.html`.

**Non-Goals:**
- Requiring a bundler (Webpack/Vite) to author a report — every generated `.html` file remains a standalone file runnable directly in a browser or via Playwright.

## Decisions

### Decision 1: 11-Library Non-Blocking CDN Stack & Defensive Initialization
- **Choice**:
  - **Stylesheets (`<head>`)**: DaisyUI v4 full (`full.min.css`), Leaflet CSS (`leaflet.css`), Highlight.js CSS (`github-dark.min.css`), Grid.js CSS (`mermaid.min.css`), and KaTeX CSS (`katex.min.css`).
  - **Scripts (`defer`)**: Tailwind Play CDN, Lucide UMD (`lucide.min.js`), Alpine.js (`cdn.min.js`), Chart.js UMD (`chart.umd.min.js`), Mermaid UMD (`mermaid.min.js`), Leaflet JS (`leaflet.js`), Grid.js UMD (`gridjs.umd.js`), KaTeX JS (`katex.min.js` + `auto-render.min.js`), Marked (`marked.min.js`), and Highlight.js (`highlight.min.js`).
- **Rationale**: All 11 libraries use CORS-friendly CDNs (`cdn.jsdelivr.net`, `unpkg.com`, `cdnjs.cloudflare.com`) and UMD/standalone builds so they load non-blockingly and can be fetched and inlined cleanly by the icon-only Download button.

### Decision 2: Swapped DaisyUI Navbar Layout, Color-Swatch Theme Menu & Icon-Only Download
- **Choice**:
  - **`navbar-start` (Left)**: Displays the report title (`#navbar-report-title`).
  - **`navbar-end` (Right)**:
    1. **Contents Dropdown (`#toc-dropdown`)**: Lists all `h1`, `h2`, and `h3` headings linked via `href="#<id>"`.
    2. **DaisyUI Color-Swatch Theme Dropdown (`#theme-dropdown`)**: Renders all 32 DaisyUI themes as interactive items where each item carries `data-theme="<theme>"` on a `bg-base-100 text-base-content` preview row containing the theme name and 4 color swatch pills (`bg-primary`, `bg-secondary`, `bg-accent`, `bg-neutral`), matching the official DaisyUI website's theme picker.
    3. **Icon-Only Download Button (`#download-html-btn`)**: Uses `btn btn-primary btn-sm btn-square` with only a download SVG/Lucide icon (`aria-label="Download HTML"`, no visible text).

### Decision 3: Element-Level Horizontal Scrollbar ("Insufficient Space") Detection
- **Choice**:
  1. Include a runtime `checkInsufficientHorizontalSpace()` observer in the report template that inspects elements inside `<main>` on load and resize: if any element has a horizontal scrollbar (`el.scrollWidth > el.clientWidth + 1` and `getComputedStyle(el).overflowX !== 'visible'`), it sets `el.setAttribute('data-insufficient-space', 'true')` and displays a visual warning outline/badge indicating `"Insufficient horizontal space (horizontal scrollbar active)"`.
  2. In `playwright/verify-report.mjs`, at every Tailwind breakpoint (`sm`: 640px, `md`: 768px, `lg`: 1024px, `xl`: 1280px, `2xl`: 1536px), scan both the document and every visible element inside `<main>` for horizontal scrollbars (`el.scrollWidth > el.clientWidth + 1`). If any element has a horizontal scrollbar, report specifically that the element **does not have enough space** at that breakpoint.

### Decision 4: CSV-Driven Report Highlight, File Search Control & Grid.js/Alpine.js Binding
- **Choice**:
  - When a report or section is built from a CSV file (such as `skills/html-report/examples/example.csv`), include:
    1. A visual **CSV Source Highlight Banner** (`data-csv-highlight="true"`) displaying the CSV filename (`example.csv`), column headers, and row count.
    2. An interactive **CSV Search & File Loader Form** featuring a search input (`Search in example.csv...`), a file input / reload button referencing `example.csv`, and **Alpine.js** reactive filter actions (status filter pills, live matching row count, average metric calculation, and raw CSV source viewer).
    3. Automatic **Grid.js** synchronization (`renderCsvGrid(filteredRows)`) so searching, filtering via Alpine.js actions, or selecting a `.csv` file immediately updates the Grid.js table.
  - Embed the raw CSV text in `<script id="embedded-csv-source" data-csv-name="example.csv" type="text/csv">` (in addition to shipping `examples/example.csv` alongside `example.html`) so the CSV showcase works both on `file://` without CORS errors and when loading `./example.csv` or any user-selected `.csv` file.

## Risks / Trade-offs

- **[Risk] KaTeX CSS relative font URLs when inlining CSS for Download** → Mitigation: In `buildInlinedHtmlSnapshot()`, rewrite any relative `url(fonts/...)` inside inlined stylesheets to absolute CDN URLs (`new URL(relUrl, href).href`) so downloaded standalone HTML files load KaTeX math fonts without broken relative paths.
- **[Risk] Wide tables or Mermaid diagrams causing horizontal scrollbars on `sm` (640px)** → Mitigation: Design `example.html` tables, Grid.js columns, Mermaid flowcharts, and code blocks with compact responsive sizing (`text-xs sm:text-sm`, wrapping cells, and concise labels) so zero elements trigger a horizontal scrollbar even at `640px` (`sm`).
