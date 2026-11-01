# Proposal

## Why

LLMs asked to generate HTML reports without structured guidance often produce inconsistent, unstyled, fragmented, or fragile outputs that lack rich interactive components, theme adaptability, self-contained offline export, consistent chart/diagram aesthetics, or automated visual/PDF verification. We need a foundational, LLM-agnostic Agent Skill (`html-report`) built on OpenSpec that establishes the portable skill packaging layout, a comprehensive non-blocking CDN component stack (Tailwind CSS, DaisyUI, Lucide Icons, Alpine.js, Chart.js, Mermaid, Leaflet, Grid.js, KaTeX, Marked, and Highlight.js), a sticky DaisyUI navbar with left-aligned report title and right-aligned controls (TOC dropdown, DaisyUI color-swatch theme dropdown, and icon-only CDN-inlining HTML download button), a dedicated Charts & Mermaid style guide, horizontal-scrollbar insufficient-space detection, a full-featured example report showcasing all CDNs, and an automated Playwright multi-breakpoint & PDF verification suite.

## What Changes

- Create the publishable, LLM-agnostic skill directory `skills/html-report/` following the open Agent Skills specification (`SKILL.md`, `references/`, `examples/`, `playwright/`) and symlink it to `.agents/skills/html-report`.
- Standardize a non-blocking 11-CDN stack in `skills/html-report/references/architecture-and-styling.md`: **Tailwind CSS**, **DaisyUI** (styling & components + all 32 themes), **Lucide** (icons), **Alpine.js** (reactive UI micro-interactions), **Leaflet** (maps), **Chart.js** (charts), **Mermaid** (diagrams), **Grid.js** (interactive data tables), **KaTeX** (math/LaTeX rendering), **Marked** (Markdown rendering), and **Highlight.js** (code syntax formatting), loaded with non-blocking execution and isolated feature guards.
- Require every HTML report to include a sticky **DaisyUI navbar** featuring:
  - **Left (`navbar-start`)**: The **report title** (`#navbar-report-title`).
  - **Right (`navbar-end`)**:
    1. A **Table of Contents dropdown menu** (`Contents`) that maps all `h1`, `h2`, and `h3` headings via anchor `id` links.
    2. A **DaisyUI Theme Dropdown** supporting all 32 built-in DaisyUI themes where **each theme item previews its actual color scheme swatches** (`bg-primary`, `bg-secondary`, `bg-accent`, `bg-neutral` inside `data-theme="<theme>"`), identical to the official DaisyUI website, and dynamically synchronizes **Chart.js**, **Mermaid**, and CSS-styled components.
    3. An **icon-only Download button** (no text label) that downloads the report as a standalone `.html` file with all external CDN stylesheets and scripts fetched and inlined into the downloaded document.
- Add a dedicated **Charts & Mermaid Style Guide** (`skills/html-report/references/charts-and-mermaid-style-guide.md`) enforcing visual standards, dynamic DaisyUI CSS variable theme synchronization, container sizing, and PDF/print fidelity for Chart.js and Mermaid diagrams.
- Add **Horizontal Scrollbar / Insufficient Space Detection** (both as a visual runtime indicator when `el.scrollWidth > el.clientWidth` and as a strict check across all 5 Tailwind breakpoints in Playwright) so any element with a horizontal scrollbar clearly indicates it does not have enough space.
- Update `skills/html-report/examples/example.html` to explicitly list the names of all 11 CDNs and feature live working examples of each one, plus a dedicated **CSV-Driven Interactive Section** at the bottom backed by `skills/html-report/examples/example.csv`.
- Add **First-Class CSV Data Source Support**: when an HTML report or section is created on the basis of a CSV file, highlight the CSV source (`example.csv`), include a CSV file search/loader & filter form naming the CSV file, and bind the parsed CSV data directly to **Grid.js** (interactive table) and **Alpine.js** (reactive filtering and summary metrics).
- Update `skills/html-report/playwright/verify-report.mjs` to validate the swapped navbar layout, icon-only download button, DaisyUI color-swatch theme dropdown, all 11 CDN examples, CSV-driven `example.csv` search/Grid.js/Alpine.js integration, and element-level horizontal scrollbar checks across all Tailwind breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`) before PDF export.

## Capabilities

### New Capabilities
- `skill-packaging`: Defines the LLM-agnostic Agent Skill directory structure (`skills/html-report/` including `references/`, `examples/`, and `playwright/`), frontmatter contract, progressive disclosure conventions, and local symlink integration (`.agents/skills/html-report`).
- `report-generation-core`: Defines the requirements for generating HTML5 reports powered by the 11-library non-blocking CDN stack (Tailwind, DaisyUI, Lucide, Alpine.js, Leaflet, Chart.js, Mermaid, Grid.js, KaTeX, Marked, Highlight.js), DaisyUI navbar with left-aligned title and right-aligned controls (TOC dropdown, color-swatch DaisyUI theme dropdown synced to Chart.js/CSS, icon-only CDN-inlining download button), dedicated Chart.js/Mermaid style standards, horizontal-scrollbar insufficient-space indication, a full-featured `example.html` naming and demonstrating all CDNs, and Playwright multi-breakpoint pre-PDF verification.

### Modified Capabilities
<!-- None: this is the initial foundational change. -->

## Impact

- Updates `skills/html-report/SKILL.md`.
- Updates `skills/html-report/references/architecture-and-styling.md` and `skills/html-report/references/charts-and-mermaid-style-guide.md`.
- Updates `skills/html-report/examples/example.html`.
- Updates `skills/html-report/playwright/verify-report.mjs`.
