# Proposal: Creation Studio Dedicated Navbar & Projects Directory View

## Why
Currently, the HTML Creation Studio (`create.html`) exposes all its ancillary controls directly across the top navbar (individual DaisyUI theme switcher swatch button, PWA install button, and download dropdown), creating visual clutter compared to the clean, streamlined navbar in standard HTML reports (`template-shell.html`). Furthermore, once reports and feature companion dashboards are created in subfolders across the workspace (such as `openspec/changes/*/index.html`, `dev/`, `benchmark/`, `research/`, or custom report directories), users have no native way within the Creation Studio to browse, identify, and open their existing projects.

Adding a dedicated, standardized navbar with a streamlined Settings menu, prominent Sections TOC, and a new "Projects" navigation option will unify the studio experience and provide a visual project hub to view and launch local HTML reports in new tabs with semantic versioning indicators.

## What Changes
* **Dedicated Creation Studio Navbar**:
  * Align the Creation Studio header with the publication-grade `template-shell.html` navbar layout:
    * Left (`navbar-start`): Studio title and `/html-create` mode badge.
    * Right (`navbar-end`):
      * Keep **Sections** (TOC dropdown) top-level and prominent.
      * Add a dedicated **Projects** nav button/link (`#navbar-projects-btn`) leading to the Projects directory view.
      * Move all remaining loose controls (DaisyUI 32-theme switcher, PWA Install action, Download Starter HTML, Copy AI Prompt, Print Specification) into a clean, unified **Settings Gear** dropdown (`#studio-settings-gear-btn`).
* **Projects Directory View (`#view-projects`)**:
  * Provide an interactive Projects directory view within the Creation Studio (with smooth switching between the "Creation Wizard" view and "Projects" view).
  * Project discovery:
    * Dev Server mode: `GET /api/projects` in `serve-report.mjs` scans workspace folders and subdirectories for HTML reports, parses `<title>`, metadata, and SemVer versions, and returns an enriched JSON project list.
    * Zero-Node / Static mode (`file://`): graceful offline fallback using static/cached workspace project manifests and local indexed storage.
  * Project Cards & Quick Launcher:
    * List each discovered report/project with its title, path/folder, category badge (e.g. *OpenSpec Journey*, *Analytical Report*, *Live Telemetry Dashboard*, *PWA Tool*), and semantic version tag (e.g. `v1.2.0`).
    * Include a prominent **"Open"** action button that launches the target HTML report in a **new tab** (`target="_blank"`).

## Capabilities

### New Capabilities
- `studio-project-navigation`: Dedicated navbar layout for the Creation Studio with streamlined settings, prominent Sections TOC, and an integrated Projects Directory view with automatic workspace report discovery, semantic version badges, and open-in-new-tab controls.

### Modified Capabilities
*(None - existing core report generation specifications remain backward-compatible)*

## Impact
- **Assets**: `skills/html-report/assets/create.html` and workspace root `create.html`.
- **Scripts**: `skills/html-report/scripts/serve-report.mjs` (adds `GET /api/projects` discovery endpoint).
- **Documentation & References**: `skills/html-create/SKILL.md` updated with Projects directory features.
- **Backwards Compatibility**: Fully backward-compatible; existing reports and build pipelines are unaffected.
