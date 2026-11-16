# Proposal: Asset-Aware Publish Pipeline & Standalone Export Fidelity

> **Domain:** `Published Document` & `Assembly Pipeline` | **Beneficiary:** `Hybrid` (Browser End-Readers + Report Authors) | **Two-Axis Classification:** `Standalone File / Zip Bundle` + `Offline / Reader-Resilient` | **Journey Companion:** [index.html](index.html)

## Why

Inspecting an exported report ([`quilting-101-beginner-workshop-block-guide-published.html`](../../../projects/quilt-101/index.html) downloaded from the live dev server) exposed **eight root causes** that break interactivity, UI chrome, and linked documents when a report is published or downloaded for end-readers to open in their browser:

1. **Alpine.js initializes in `<head>` before `<body>` exists**: `buildInlinedHtmlSnapshot()` ([`report-runtime.js`](../../../skills/html-report/assets/report-runtime.js#L983-L986)) turns `<script defer src="...alpinejs...">` into a synchronous inline classic `<script>` in `<head>`. Alpine runs via `queueMicrotask` before `<body>` parses, logs `"Trying to load Alpine before <body> is available"`, and never initializes any `x-data` widgets (`quiltBlockSimulator`, `workshopChecklist`, cut calculators). Pre-expanded live DOM (`disabled="disabled"`, duplicate `x-for` `<li>` nodes) and missing conditional Tailwind classes (`line-through`) compound the failure.
2. **Datastar crashes with `SyntaxError: Unexpected token 'export'`**: `buildInlinedHtmlSnapshot()` drops `type="module"` when inlining `<script type="module" src="...datastar.js">`, causing the ES module `export{...}` statement to throw on parse.
3. **Grid.js tables refuse to mount**: Cloned `#toolkit-gridjs` still holds its rendered `.gridjs-container` DOM, so `new gridjs.Grid(...).render(gridEl)` aborts because `container.childNodes.length > 0`, leaving static, non-sortable HTML.
4. **Settings dropdown stuck open & Download button permanently `disabled`**: `initDownloadButton()` ([`report-runtime.js`](../../../skills/html-report/assets/report-runtime.js#L1192-L1194)) and `HTMLReportPublisher.downloadPublished()` ([`report-runtime.js`](../../../skills/html-report/assets/report-runtime.js#L5889-L5891)) disable the download button *before* cloning `document.documentElement`, while `HTMLReportSettings.initGear()` closes `#settings-dropdown` asynchronously in `setTimeout(..., 0)` *after* snapshot cloning (`dropdown-open` and `open=""` remain baked in).
5. **Mermaid "Enlarge" button is inert**: `.mermaid-wrapper` and `.mermaid-enlarge-btn` are cloned without JS listeners, and `HTMLReportMermaid.initEnlarge()` skips binding when `.mermaid-enlarge-btn` already exists in the DOM.
6. **Dead AI prompt buttons & stale live server state**: `HTMLReportPublisher.stripAuthoringElements()` removes `#agent-dock-container` and `<meta name="html-report-ai">`, but leaves `[data-agent-prompt]` buttons whose `openDock()` handler silently no-ops. Meanwhile `#live-board-status` keeps `"SSE Connected"` offline, and `serve-report.mjs`'s injected `<script id="__html_report_live_reload__">` leaks into downloads and attempts `EventSource("/__live_reload__")` on `file://`.
7. **Broken relative local assets (`refs/...`)**: Reports backed by workspace reference assets (`refs/quil2.jpeg`, `refs/quilt.jpeg`, `refs/DOC-20260118-WA0001..pdf`) ship unresolved relative paths that 404 when saved outside the project folder.
8. **`file://` CORS & missing extraction guidance**: Opening an HTML report that uses `fetch("refs/...")` or opening `index.html` without extracting `refs/` alongside it fails silently for browser readers unless in-HTML fallbacks and a clear recovery prompt are present.

## What Changes

1. **Fix Standalone Runtime & DOM Snapshot Serialization (`skills/html-report/assets/report-runtime.js`)**
   - Preserve `<script type="module">` when inlining ESM dependencies (Datastar) and defer execution of formerly `defer`red inlined scripts until DOM parsing completes (AlpineJS, Chart.js, Mermaid, Grid.js) cleanly without premature `<head>` execution.
   - Clone cleanly *before* toggling transient UI state: never capture `disabled=""` on `#download-html-btn` or `.dropdown-open` on `#settings-dropdown`; strip `#__html_report_live_reload__`; reset live-mutated containers (`.gridjs-container`, rendered SVG clones inside `.mermaid-enlarge-btn` / re-bind `initEnlarge()`, reset pre-expanded Alpine `x-for` output or snapshot pre-hydration DOM); convert or hide inert `[data-agent-prompt]` triggers on published pages; transition `#live-board-status` and `HTMLReportBoard` cleanly to offline `localStorage` mode under `file://`.
   - Ensure dynamic utility classes needed by interactive fragments (e.g., `line-through`) or fallback CSS remain intact when CDN Tailwind is stripped.

2. **Dedicated Asset-Aware Publish Script (`skills/html-report/scripts/publish-report.mjs`)**
   - Add a standalone publish script (usable via CLI and imported by `serve-report.mjs` / `build-report.mjs`) that builds cleanly from project source (`fragment.html` + `report.manifest.json` with `published: true`) instead of cloning an arbitrary dirty live DOM, preserving deterministic builds.
   - Automatically inspect the report + workspace for external/local asset dependencies (`refs/` directory, relative `src=`/`href=`, `fetch(...)` data/markdown references):
     - **No local assets**: Output a single self-contained `<slug>-published.html` (no extra zip wrapper needed).
     - **Asset-based HTML**: Package a zero-dependency `.zip` bundle (`<slug>-published.zip`) containing clean `index.html` at the zip root alongside `refs/...` preserving relative paths.

3. **Reader-First Asset Fallbacks & Missing-Asset Recovery Prompt (`publish-report.mjs`, `report-runtime.js`)**
   - Only for asset-based HTML bundles:
     - Inline fallback JSON/text payloads (`<script id="__html_report_embedded_assets__" type="application/json">`) for small relative text/data files (`.csv`, `.json`, `.md`) so `fetch()` wrappers still work under `file://` CORS restrictions.
     - Inject lightweight missing-asset resilience: `onerror` handlers on relative `<img>` elements rendering readable caption/alt fallback cards, friendly fallback cards/notices for unavailable PDFs/documents, and a startup **Asset Recovery Banner / Modal** that triggers **only if relative assets fail to load** (for instance if a browser user opened `index.html` without unzipping `refs/`), guiding them to extract the `.zip` alongside `index.html` or pick the unzipped `refs/` folder right in the browser (`<input type="file" webkitdirectory>`).

4. **Server-Backed Publish Endpoint for Browser Downloads (`skills/html-report/scripts/serve-report.mjs`)**
   - Expose `GET`/`POST /api/publish` on the live dev server so clicking **Download as HTML** while served from `serve-report.mjs` downloads either the clean single `.html` (when asset-free) or `<slug>-published.zip` (when asset-based), falling back to the fixed client-side `buildInlinedHtmlSnapshot()` only when offline (`file://`).

## Capabilities

### New Capabilities
- None (extends and hardens the existing `publish-clean-export` capability).

### Modified Capabilities
- `publish-clean-export`: Preserve `<script type="module">` and `defer` semantics, clean widget/DOM state, and offline fallbacks in published HTML; introduce a dedicated asset-aware publish script (`publish-report.mjs`) + server `/api/publish` endpoint that outputs a clean single `.html` when asset-free or a `.zip` bundle (`index.html` + `refs/`) with embedded `file://` fallbacks and a conditional reader recovery prompt when local assets are referenced.

## Impact

- **New Publish Script:**
  - `skills/html-report/scripts/publish-report.mjs` (asset scanner, clean source publish builder, zero-dep `.zip` packer, fallback & recovery injection)
- **Runtime & Server Pipeline:**
  - `skills/html-report/assets/report-runtime.js` (`buildInlinedHtmlSnapshot`, `initDownloadButton`, `HTMLReportPublisher`, `HTMLReportMermaid.initEnlarge`, `HTMLReportBoard`, offline prompt/fallback helpers)
  - `skills/html-report/scripts/serve-report.mjs` (`/api/publish` endpoint + `.zip` MIME handling)
  - `skills/html-report/scripts/build-report.mjs` & `package.json` (optional CLI integration / `publish` bin entry)
- **Tests:**
  - New & updated tests in `tests/` covering published DOM fidelity (`Datastar`, `Alpine`, `Grid.js`, `Mermaid Enlarge`, settings/download button state, no live-reload leak, offline `[data-agent-prompt]` handling), single-file export for asset-free reports, `.zip` bundling + missing-asset fallback UI for asset-based reports (`projects/quilt-101`).
