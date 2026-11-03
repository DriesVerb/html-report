# HTML Report Architecture, 11-CDN Stack & DaisyUI Navbar Blueprint

This reference defines the mandatory document skeleton, non-blocking 11-library CDN stack, swapped DaisyUI navbar structure (left-aligned report title; right-aligned TOC dropdown, DaisyUI color-swatch theme dropdown, and icon-only CDN-inlining Download button), horizontal-scrollbar insufficient-space detector, and print/PDF media resilience rules for the `html-report` skill.

---

## 1. Non-Blocking 11-Library CDN Stack

Every report MUST include the following 11-library CDN stack. Scripts use `defer` and isolated initialization guards so that a slow or unused library never blocks initial HTML rendering or other widgets.

| # | CDN Name | Purpose |
| :--- | :--- | :--- |
| 1 | **Tailwind CSS** | Utility-first responsive layout and breakpoint system (`sm`–`2xl`) |
| 2 | **DaisyUI** | Semantic component classes and all 32 built-in themes (`data-theme`) |
| 3 | **Lucide Icons** | Crisp vector icons (`data-lucide="..."`) |
| 4 | **Alpine.js** | Lightweight declarative UI interactivity (`x-data`, `x-show`, `@click`) |
| 5 | **Chart.js** | Interactive canvas charts dynamically synced with DaisyUI themes |
| 6 | **Mermaid** | Architecture & workflow SVG diagrams dynamically synced with DaisyUI themes |
| 7 | **Leaflet** | Interactive geospatial maps and markers |
| 8 | **Grid.js** | Interactive sortable, searchable, and paginated data tables |
| 9 | **KaTeX** | Fast scientific math and LaTeX equation rendering |
| 10 | **Marked** | Client-side Markdown prose parsing |
| 11 | **Highlight.js** | Syntax-highlighted code blocks |

```html
<!-- 1. Stylesheets (DaisyUI v4 full + all 32 themes, Leaflet, Highlight.js, Grid.js, KaTeX) -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/daisyui@4.12.14/dist/full.min.css" crossorigin="anonymous" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="anonymous" />
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/github-dark.min.css" crossorigin="anonymous" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gridjs@6.0.6/dist/theme/mermaid.min.css" crossorigin="anonymous" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous" />

<!-- 2. Tailwind CSS Play CDN -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- 3. Non-Blocking Feature Scripts (defer) -->
<script defer src="https://cdn.jsdelivr.net/npm/lucide@0.460.0/dist/umd/lucide.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/chart.js@4.4.6/dist/chart.umd.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/mermaid@11.4.0/dist/mermaid.min.js" crossorigin="anonymous"></script>
<script defer src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/gridjs@6.0.6/dist/gridjs.umd.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/marked@14.1.3/marked.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/highlight.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/languages/kotlin.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js" crossorigin="anonymous"></script>
```

> **Content-Aware Favicon Emoticon Rule**: Every report MUST include an inline SVG emoji favicon in `<head>` matching its content (requiring zero external assets):
> ```html
> <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📊</text></svg>" />
> ```
>
> **Interactive Mode vs. Static Mode Rule**:
> - **Interactive Mode** (`data-report-mode="interactive"`): For interactive dashboards with filters, tabs, dynamic charts, and file inputs. Do NOT add print queries or spend time focusing on PDF readiness. In the navbar Download Dropdown, the PDF button displays `"Not PDF-Ready"` and opens `#pdf-not-ready-modal` suggesting the conversion prompt:
>   `Convert this interactive HTML report into a print/PDF-ready publication report with @media print queries, static fallbacks, and Page 1 TOC`
> - **Static Mode** (`data-report-mode="static"`): ONLY when the report is static / print-first should you include `@media print` rules, Page 1 TOC (`#print-cover-page`), static print fallbacks, and run multi-theme PDF verification.
>
> **Leaflet Tile Server Rule (`file://` 403 & API-Key Placeholder Prevention)**: Never use `tile.openstreetmap.org` (which returns `403 Access Blocked` on `file://` origins without a `Referer` header) or `basemaps.cartocdn.com` (which returns an `"API KEY REQUIRED"` placeholder tile when opened from `file://`). Always use Esri ArcGIS World Street Map tiles (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}`), which render full map tiles on `file://` origins with no API key and no Referer restriction.
>
> **Footer Rule**: Every report footer MUST be centered in the middle and contain only `"generated by html-report"`:
> ```html
> <footer class="border-t border-base-300 bg-base-100 py-6 mt-12 text-center text-xs opacity-75">
>   generated by <a href="https://github.com/DriesVerb/html-report" target="_blank" rel="noopener noreferrer" class="link link-hover font-semibold">html-report</a>
> </footer>
> ```

---

## 2. Sticky DaisyUI Navbar Contract (Left Title + Right Controls) & Default `light` Theme

Every HTML report MUST start with `<html lang="en" data-theme="light" data-report-mode="interactive" class="scroll-smooth">` (or `data-report-mode="static"`, default theme is **always `light`**, never `corporate`) and start its `<body>` with a sticky DaisyUI `navbar` (`print:hidden`) that enforces this exact layout:

1. **Left (`navbar-start`)**:
   - **Report Title (`#navbar-report-title`)**: Displays the title of the report aligned to the left.
2. **Right (`navbar-end`)**:
   - **Contents Dropdown (`#toc-dropdown`)**: Maps every `h1`, `h2`, and `h3` in `<main>` via anchor links (`href="#heading-id"`).
   - **DaisyUI Color-Swatch Theme Dropdown (`#theme-dropdown`)**: Displays all 32 built-in DaisyUI themes (defaulting to `light`) where **each theme option renders its own color scheme preview** (`data-theme="<theme>"` with `bg-base-100`, `text-base-content`, and 4 swatch pills `bg-primary`, `bg-secondary`, `bg-accent`, `bg-neutral`), identical to the official DaisyUI website, and dynamically updates CSS variables, **Chart.js** charts, and **Mermaid** diagrams.
   - **Icon-Only Download Dropdown (`#download-dropdown`)**: An icon-only trigger button (`#download-dropdown-btn`, `btn-square`, no visible download text) that opens a dropdown menu (`#download-dropdown-menu`) with two options:
     1. **Download as HTML (`#download-html-btn`)**: Downloads the complete HTML report with all external CDN stylesheets and scripts fetched and embedded inline.
     2. **Download as PDF (`#download-pdf-btn`)**: Calls `window.exportReportPdf()` (resizes charts/maps and triggers `window.print()` with `@media print` styling).

### Complete Navbar HTML Blueprint

```html
<header class="sticky top-0 z-50 bg-base-100/95 backdrop-blur border-b border-base-300 print:hidden">
  <nav class="navbar max-w-7xl mx-auto px-3 sm:px-6 gap-2 min-h-14" aria-label="Report Navigation">
    <!-- Left (navbar-start): Report Title -->
    <div class="navbar-start w-auto flex-1 min-w-0 justify-start">
      <span id="navbar-report-title" class="text-xs sm:text-sm md:text-base lg:text-lg font-bold tracking-tight text-left truncate">
        Report Title
      </span>
    </div>

    <!-- Right (navbar-end): Contents TOC Dropdown + DaisyUI Color-Swatch Theme Dropdown + Icon-Only Download Dropdown -->
    <div class="navbar-end w-auto flex-shrink-0 gap-1.5 sm:gap-2 justify-end">
      <!-- 1. TOC Dropdown mapping h1, h2, h3 -->
      <div class="dropdown dropdown-end" id="toc-dropdown">
        <div tabindex="0" role="button" id="toc-dropdown-btn" class="btn btn-xs sm:btn-sm btn-ghost border border-base-300 gap-1.5" aria-label="Table of Contents">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          <span>Contents</span>
        </div>
        <ul id="report-toc-list" tabindex="0" class="dropdown-content menu menu-sm bg-base-100 rounded-box z-[60] mt-2 w-72 sm:w-80 max-h-[70vh] overflow-y-auto p-2 shadow-xl border border-base-300 flex-nowrap">
          <!-- Populated automatically from h1, h2, h3 headings -->
        </ul>
      </div>

      <!-- 2. DaisyUI 32-Themes Dropdown with Official Color-Scheme Swatches -->
      <div class="dropdown dropdown-end" id="theme-dropdown">
        <div tabindex="0" role="button" id="theme-dropdown-btn" class="btn btn-xs sm:btn-sm btn-ghost border border-base-300 gap-1.5" aria-label="Change DaisyUI Theme">
          <span class="text-xs font-medium capitalize" id="active-theme-label">light</span>
          <div class="flex items-center gap-0.5">
            <span class="bg-primary rounded-badge w-1.5 h-3"></span>
            <span class="bg-secondary rounded-badge w-1.5 h-3"></span>
            <span class="bg-accent rounded-badge w-1.5 h-3"></span>
            <span class="bg-neutral rounded-badge w-1.5 h-3"></span>
          </div>
        </div>
        <div tabindex="0" class="dropdown-content bg-base-200 text-base-content rounded-box z-[60] mt-2 w-56 max-h-96 overflow-y-auto p-2 shadow-2xl border border-base-300">
          <div id="theme-swatch-list" class="grid grid-cols-1 gap-1.5">
            <!-- Populated with 32 DaisyUI theme preview cards (data-theme="<name>" + 4 color pills) -->
          </div>
        </div>
      </div>

      <!-- 3. Icon-Only Download Dropdown (Download as HTML or Download as PDF) -->
      <div class="dropdown dropdown-end" id="download-dropdown">
        <div id="download-dropdown-btn" tabindex="0" role="button" class="btn btn-primary btn-xs sm:btn-sm btn-square" aria-label="Download Report (HTML or PDF)" title="Download Report (HTML or PDF)">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M7 10l5 5m0 0l5-5m-5 5V4" />
          </svg>
        </div>
        <ul id="download-dropdown-menu" tabindex="0" class="dropdown-content menu menu-sm bg-base-100 text-base-content rounded-box z-[60] mt-2 w-56 p-2 shadow-2xl border border-base-300">
          <li>
            <button id="download-html-btn" type="button" class="flex items-center gap-2.5 py-2 text-xs font-semibold">
              <span>Download as HTML</span>
            </button>
          </li>
          <li>
            <button id="download-pdf-btn" type="button" class="flex items-center gap-2.5 py-2 text-xs font-semibold">
              <span>Download as PDF</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </nav>
</header>
```

---

## 3. DaisyUI Color-Swatch Theme Picker Blueprint

Each of the 32 DaisyUI themes in `#theme-swatch-list` MUST render a button with `data-theme="<theme>"` so DaisyUI paints the row in that theme's exact `bg-base-100` background, `text-base-content` text, and 4 color swatch bars (`bg-primary`, `bg-secondary`, `bg-accent`, `bg-neutral`), matching the official DaisyUI website:

```javascript
function initThemeDropdown() {
  const listEl = document.getElementById("theme-swatch-list");
  if (!listEl) return;
  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  listEl.innerHTML = "";

  DAISYUI_THEMES.forEach((theme) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-theme", theme);
    btn.setAttribute("data-set-theme", theme);
    btn.className = "theme-swatch-item outline-base-content text-start outline-offset-4 rounded-btn w-full cursor-pointer font-sans";
    btn.innerHTML = `
      <span class="bg-base-100 rounded-btn text-base-content block w-full cursor-pointer font-sans border border-base-300 hover:border-primary transition">
        <span class="grid grid-cols-5 grid-rows-3">
          <span class="col-span-5 row-span-3 row-start-1 flex items-center gap-2 px-3 py-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="theme-check h-3.5 w-3.5 shrink-0 ${theme === currentTheme ? "opacity-100" : "opacity-0"}">
              <path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"></path>
            </svg>
            <span class="flex-grow text-xs font-semibold capitalize">${theme}</span>
            <span class="flex h-full shrink-0 flex-wrap gap-1" data-swatch-preview="${theme}">
              <span class="bg-primary rounded-badge w-2 h-4"></span>
              <span class="bg-secondary rounded-badge w-2 h-4"></span>
              <span class="bg-accent rounded-badge w-2 h-4"></span>
              <span class="bg-neutral rounded-badge w-2 h-4"></span>
            </span>
          </span>
        </span>
      </span>
    `;
    btn.addEventListener("click", () => window.setReportTheme(theme));
    listEl.appendChild(btn);
  });
}
```

---

## 4. Horizontal Scrollbar ("Insufficient Space") Detection

Whenever any element in `<main>` develops a horizontal scrollbar (`el.scrollWidth > el.clientWidth + 1`), the report MUST indicate that the element does not have enough horizontal space.

1. **CSS Indicator**:
   ```css
   [data-insufficient-space="true"] {
     outline: 2px dashed oklch(var(--wa, 0.8 0.15 80)) !important;
     position: relative;
   }
   [data-insufficient-space="true"]::before {
     content: "⚠ Insufficient horizontal space (horizontal scrollbar active)";
     display: block;
     font-size: 0.7rem;
     font-weight: 700;
     padding: 0.2rem 0.5rem;
     background: #f59e0b;
     color: #111827;
     border-radius: 0.25rem;
     margin-bottom: 0.25rem;
   }
   ```
2. **Runtime Detector (`window.checkInsufficientHorizontalSpace()`)**:
   ```javascript
   window.checkInsufficientHorizontalSpace = function checkInsufficientHorizontalSpace() {
     const mainEl = document.querySelector("main");
     if (!mainEl) return [];
     const insufficient = [];
     const candidates = mainEl.querySelectorAll("section, div, pre, table, .card, .overflow-x-auto, .gridjs-wrapper");

     candidates.forEach((el) => {
       const style = getComputedStyle(el);
       if (style.display === "none" || style.visibility === "hidden" || el.clientWidth === 0) {
         el.removeAttribute("data-insufficient-space");
         return;
       }
       const hasHorizontalScrollbar =
         el.scrollWidth > el.clientWidth + 2 &&
         ["auto", "scroll"].includes(style.overflowX);

       if (hasHorizontalScrollbar) {
         el.setAttribute("data-insufficient-space", "true");
         insufficient.push({
           tag: el.tagName.toLowerCase(),
           id: el.id || null,
           className: el.className,
           scrollWidth: el.scrollWidth,
           clientWidth: el.clientWidth,
           message: "Element has a horizontal scrollbar and does not have enough space"
         });
       } else {
         el.removeAttribute("data-insufficient-space");
       }
     });
     return insufficient;
   };
   ```
3. **Playwright Breakpoint Gate**:
   At all 5 Tailwind breakpoints (`sm`: 640px, `md`: 768px, `lg`: 1024px, `xl`: 1280px, `2xl`: 1536px), `verify-report.mjs` runs `window.checkInsufficientHorizontalSpace()` and flags any element with a horizontal scrollbar as **not having enough space**.

---

## 5. CSV-Backed Report Highlight, Search File Function & Chart.js / Grid.js / Alpine.js Integration

Whenever an HTML report or interactive form is generated on the basis of a CSV file (for example, `example.csv`):

1. **Highlight the CSV Foundation & Start Completely Empty**:
   - Wrap the CSV section/form in a highlighted card (`border-2 border-primary/60 bg-base-100`, `data-csv-highlight="true"`) with a prominent badge and callout banner stating **`Built Around <filename>.csv`**.
   - Start the section **completely empty** (`csvLoaded: false`, `#csv-empty-state` visible, and `#csv-loaded-workspace` hidden) until the **Load CSV** control loads the CSV.
2. **Vertical Layout: Load CSV → Search & Custom DaisyUI Filters → Grid.js → Chart.js**:
   - **Load CSV (`#csv-step-1-load`)**: Provide the CSV file loader (`<input id="csv-file-input" type="file" accept=".csv">` and `#load-example-csv-btn` button) at the top.
   - **Search & Custom DaisyUI + Alpine.js Filters (`#csv-step-2-search`)**: Directly **underneath** the Load CSV control, provide the search input (`id="csv-search-input"`, placeholder `"Search in <filename>.csv..."`) paired with custom **DaisyUI** filter components bound via **Alpine.js** (`select` dropdowns, `join` segmented status buttons, `range` sliders, and `toggle` switches).
   - **Grid.js Table (`#csv-grid-section` / `#csv-gridjs-table`)**: Placed underneath the search & filter panel.
   - **Chart.js Visualization (`#csv-chart-section` / `#csvChart`)**: Placed **underneath the Grid.js table**, plotting the filtered CSV rows and syncing with DaisyUI theme switches.

---

## 6. `@media print` Queries, Page 1 Cover + H1/H2/H3 TOC, & Interactive Control Fallbacks

Every report MUST include `@media print` rules and a first-page print cover (`#print-cover-page`) inside `<main>` so that PDF exports look publication-grade in any DaisyUI theme:

1. **Navbar Hidden in Print**: `header, .navbar, .print\:hidden { display: none !important; }`
2. **Page 1 Cover + H1/H2/H3 Table of Contents (`#print-cover-page`)**:
   - Hidden on screen (`display: none`), shown on Page 1 in `@media print` (`display: flex !important; break-after: page !important; page-break-after: always !important; min-height: 92vh !important;`).
   - Displays the **Report Title (`#print-cover-title`)** (use a `<div>` instead of `<h1>` so it is not duplicated in heading queries) and the **complete Table of Contents of all `h1`, `h2`, and `h3` headings (`#print-toc-list`)** populated by `initTOC()`.
3. **Interactive Controls Hidden & Static Print Summaries Shown**:
   - Interactive elements that do not work in static PDFs (`.print-interactive-control`, `.gridjs-head`, `.gridjs-pages`) are hidden (`display: none !important`), while static print fallbacks (`.print-only-summary`, such as `#csv-print-static-fallback`) are displayed (`display: block !important`).
4. **Theme Color Preservation in Print**:
   - Enforce `-webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;` and `html, body { background-color: oklch(var(--b2)) !important; color: oklch(var(--bc)) !important; }` so multi-theme PDFs preserve their active DaisyUI palette.

---

## 7. Centered Minimal Footer Blueprint

Every report MUST end with a centered minimal `<footer>` linking `html-report` to `https://github.com/DriesVerb/html-report` in a new tab:

```html
<footer class="border-t border-base-300 bg-base-100 py-6 mt-12 text-center text-xs opacity-75">
  generated by <a href="https://github.com/DriesVerb/html-report" target="_blank" rel="noopener noreferrer" class="link link-hover font-semibold">html-report</a>
</footer>
```

---

## 8. Card Header & Hero Action Button Responsive Layout (Preventing Button Overflow)

When building a card header or Hero banner featuring a title and description on the left with an action button, dropdown, or external link on the right, you MUST adhere to the flex boundary contract:

### 8.1 The Flex Boundary Contract
```html
<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
  <!-- Left column: MUST have min-w-0 flex-1 -->
  <div class="min-w-0 flex-1 space-y-2">
    <div class="flex items-center gap-2 flex-wrap">
      <span class="badge badge-primary font-mono text-xs font-bold">Category</span>
      <span class="badge badge-outline text-xs">Status</span>
    </div>
    <h1 id="section-heading" class="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight scroll-mt-20 break-words">
      Very Long Section Title That Could Wrap Across Lines
    </h1>
    <p class="text-xs sm:text-sm opacity-80 leading-relaxed">
      Detailed subtitle description explaining the purpose of this card or document.
    </p>
  </div>

  <!-- Right column: MUST have shrink-0 self-start sm:self-center -->
  <div class="shrink-0 self-start sm:self-center">
    <a href="..." class="btn btn-outline btn-sm gap-1.5 whitespace-nowrap shadow-xs">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      <span>Action Button</span>
    </a>
  </div>
</div>
```

### 8.2 Why This Rule Is Strict
1. **The Flex Item Min-Width Default**: By default in CSS Flexbox, flex items have `min-width: auto`. A long heading or paragraph will calculate its natural intrinsic width and refuse to shrink below it.
2. **The "Jumping Out of Card" Bug**: Without `min-w-0 flex-1` on the text column, on intermediate viewport widths (`640px`–`1024px`), the wide heading pushes the action button rightward past the card's right padding and border, causing horizontal overflow.
3. **The Solution**: 
   - Adding `min-w-0 flex-1` allows the left column to compress gracefully.
   - Adding `break-words` ensures long unbroken words or kebab-case identifiers wrap cleanly.
   - Adding `shrink-0` to the action button wrapper with `whitespace-nowrap` guarantees the button never gets squished or pushed outside the card boundary.

---

## 9. Card & Section Header Badge Protection Contract (Preventing Badge Text Wrapping and Pill Overflow)

When placing a status badge, category tag, or metadata indicator in a card or section header (e.g., `<span class="badge badge-success badge-outline text-xs">Confirmed Design</span>`), you MUST adhere to the Badge Protection Contract.

### 9.1 Root Cause of the Broken Pill Layout
DaisyUI `.badge` elements have a fixed single-line height (`height: 1.25rem` / `20px` in standard, or `1rem` in `badge-sm`, `0.75rem` in `badge-xs`) paired with fully rounded pill radii (`border-radius: var(--rounded-badge, 1.9rem)`).
- However, DaisyUI does NOT define `white-space: nowrap;` or `flex-shrink: 0;` on `.badge`.
- In a standard flex header (`<div class="flex items-center justify-between">`), children default to `flex-shrink: 1`.
- When the title/description expands or the screen contracts, the badge is compressed horizontally. Multi-word badges with spaces (`"Confirmed Design"`, `"Not PDF-Ready"`, `"Verified • 4/4"`) are forced to wrap into two lines (`"Confirmed\nDesign"`).
- Because the badge container is constrained to a single line height with `overflow: visible`, the top line pokes out of the badge's top border, and the second line breaks through the bottom border.

### 9.2 The Double-Layer Protection Contract
To permanently prevent this across all viewports and breakpoint transitions, two complementary rules are enforced:

1. **Global CSS Reset Safeguard (in `template-shell.html`)**:
   ```css
   .badge {
     white-space: nowrap !important;
     flex-shrink: 0;
   }
   ```
2. **Responsive Header Flex Layout**:
   ```html
   <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 w-full">
     <!-- Left Column: Title & Subtitle with min-w-0 flex-1 -->
     <div class="flex items-center gap-3 min-w-0 flex-1">
       <div class="p-2.5 rounded-xl bg-success/10 text-success shrink-0">
         <i data-lucide="check-circle-2" class="w-6 h-6"></i>
       </div>
       <div class="min-w-0 flex-1">
         <h2 class="text-xl font-bold text-base-content break-words">Section Title</h2>
         <p class="text-xs sm:text-sm text-base-content/70 break-words">Descriptive subtitle</p>
       </div>
     </div>
     
     <!-- Right Column: Status Badge with shrink-0 whitespace-nowrap -->
     <span class="badge badge-success badge-outline text-xs shrink-0 whitespace-nowrap">
       Confirmed Design
     </span>
   </div>
   ```


## 9. Deterministic Assembly Engine & Pre-Bundled Assets

To minimize token usage and accelerate generation, reports are assembled deterministically rather than synthesized from scratch:
- **`assets/template-shell.html`**: Contains the responsive HTML head, DaisyUI navbar, content slot (`<!-- {{CONTENT}} -->`), and centered footer.
- **`assets/report-runtime.js`**: Pre-bundled client script managing 32-theme switching, canvas 2D palette resolution, TOC generation, space detection, and standalone snapshot bundling.
- **`scripts/build-report.mjs`**: Local CLI tool that scans content fragments for feature signatures (`<canvas>`, `.mermaid`, `data-gridjs`, `katex`, `leaflet`, `hljs`), resolves necessary CDNs dynamically, and stitches the final report in <100ms:
  ```bash
  node skills/html-report/scripts/build-report.mjs --title "Report Title" --content fragment.html --output report.html
  ```

---

## 10. Canvas 2D OKLCH Color Resolution & Mermaid Syntax Defense

1. **Canvas 2D OKLCH Resolution**: DaisyUI v4 defines theme tokens using `oklch(...)`. Passing `oklch(...)` directly to Mermaid or Chart.js causes parsing errors or fallback to flat colors. `cssColorToHexAndRgba()` draws the color onto a 1x1 `<canvas>` 2D context and extracts deterministic 8-bit `#rrggbb` and `rgba(...)` values natively without external dependencies.
2. **Mermaid Numbered List Defense**: Mermaid 11.4 parses tokens matching `1. `, `2. ` as markdown ordered lists, triggering `Unsupported markdown: list` syntax errors when used in subgraph or node titles. Always use hyphens or descriptive labels: `subgraph Input["Step 1 - Data Intake"]`.

