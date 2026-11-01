# `html-report` — LLM-Agnostic Agent Skill for Publication-Grade HTML Reports

An open, LLM-agnostic [Agent Skill](https://agentskills.io) built and evolved incrementally with [OpenSpec](https://github.com/Fission-AI/OpenSpec). It guides any AI coding agent (Antigravity, Claude Code, Cursor, Codex, OpenCode, Gemini CLI, etc.) to generate rich, interactive, self-contained, and print/PDF-verified HTML5 reports.

---

## Super Easy Install

### Option 1: Install as a Prompt (Copy & Paste into Your AI Agent)

Paste this prompt directly into **Antigravity, Claude Code, Cursor, Codex, OpenCode, or Gemini CLI** and let your agent install it for you:

```text
Install the html-report skill from https://github.com/DriesVerb/html-report.git by cloning it into ~/.agents/html-report, symlinking ~/.agents/html-report/skills/html-report into ~/.agents/skills/html-report (and ~/.gemini/config/skills/html-report if using Antigravity/Gemini), and installing Playwright in ~/.agents/html-report/skills/html-report/playwright. Then read skills/html-report/SKILL.md.
```

### Option 2: 1-Line Terminal Command

```bash
# Via the universal Agent Skills CLI:
npx skills add DriesVerb/html-report

# Or via 1-line git clone + global symlink:
git clone https://github.com/DriesVerb/html-report.git ~/.agents/html-report && mkdir -p ~/.agents/skills ~/.gemini/config/skills && ln -sfn ~/.agents/html-report/skills/html-report ~/.agents/skills/html-report && ln -sfn ~/.agents/html-report/skills/html-report ~/.gemini/config/skills/html-report
```

---

## Key Capabilities

1. **Non-Blocking 11-Library CDN Stack**:
   - **Tailwind CSS** (`cdn.tailwindcss.com`) — Utility-first responsive layout
   - **DaisyUI v4** (`daisyui@4.12.14/dist/full.min.css`) — Component classes + all 32 built-in themes
   - **Lucide Icons** (`lucide@0.460.0`) — Clean vector iconography
   - **Alpine.js** (`alpinejs@3.14.3`) — Lightweight declarative UI interactivity
   - **Chart.js** (`chart.js@4.4.6`) — Interactive charts synced dynamically with DaisyUI themes
   - **Mermaid** (`mermaid@11.4.0`) — Architecture & workflow diagrams synced with DaisyUI themes
   - **Leaflet** (`leaflet@1.9.4`) — Interactive geospatial maps (Esri ArcGIS World Street Map tiles — zero 403/API-key blocks on `file://`)
   - **Grid.js** (`gridjs@6.0.6`) — Interactive sortable, searchable, and paginated data tables (dark-mode & light-mode theme synced)
   - **KaTeX** (`katex@0.16.11`) — Scientific math & LaTeX formula rendering
   - **Marked** (`marked@14.1.3`) — Rendered Markdown prose blocks
   - **Highlight.js** (`highlight.js@11.10.0`) — Syntax-highlighted code blocks (including TypeScript Frontend & Kotlin Backend examples)
   - All scripts use non-blocking `defer` loading and isolated initialization guards so no single CDN blocks page rendering.

2. **Sticky DaisyUI Navbar (Left Report Title + Right Controls) & Default `light` Theme**:
   - **Default Theme**: Always defaults to `data-theme="light"` (never `corporate`).
   - **Content-Aware Favicon**: Each report includes an inline SVG emoji favicon in `<head>` (e.g. `📊`, `🗺️`, `⚡`, `🧪`) matching the report's content with zero external assets.
   - **Left (`navbar-start`)**: Displays the **Report Title** (`#navbar-report-title`).
   - **Right (`navbar-end`)**:
     - **Contents Dropdown (`#toc-dropdown`)**: Automatically maps and links to all `h1`, `h2`, and `h3` headings via `#id` anchors.
     - **DaisyUI Color-Swatch Theme Dropdown (`#theme-dropdown`)**: Displays all **32 DaisyUI themes** with live **color-scheme swatch previews** (`bg-primary`, `bg-secondary`, `bg-accent`, `bg-neutral` inside `data-theme="<theme>"`, matching the official DaisyUI website) and dynamically synchronizes **Chart.js**, **Mermaid**, **Grid.js**, and CSS-styled report elements.
     - **Icon-Only Download Dropdown (`#download-dropdown`)**: An icon-only trigger button (`#download-dropdown-btn`, no visible text label) that opens a dropdown menu with two options:
       - **Download as HTML (`#download-html-btn`)**: Fetches all external CDN stylesheets and scripts in parallel, inlines them directly into `<style>` and `<script>` tags inside the HTML document, and downloads a 100% standalone offline `.html` file.
       - **Download as PDF (`#download-pdf-btn`)**:
         - In **Static Mode**: Triggers `window.exportReportPdf()` with `@media print` styling.
         - In **Interactive Mode**: Displays a badge `"Not PDF-Ready"` and opens `#pdf-not-ready-modal` suggesting the conversion prompt (`Convert this interactive HTML report into a print/PDF-ready publication report with @media print queries, static fallbacks, and Page 1 TOC`) to focus on print media queries only when desired.

3. **Interactive vs. Static Mode Discrimination & Conditional `@media print`**:
   - The skill asks or indicates upfront whether the report is **Interactive** (client-side filters, sliders, dynamic charts, CSV loaders) or **Static** (print-first publication documents).
   - ONLY when a report is **Static** does the agent create `@media print` queries, Page 1 Cover + TOC (`#print-cover-page`), static print summaries (`.print-only-summary`), and run multi-theme mock PDF verification (`light`, `dark`, `cupcake`, `synthwave`, `nord`). In interactive mode, print media query overhead is bypassed.

4. **CSV-Backed Report Highlight, Search File Function & Grid.js / Alpine.js Actions**:
   - When an HTML report or form is built around a CSV file (such as `skills/html-report/examples/example.csv`), the report visually **highlights** the CSV-backed form (`data-csv-highlight="true"`) and includes a **Search File Function naming the CSV** (`#csv-search-input`) plus a CSV file loader (`#csv-file-input`) that triggers synchronized **Alpine.js** filter/metric actions and **Grid.js** table updates.

4. **Horizontal Scrollbar ("Insufficient Space") Detection**:
   - Both the live report runtime (`checkInsufficientHorizontalSpace()`) and the Playwright verifier inspect all elements across every Tailwind breakpoint (`sm`: 640px, `md`: 768px, `lg`: 1024px, `xl`: 1280px, `2xl`: 1536px). When any element has a horizontal scrollbar (`scrollWidth > clientWidth`), it explicitly indicates that the element does not have enough horizontal space.

5. **Dedicated Charts & Mermaid Style Guide**:
   - Located at `skills/html-report/references/charts-and-mermaid-style-guide.md`, enforcing container sizing, color palette harmony, DaisyUI CSS variable resolution, and print/PDF layout stability.

6. **Full-Featured Showcase (`example.html` + `example.csv`) & Playwright Pre-PDF Verifier**:
   - `skills/html-report/examples/example.html` explicitly lists the names of all 11 CDNs with clickable Section 1.1 cards and showcases a live working example of every single one, plus a CSV-driven form showcase at the bottom backed by `skills/html-report/examples/example.csv`.
   - `skills/html-report/playwright/verify-report.mjs` validates the HTML report across all 5 Tailwind CSS breakpoints (`sm`–`2xl`), checks navbar layout & TOC links, verifies the 32 DaisyUI theme color-swatch previews and live Chart.js/Grid.js dark-mode reactivity, verifies the CSV-backed form & search actions, verifies the icon-only CDN-inlining Download button, verifies zero element-level horizontal scrollbars, and verifies clean PDF export before sending to the user.

---

## Repository Structure

```text
html-report/
├── skills/
│   └── html-report/                              # Canonical, publishable Agent Skill
│       ├── SKILL.md                              # Main LLM-agnostic skill instructions
│       ├── references/
│       │   ├── architecture-and-styling.md       # 11-CDN stack, navbar, CSV rules & download blueprint
│       │   └── charts-and-mermaid-style-guide.md # Focused Chart.js & Mermaid standards
│       ├── examples/
│       │   ├── example.html                      # Showcase HTML report naming & demonstrating all 11 CDNs + CSV support
│       │   └── example.csv                       # Sample CSV dataset driving the Section 10 CSV-backed form
│       └── playwright/
│           ├── package.json                      # Playwright verifier dependencies
│           └── verify-report.mjs                 # Multi-breakpoint, space-check, CSV & pre-PDF verifier
├── .agents/
│   └── skills/
│       └── html-report -> ../../skills/html-report  # Local workspace symlink
└── openspec/                                     # Spec-driven development artifacts
```

---

## Local & Global Symlink Installation

Within this repository, `.agents/skills/html-report` is already symlinked to `../../skills/html-report`.

To symlink this skill globally on your machine so it is available in all projects:

```bash
# Universal Agent Skills global directory
mkdir -p ~/.agents/skills
ln -sfn "$(pwd)/skills/html-report" ~/.agents/skills/html-report

# Antigravity / Gemini global config directory
mkdir -p ~/.gemini/config/skills
ln -sfn "$(pwd)/skills/html-report" ~/.gemini/config/skills/html-report
```

---

## Auto-Open & Single-Tab Live-Reload Dev Server

Serve any report with automatic single-tab synchronization:

```bash
node skills/html-report/scripts/serve-report.mjs skills/html-report/examples/example.html
```

- **Auto-Open**: Automatically launches the report in your default browser tab.
- **Single-Tab Sync**: When you edit the HTML report:
  - If already open in a tab, it refreshes the existing tab in place (zero duplicate tabs).
  - If closed, it automatically re-opens a fresh browser tab.

---

## Running the Playwright Multi-Breakpoint & PDF Check

```bash
cd skills/html-report/playwright
pnpm install
node verify-report.mjs ../examples/example.html --pdf ../examples/example.pdf
```
