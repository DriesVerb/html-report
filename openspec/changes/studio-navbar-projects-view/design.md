# Design: Creation Studio Dedicated Navbar & Projects Directory View

## Context
See [proposal.md](file:///home/eta/projects/html-report/openspec/changes/studio-navbar-projects-view/proposal.md) for background and motivation.

Currently, the standard HTML report shell in `skills/html-report/assets/template-shell.html` maintains a clean, publication-grade navbar where ancillary controls are consolidated inside a Settings dropdown (`#settings-gear-btn`), leaving only the document title and the Table of Contents (`Contents`/`Sections`) at the top level.

In contrast, `skills/html-report/assets/create.html` currently renders multiple individual dropdowns and buttons directly on the navbar (TOC, Theme dropdown with 32 swatches, PWA install button, and Download dropdown), creating visual noise. Furthermore, developers working across multiple HTML reports and OpenSpec changes have no centralized visual launcher to discover and inspect their existing reports.

## Goals / Non-Goals

**Goals:**
- Provide a dedicated, streamlined navbar in `create.html` that matches the clean visual hierarchy of `template-shell.html`.
- Consolidate theme switching, PWA installation, and export actions inside a unified Settings dropdown (`#studio-settings-gear-btn`).
- Introduce a top-level **Projects** navigation option (`#navbar-projects-btn`) in the Creation Studio navbar.
- Create an integrated **Projects Directory View** (`#view-projects`) that presents workspace reports and feature dashboards in responsive cards.
- Implement an automated project discovery endpoint `GET /api/projects` in `serve-report.mjs` with semantic version extraction.
- Support offline/static zero-node fallback for projects listing when running via `file://`.
- Enable launching any discovered project in a new browser tab (`target="_blank"`).

**Non-Goals:**
- Modifying, deleting, or re-compiling existing workspace HTML reports.
- Cloud syncing or remote project repository hosting.
- Altering the core report compiler logic in `build-report.mjs`.

## Architecture & Technical Decisions

### 1. Creation Studio Dedicated Navbar Structure
```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [✨ HTML Creation Studio] [/html-create]             [Sections ▾]  [📂 Projects]  [⚙️] │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Left (`navbar-start`)**:
  - Studio branding with content-aware emoticon icon and title.
  - Mode badge (`/html-create`).
- **Right (`navbar-end`)**:
  - **`Sections` Dropdown**: Smooth-scroll TOC navigation across the wizard steps.
  - **`Projects` Action Button**: Toggles between `#view-wizard` (Creation Studio) and `#view-projects` (Projects Directory).
  - **Settings Gear (`#studio-settings-gear-btn`)**:
    - **Appearance**: DaisyUI 32-theme selector with real-time swatch previews.
    - **App Installation**: "Install Studio as App (PWA)" action.
    - **Export Actions**: "Download Starter HTML", "Copy AI Prompt", "Print Specification".

### 2. Dual-View Mode Architecture in `create.html`
- Uses lightweight Alpine.js / vanilla DOM view switching between:
  1. `#view-wizard`: The 4-step creation studio wizard, OKLCH studio, and AI prompt generator.
  2. `#view-projects`: The projects directory grid displaying discovered local HTML reports.
- Supports URL hash routing: `create.html#projects` opens directly into the Projects view.
- A "Back to Wizard / New Report" button in the projects view allows instant return.

### 3. Backend Project Discovery (`GET /api/projects`)
In `skills/html-report/scripts/serve-report.mjs`:
- Endpoint: `GET /api/projects`
- Scans the project root directory recursively up to a depth of 4 levels, excluding `.git`, `node_modules`, `.cache`, and `.gemini`.
- Matches all `*.html` files with priority recognition:
  - `openspec/changes/*/index.html` → Category: *OpenSpec Journey*
  - `reports/**/*.html` or `report.html` → Category: *Analytical Report*
  - `dev/*.html` → Category: *Dev Prototype*
  - `benchmark/*.html` → Category: *Performance Benchmark*
  - `research/*.html` → Category: *Research Report*
- Version extraction:
  - Scans first 2KB of the HTML file for `<!-- {{VERSION}} -->`, `data-report-version="x.y.z"`, or comment `version: x.y.z`.
  - Falls back to `package.json` SemVer (`v2.0.0`) or file modification timestamp.

### 4. Zero-Node Offline Fallback
When opened statically without a running Node.js server (`file://`):
- Checks `localStorage` for registered local projects.
- Displays bundled reference reports (`skills/html-report/examples/example.html`, `benchmark/traditional-report.html`, `research/index.html`) as default projects with clear local badges.

## Risks / Trade-offs

- **[Risk] Deep directory traversal could slow down server response in huge workspaces.**  
  → *Mitigation*: Limit scan depth to 4 levels, ignore non-HTML directories (`node_modules`, `.git`, `.gemini`), and cache scan results with a 5-second TTL.
- **[Risk] Broken relative links when opened from different path depths.**  
  → *Mitigation*: When served via `serve-report.mjs`, all project links are served relative to root (e.g. `/openspec/changes/.../index.html`). In `file://` mode, compute relative paths or absolute file URIs.
- **[Risk] User confusion between wizard state and projects view.**  
  → *Mitigation*: Highlight active navigation state with DaisyUI `btn-active` / `btn-primary` styling on `#navbar-projects-btn` and provide a prominent "← Back to Creation Studio" breadcrumb.
