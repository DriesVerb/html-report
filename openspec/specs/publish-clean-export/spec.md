# publish-clean-export Specification

## Purpose
Defines the Publish mode toggle and deterministic export stripping of editing, settings, and ephemeral verification chrome.

## Requirements

### Requirement: Set as Published Toggle

The system SHALL satisfy: The system SHALL provide a 'Publish' control in the Settings panel allowing authors to mark the report as published.

#### Scenario: Set as Published Toggle verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** the system SHALL provide a 'Publish' control in the Settings panel allowing authors to mark the report as published.

### Requirement: Deterministic Clean Download

Because `packages/core` compiles reports clean-by-default (viewer-only chrome without `#edit-dock`, `#all-settings-modal`, or AI Bridge unless `--editable` / `--ai` is requested), `publish-report.mjs` and `build-report.mjs --published` SHALL produce clean published deliverables directly from source assembly with `editable: false` and `ai: false`, retaining `#settings-gear-btn`, `#settings-section-appearance`, and `#settings-section-download` while eliminating redundant HTML comment-marker stripping pipelines across three separate modules.

#### Scenario: Clean source rebuild and offline fallback parity

- **GIVEN** a report served locally via `serve-report.mjs`
- **WHEN** an author clicks **Download as HTML** with Publish mode enabled
- **THEN** the client requests the clean build from `/api/publish` instead of shipping mutated live-session DOM artifacts
- **AND** when opened directly via `file://` (no local server), **Download as HTML** uses the fixed `buildInlinedHtmlSnapshot()` path without leaving `#download-html-btn` disabled or `#settings-dropdown` stuck open.

#### Scenario: Publishing an editable Studio workspace via publish-report.mjs or /api/publish

- **GIVEN** a project workspace (`fragment.html` + `report.manifest.json`) that includes Edit Mode and AI dock during live authoring in `packages/studio`
- **WHEN** `publish-report.mjs` or `POST /api/publish` produces the published deliverable
- **THEN** it invokes `buildReport({ ..., editable: false, ai: false, published: true })` from `@html-report/core/build`
- **AND** emits a deterministic single `.html` (when asset-free) or `.zip` bundle (when local `refs/` assets exist) containing zero authoring chrome and preserving all reader features.

### Requirement: Deterministic Serialization

The system SHALL satisfy: The clean download generation MUST be deterministic, producing identical byte output for identical document content without timestamps or random tokens.

#### Scenario: Deterministic Serialization verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** the clean download generation MUST be deterministic, producing identical byte output for identical document content without timestamps or random tokens.

### Requirement: CLI Published Flag

The system SHALL satisfy: The build pipeline `build-report.mjs` SHALL support a `--published` flag to emit the clean gear-free report directly.

#### Scenario: CLI Published Flag verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** the build pipeline `build-report.mjs` SHALL support a `--published` flag to emit the clean gear-free report directly.

### Requirement: Preservation of Reader Features

Published HTML exports (whether assembled via `build-report.mjs --published`, `publish-report.mjs`, `/api/publish`, or client-side **Download as HTML** `buildInlinedHtmlSnapshot()`) MUST preserve all reader-facing interactive capabilities identically to the live authored report—including ES module frameworks (Datastar), deferred libraries (AlpineJS), interactive tables (Grid.js), charts (Chart.js), Mermaid diagram theme-sync and **Enlarge** modal, TOC navigation, theme switcher, and print styles—without baking transient UI state, authoring triggers, or dev-server reload scripts into the snapshot.

#### Scenario: Inlined ES module and deferred scripts initialize in valid DOM order

- **GIVEN** a report containing `<script type="module" src="...datastar.js">` and `<script defer src="...alpinejs...">` (plus `chart.js`, `mermaid`, `gridjs`)
- **WHEN** the report is published or downloaded as a standalone HTML snapshot
- **THEN** Datastar retains `type="module"` (or module-safe execution without `SyntaxError: Unexpected token 'export'`)
- **AND** formerly `defer`red scripts (including AlpineJS) do not execute synchronously inside `<head>` before `<body>` is parsed; all `x-data`, `@click`, `x-model`, and `data-signals` controls function normally on open.

#### Scenario: Pre-rendered widgets and navbar controls are clean on open

- **GIVEN** an interactive live session where Grid.js (`#toolkit-gridjs`), Mermaid `.mermaid-enlarge-btn`, Alpine `x-for` lists, `#settings-dropdown`, or `#download-html-btn` are currently rendered/open/busy
- **WHEN** the user triggers **Download as HTML** or runs `publish-report.mjs`
- **THEN** `#download-html-btn` is NOT serialized with `disabled=""`
- **AND** `#settings-dropdown` is NOT serialized with `dropdown-open` or `aria-expanded="true"`, and `#settings-section-download` is collapsed
- **AND** Grid.js containers are clean/empty before re-hydration so `new gridjs.Grid(...).render(el)` mounts search, sort, and pagination without `"container element is not empty"` errors
- **AND** `HTMLReportMermaid.initEnlarge()` attaches click handlers to `.mermaid-enlarge-btn` even if the wrapper markup already exists in the HTML
- **AND** `#__html_report_live_reload__` is excluded, `#live-board-status` reflects offline status rather than `"SSE Connected"`, and inert `[data-agent-prompt]` buttons are hidden or converted to a clean offline notice in published mode.

### Requirement: Asset-Aware Publish Script & Conditional Zip Packaging

The repository MUST provide a dedicated `skills/html-report/scripts/publish-report.mjs` module and CLI (also wired into `serve-report.mjs` via `/api/publish`) that inspects whether a report depends on local relative assets (`refs/` directory, relative `src=`/`href=` targets, or local relative `fetch()` references) and selects the packaging format accordingly.

#### Scenario: Asset-free report publishes as a single standalone HTML file

- **GIVEN** a project or HTML report with zero local relative asset dependencies
- **WHEN** `publish-report.mjs` or `/api/publish` packages the published deliverable
- **THEN** it emits a single self-contained `.html` file (`<slug>-published.html`) with no unnecessary `.zip` wrapper.

#### Scenario: Asset-based report packages as a zip archive preserving relative paths

- **GIVEN** a project such as `projects/quilt-101/` containing local reference files in `refs/` (`DOC-20260118-WA0001..pdf`, `quil2.jpeg`, `quilt.jpeg`) referenced from `fragment.html` / `index.html`
- **WHEN** `publish-report.mjs` or `/api/publish` publishes the deliverable (or a browser user clicks **Download as HTML** in Published mode)
- **THEN** it produces `<slug>-published.zip` containing `index.html` at the archive root and `refs/...` preserving relative paths so `src="refs/..."` and `href="refs/..."` resolve immediately after extraction.

### Requirement: Reader-First Fallbacks & Missing-Asset Recovery Prompt

Every asset-based published bundle MUST embed browser-first resilience so end-readers experience graceful degradation and clear recovery steps if local assets are unavailable or blocked by `file://` restrictions.

#### Scenario: Small data and markdown references survive file:// CORS via embedded fallback

- **GIVEN** an asset-based report that references local `.csv`, `.json`, or `.md` files via `fetch()`
- **WHEN** published by `publish-report.mjs`
- **THEN** small referenced text/data assets are embedded inside `index.html` under a fallback payload (`#__html_report_embedded_assets__`) and transparently served by runtime fetch helpers when running on `file://`.

#### Scenario: Reader opens asset-based HTML without extracted refs/ folder

- **GIVEN** a reader extracts or opens only `index.html` from an asset-based export so relative `refs/...` images or PDFs fail to load
- **WHEN** relative `<img>` elements fail (`error`) or missing-asset checks detect unreachable local references on an asset-marked report
- **THEN** failed images render an inline fallback card displaying the image's `alt`/caption and missing filename (`refs/quil2.jpeg`)
- **AND** a dismissible reader-friendly recovery prompt/banner appears explaining that the report relies on the accompanying `refs/` folder (with instructions to unzip the archive beside `index.html`, or an interactive **"Select `refs/` folder"** picker via `<input type="file" webkitdirectory>` that rebinds broken image/document URLs to local `ObjectURL`s in-browser)
- **AND** no recovery banner appears when assets load successfully OR when the report is an asset-free standalone HTML.
