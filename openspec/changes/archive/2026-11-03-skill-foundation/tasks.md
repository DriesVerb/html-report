# Tasks

Tasks are ordered by priority (**P0 → P1 → P2**) and structured so independent workstreams do not block each other.

## 1. [P0] Skill Packaging & Non-Blocking Directory Scaffolding

- [x] 1.1 Create `skills/html-report/`, `skills/html-report/references/`, `skills/html-report/examples/`, and `skills/html-report/playwright/` directories and verify all directories exist.
- [x] 1.2 Create the relative symlink `.agents/skills/html-report` pointing to `../../skills/html-report` and verify `readlink -f .agents/skills/html-report` resolves to `/home/eta/projects/html-report/skills/html-report`.
- [x] 1.3 Update the repository `README.md` documenting all 11 CDNs (Tailwind CSS, DaisyUI, Lucide, Alpine.js, Chart.js, Mermaid, Leaflet, Grid.js, KaTeX, Marked, Highlight.js), the swapped navbar layout, color-swatch theme dropdown, icon-only download button, insufficient-space detection, and Playwright verification command.

## 2. [P1] Non-Blocking 11-Library CDN Stack Integration

- [x] 2.1 Configure non-blocking **Tailwind CSS** and **DaisyUI** (full components + all 32 DaisyUI themes stylesheet) CDN loading in `skills/html-report/references/architecture-and-styling.md` and `skills/html-report/examples/example.html`.
- [x] 2.2 Configure non-blocking (`defer`) **Leaflet** CDN (CSS + JS) for geospatial maps with isolated initialization guards.
- [x] 2.3 Configure non-blocking (`defer`) **Chart.js** and **Mermaid** CDNs for charts and diagrams with isolated initialization guards.
- [x] 2.4 Configure non-blocking (`defer`) **Marked** (Markdown CDN) and **Highlight.js** (code formatting CDN) with isolated initialization guards.
- [x] 2.5 Configure non-blocking (`defer`) **Lucide Icons** CDN, **KaTeX** CDN (CSS + JS + auto-render for math expressions), **Grid.js** CDN (CSS + JS for interactive sortable/searchable tables), and **Alpine.js** CDN (reactive UI directives) in `references/architecture-and-styling.md` and `examples/example.html`, verifying all 11 CDNs initialize without blocking.

## 3. [P1] Swapped DaisyUI Navbar, Color-Swatch Theme Dropdown, Icon-Only Download & Insufficient-Space Indicator

- [x] 3.1 Swap the sticky **DaisyUI navbar** layout so the **report title is on the left (`navbar-start`)** and the **Contents TOC dropdown, Theme dropdown, and Download button are on the right (`navbar-end`)**, verifying left/right coordinates via Playwright.
- [x] 3.2 Implement the navbar **Contents dropdown menu** that maps all `h1`, `h2`, and `h3` headings and links to their `#id` attributes, verifying all `h1`/`h2`/`h3` headings have valid IDs and TOC links.
- [x] 3.3 Upgrade the navbar **DaisyUI Theme Dropdown** so each of the **32 DaisyUI themes** renders a visual **color scheme preview** (`data-theme="<theme>"` row showing `bg-base-100`, `text-base-content`, and `bg-primary`, `bg-secondary`, `bg-accent`, `bg-neutral` swatches, matching the DaisyUI website) while dynamically synchronizing **Chart.js** charts, **Mermaid** diagrams, and CSS-driven theme components.
- [x] 3.4 Update the navbar **Download button** (`#download-html-btn`) to be **icon-only (no visible download text)** while fetching and embedding **all 11 external CDN stylesheets and scripts inline** into the downloaded `.html` report.
- [x] 3.5 Implement **Horizontal Scrollbar / Insufficient-Space Indication** in both the HTML runtime (`checkInsufficientHorizontalSpace()` marking any element where `scrollWidth > clientWidth` with a visible `"Insufficient space"` indicator) and `playwright/verify-report.mjs` across all 5 Tailwind breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`).

## 4. [P1] Dedicated Charts & Mermaid Style Guide & Main `SKILL.md` Entry Point

- [x] 4.1 Create the separate **Charts & Mermaid Style Guide** (`skills/html-report/references/charts-and-mermaid-style-guide.md`) giving extra focus to Chart.js and Mermaid standards (responsive fixed-height containers, DaisyUI CSS theme variable resolution via `resolveDaisyUIThemePalette()`, typography/legend rules, and print/PDF resize stability).
- [x] 4.2 Update `skills/html-report/SKILL.md` to reflect the 11-CDN stack, swapped DaisyUI navbar (left title, right TOC + color-swatch theme dropdown + icon-only download button), and horizontal-scrollbar insufficient-space checks.

## 5. [P2] Full-Featured Showcase `example.html` (All 11 CDN Names + Examples) & Playwright Verifier

- [x] 5.1 Update `skills/html-report/examples/example.html` to explicitly list the names of all 11 CDNs (**Tailwind CSS**, **DaisyUI**, **Lucide Icons**, **Alpine.js**, **Chart.js**, **Mermaid**, **Leaflet**, **Grid.js**, **KaTeX**, **Marked**, **Highlight.js**) and include live working examples for every single CDN, with zero element-level horizontal scrollbars across all 5 Tailwind breakpoints (`sm`–`2xl`).
- [x] 5.2 Update `skills/html-report/playwright/verify-report.mjs` to check across all 5 Tailwind breakpoints (`sm`: 640px, `md`: 768px, `lg`: 1024px, `xl`: 1280px, `2xl`: 1536px) that no element has a horizontal scrollbar (reporting `"Element does not have enough space"` if `scrollWidth > clientWidth`), verify the swapped navbar layout (title on left, TOC/theme/icon-only download on right), verify all 32 theme color-swatch previews, verify all 11 CDN names and live examples, and verify PDF export.
- [x] 5.3 Refocus `skills/html-report/examples/example.html` as a pure **11-CDN Interactive Showcase** (rather than a fake business report) where all 11 CDN cards in Section 1.1 are clickable anchor links (`<a href="#...">`) jumping directly to their respective live showcase sections, and simplify the `<footer>` so it is centered in the middle and says only `"generated by html-report"`.
- [x] 5.4 Fix **Grid.js** dark-mode readability across all dark DaisyUI themes (`dark`, `dracula`, `synthwave`, `night`, `dim`, etc.) by binding Grid.js table surfaces, headers, cells, search input, and pagination controls to the active DaisyUI theme palette variables, and verify dark-mode contrast in Playwright.
- [x] 5.5 Update **Highlight.js** showcase to feature two explicit language examples side by side — **TypeScript** for the **"Frontend"** and **Kotlin** for the **"Backend"** — explicitly naming both languages and verifying syntax highlight spans for both.
- [x] 5.6 Fix **Leaflet** 403 / API-key placeholder tile issues on local `file://` origins by switching to Esri ArcGIS World Street Map (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}`), and verify visually and via Playwright that all map tiles render cleanly on `file://` without API keys or 403 blocks.
- [x] 5.7 Create `skills/html-report/examples/example.csv` and document CSV-backed report rules in `skills/html-report/SKILL.md` and `skills/html-report/references/architecture-and-styling.md` (requiring a highlighted CSV source banner, a search/file control naming the CSV file, and synchronized **Alpine.js** + **Grid.js** actions).
- [x] 5.8 Add a dedicated **CSV-Driven Interactive Showcase Section** at the bottom of `skills/html-report/examples/example.html` built around `example.csv` (highlighting `example.csv` as the source, providing a search/file function with the name `example.csv`, and triggering live **Alpine.js** filter/metric actions and **Grid.js** table updates), and verify it across all 5 Tailwind breakpoints in `playwright/verify-report.mjs`.
- [x] 5.9 Set the default DaisyUI theme to `light` (`<html data-theme="light">`) across `example.html`, `index.html`, and skill documentation (replacing `corporate` as the default).
- [x] 5.10 Convert the navbar icon-only Download button into an icon-only **Download Dropdown** (`#download-dropdown` / `#download-dropdown-btn`) with two menu options: **Download as HTML** (`#download-html-btn`, standalone inlined CDNs) and **Download as PDF** (`#download-pdf-btn`, triggering print/PDF export).
- [x] 5.11 Add comprehensive `@media print` CSS and a dedicated **Print / PDF Page 1 Cover + Heading Table of Contents** (`#print-cover-page` with `#print-cover-title` and `#print-toc-list` mapping all `h1`, `h2`, `h3` headings, `break-after: page`) while hiding the navbar and interactive-only controls in print mode and showing static print fallbacks (including pre-populating the CSV table/chart for print if empty).
- [x] 5.12 Update `skills/html-report/playwright/verify-report.mjs` to verify `@media print` queries (navbar hidden, Page 1 cover title + `h1`/`h2`/`h3` TOC visible, interactive-only controls hidden) and generate + verify **5 mock PDFs in 5 different DaisyUI themes** (`light`, `dark`, `cupcake`, `synthwave`, `nord`) in `skills/html-report/examples/mock-pdfs/`.

## 6. [P2] Interactive vs. Static Mode Discrimination & Conditional PDF Readiness

- [x] 6.1 Prompt & Mode Clarification: Update the skill workflow (`SKILL.md` Step 1) so the agent asks the user or clearly indicates upfront whether the report is **Interactive** (rich client-side UI, dynamic filtering, tabs, widget interaction) or **Static** (print-first, publication-grade document designed for physical print or PDF export).
- [x] 6.2 Conditional Print Media Queries & PDF Readiness: Restrict the creation of `@media print` queries, Page 1 print cover + H1/H2/H3 TOC (`#print-cover-page`), static print fallback views, and Playwright `@media print` + multi-theme PDF verification to **Static** reports ONLY, preventing unnecessary focus and development overhead on print queries when an interactive dashboard is desired.
- [x] 6.3 Interactive Mode Navbar Dropdown PDF Warning & Conversion Prompt: When a report is generated in **Interactive Mode**, configure the navbar Download Dropdown's PDF option to indicate that the report is not PDF-ready (e.g., marked as "Not PDF Ready (Interactive Mode)") and present a suggested prompt (e.g., `"Convert this interactive HTML report into a print/PDF-ready publication report with @media print queries, static fallbacks, and Page 1 TOC"`) to focus on the media print query when the user wants to convert it.
- [x] 6.4 Verifier & Skill Guideline Updates: Add mode flags (e.g., `--mode interactive` vs `--mode static`) to `verify-report.mjs` and document the mode selection logic in `SKILL.md` and `references/architecture-and-styling.md`, ensuring interactive reports are verified for breakpoints, CDNs, and themes without failing on print-specific media query assertions.

## 7. [P2] Content-Aware Favicon Emoticon

- [x] 7.1 Content-Aware Favicon Emoticon: Each generated HTML report SHALL include a `<link rel="icon" ...>` featuring an emoji/emoticon favicon embedded as an SVG data URI (e.g., `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📊</text></svg>`) that matches the content and subject matter of the file (e.g., 📊 for metrics/analytics, 🗺️ for geospatial/maps, ⚡ for performance, 🧪 for testing/experiments, 💻 for code/technical reports), requiring zero external image file assets.

## 8. [P2] Post-Generation Auto-Open & Single-Tab Live-Reload Sync

- [x] 8.1 Auto-Open on Completion: When report generation is complete, the skill SHALL automatically open the generated HTML report in the browser (e.g., via a lightweight local server / live-reload watcher or system browser opener).
- [x] 8.2 Single-Tab Live-Reload & Tab Deduplication: When the HTML report file is updated:
  - If the report is **currently not open** in a browser tab, it SHALL automatically reopen in a single browser tab.
  - If the report is **already open in an existing browser tab**, it SHALL automatically refresh / live-reload that existing tab in place rather than launching redundant duplicate tabs.

## Workflow follow-up

- Run `openspec validate skill-foundation --strict` to confirm all updated specs and change artifacts pass strict validation.
- Archive or sync the `skill-foundation` change after implementation and Playwright breakpoint + PDF verification pass.
