# deterministic-assembly Specification

## Purpose
Enables deterministic assembly of HTML reports from body content fragments, reusable asset shells, and modular CDN packages without requiring manual boilerplate synthesis.

## Requirements

### Requirement: HTML Body Fragment Injection
The builder CLI SHALL accept a semantic `<main>` HTML content fragment, inject its inner content into the pre-generated DaisyUI report shell, and preserve reactive or application attributes authored on the `<main>` element (`id`, `x-data`, `x-init`, `x-*`, `@*`, `data-*`, `aria-*`, and custom CSS classes merged with the shell's layout classes).

#### Scenario: Successful fragment assembly
- **GIVEN** a content fragment file containing DaisyUI cards and stats
- **WHEN** `node scripts/build-report.mjs --title "Test Report" --content fragment.html --output report.html` is executed
- **THEN** the output HTML contains the full document shell with `<main id="report-main">` populated by the fragment content.

#### Scenario: Reactive Alpine attributes on `<main>` survive assembly
- **GIVEN** a content fragment whose root element is `<main id="report-main" x-data="stoneBoard" x-init="boot()" data-board-version="1" class="custom-board-grid">`
- **WHEN** `build-report.mjs` assembles the fragment into the report shell
- **THEN** the output document's `<main>` element retains `id="report-main"`, `x-data="stoneBoard"`, `x-init="boot()"`, `data-board-version="1"`, and merges `custom-board-grid` with the shell's default `<main>` classes so Alpine initializes on page load.

### Requirement: Dynamic CDN Module Resolution
The builder CLI SHALL automatically detect required CDN libraries from content signatures and support explicit flag overrides.

#### Scenario: Auto-detection of Chart and Mermaid signatures
- **GIVEN** a content fragment containing `<canvas id="perfChart">` and `<pre class="mermaid">`
- **WHEN** the builder CLI processes the fragment without explicit CDN flags
- **THEN** the generated HTML includes Chart.js and Mermaid CDN scripts, while omitting unused libraries like Leaflet and KaTeX.

#### Scenario: Explicit CLI addon override
- **GIVEN** a content fragment without math equations
- **WHEN** the builder CLI is invoked with `--math`
- **THEN** KaTeX CDN scripts and stylesheets are included in `<head>`.

### Requirement: Pre-Bundled Theme and Runtime Scripts
The default assembled report produced by `packages/core` (`build-report.mjs` / `harness.mjs`) SHALL embed only the viewer-focused `template-shell.html` and slim `report-runtime.js` (32-theme switcher, OKLCH resolution, heading-to-TOC parsing, space detection, Mermaid zoom, Showdown viewer, and download controls), omitting Edit Mode (`#edit-dock`), `#all-settings-modal`, and authoring-only runtime modules unless `--editable` / `editable: true` is explicitly enabled.

#### Scenario: Dynamic theme switching in assembled report
- **WHEN** the user selects any of the 32 DaisyUI themes from the navbar dropdown
- **THEN** the active theme updates on `<html data-theme="...">`, dynamic palettes resolve via canvas 2D context, and active charts/diagrams re-render.

#### Scenario: Default compilation produces a clean viewer-only report
- **WHEN** `build-report.mjs` compiles a `<main>` fragment without `--editable` or `--ai`
- **THEN** the assembled HTML includes full 32-theme switching, TOC navigation, Mermaid Enlarge, and Download controls
- **AND** it omits `#edit-dock`, `#all-settings-modal`, `#open-all-settings-btn`, `#settings-publish-toggle`, and authoring/edit-queue JavaScript.

### Requirement: Conditional AI Assistant Chrome Injection
The builder CLI SHALL omit `#agent-dock-container` and `#agent-reconnect-modal` markup from the assembled HTML when `ai` is `false` (default), including them only when `--ai` / `ai: true` is enabled (and not `--published`).

#### Scenario: Standard report without `--ai` omits AI dock DOM
- **WHEN** `build-report.mjs` assembles a report without `--ai`
- **THEN** the output HTML does not contain `#agent-dock-container` or `#agent-reconnect-modal`, reducing default DOM footprint.

#### Scenario: Report built with `--ai` includes AI dock DOM on default port `3031`
- **WHEN** `build-report.mjs --ai` assembles a report without an explicit `--ai-port`
- **THEN** the output HTML includes `#agent-dock-container` and `<meta name="html-report-ai-port" content="3031" />`.

### Requirement: Installation-Aware Project Scaffolding Commands & Local Runner Scripts
The project scaffolder and manifest generator SHALL emit `rebuildCommand`, `serveCommand` (defaulting to port `3031`), and documentation paths resolved dynamically against the active skill installation path and target workspace root, and SHALL generate a project-local `package.json` with `build`, `serve`, `verify`, and `preflight` scripts inside `projects/<slug>/`.

#### Scenario: Scaffolding inside the html-report monorepo
- **WHEN** `scaffold-project.mjs --project sample-board` is executed from a workspace that contains `skills/html-report/scripts/build-report.mjs`
- **THEN** `report.manifest.json`, `AGENTS.md`, and `projects/sample-board/package.json` use workspace-relative `skills/html-report/scripts/...` commands defaulting to port `3031` and a valid link to `agent-authoring-guide.md`.

#### Scenario: Scaffolding from an externally installed or symlinked skill path
- **WHEN** `scaffold-project.mjs --project external-board` is executed in a workspace where `skills/html-report/` does not exist locally
- **THEN** `report.manifest.json`, `AGENTS.md`, and `projects/external-board/package.json` emit runnable commands and documentation links pointing to the resolved installation path of the skill.

### Requirement: Opt-In Authoring Plugin Injection Slot
`packages/core` (`template-shell.html` and `build-report.mjs`) SHALL expose explicit authoring injection slots (`<!-- {{AUTHORING_MARKUP}} -->` and `<!-- {{AUTHORING_SCRIPT}} -->`) and an `--editable` / `editable` option so `@html-report/studio` (or live `serve-report` sessions) can inject Edit Mode, element selection, styling overrides, and AI reconnection without baking authoring chrome into static default builds.

#### Scenario: Compiling or serving an editable workspace injects the Studio authoring plugin
- **WHEN** a report is compiled with `--editable` (or served by `packages/studio` in authoring mode)
- **THEN** the authoring dock (`#edit-dock`), `#all-settings-modal`, and `authoring-plugin.js` are injected into the shell slots so Edit Mode and queue workflows operate seamlessly.

### Requirement: Explicit Mirroring Option Instead of Implicit Studio Coupling
`build-report.mjs` SHALL NOT inspect `REPO_ROOT/create.html` to implicitly copy `--project` outputs into `projects/<slug>/`; workspace mirroring SHALL occur only when `--mirror-dir <dir>` (or `mirrorDir`) is explicitly supplied by the caller (such as `scaffold-project.mjs` or Studio server routes).

#### Scenario: Standalone core CLI compilation does not trigger studio mirroring
- **WHEN** `build-report.mjs --project sample` runs from an external directory without `--mirror-dir`
- **THEN** it writes only to the requested `--output` path without probing for `create.html` or writing into an external `projects/` directory.

### Requirement: Modular Client Runtime & Authoring Chunk Assembly
`packages/core/assets/report-runtime.js` and `packages/studio/assets/authoring-plugin.js` SHALL assemble their inlined browser runtimes deterministically from ordered domain modules (`packages/core/assets/runtime/*.js` and `packages/studio/assets/authoring/*.js`), while preserving all CommonJS/ESM named exports for Node.js tests and zero-external-request standalone HTML output.

#### Scenario: Assembled report inlines all modular runtime chunks cleanly
- **WHEN** `buildReport()` compiles a report using the default `report-runtime.js` (and optionally `--editable` with `authoring-plugin.js`)
- **THEN** the emitted HTML contains a single self-contained inline `<script>` block with all runtime capabilities (`HTMLReportSettings`, `HTMLReportMermaid`, `HTMLReportPublisher`, `HTMLReportBoard`, and theme/PWA/presentation hooks)
- **AND** ESM named imports from `@html-report/core/assets/report-runtime.js` and `@html-report/studio/assets/authoring-plugin.js` resolve every exported symbol identically.

### Requirement: Precision Addon Detection & Explicit Pinning
`detectAddons()` SHALL match only HTML/JS library signatures rather than bare prose tokens, and `buildReport()` / `build-report.mjs` SHALL support `--only-addons <list|none>` and `--no-auto-addons` to bypass content auto-detection when desired.

#### Scenario: Prose report mentions library names without loading unused CDNs
- **WHEN** `buildReport()` processes prose containing words such as `"marked"`, `"showdown"`, `"Leaflet"`, `"KaTeX"`, or `"Chart.js"` without DOM/script signatures
- **THEN** `activeAddons` is empty (`[]`) and only the Core 4 shell scripts are emitted.

### Requirement: Direct Mermaid Source File Inclusion
`buildReport()` and `harness.mjs` SHALL resolve external `.mmd` and `.mermaid` files referenced via `data-mermaid-src` / `data-src` on `.mermaid` containers or `<!-- {{MERMAID:...}} -->` / `<!-- @mermaid ... -->` directives before addon detection and rendering.

#### Scenario: Report embeds standalone diagram file without source duplication
- **WHEN** a fragment references `<div class="mermaid" data-mermaid-src="./diagrams/flow.mmd"></div>`
- **THEN** `buildReport()` inlines the `.mmd` source, strips optional code fences, activates the `mermaid` addon, and throws an actionable error if the referenced file does not exist.

### Requirement: Screen-Hidden Print Cover Verification
`template-shell.html` SHALL hide `#print-cover-page` and `.print-only-summary` by default in `@media screen`, and both `core:structure` and `core:print-pdf` SHALL fail verification if `#print-cover-page` is visible during normal screen viewing.

#### Scenario: Screen-visible print cover fails automated verification
- **WHEN** a report renders `#print-cover-page` with a visible computed `display` in `@media screen`
- **THEN** `core:structure` and `core:print-pdf` fail with a remediation targeting `#print-cover-page`.

### Requirement: Unambiguous Verification Selection & Non-Filtering `--pdf`
Passing `--pdf <file>` to `verify-report.mjs` SHALL generate the PDF while keeping standard Core + auto-detected checks active, and `--with-core` SHALL keep Core baseline checks enabled when combined with `--check-*` or `--cdns`.
