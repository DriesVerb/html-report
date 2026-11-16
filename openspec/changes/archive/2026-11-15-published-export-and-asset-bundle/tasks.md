# Tasks: Asset-Aware Publish Pipeline & Standalone Export Fidelity

> **Companion Dashboard:** [index.html](index.html) | **Proposal:** [proposal.md](proposal.md) | **Design:** [design.md](design.md) | **Delta Spec:** [specs/publish-clean-export/spec.md](specs/publish-clean-export/spec.md)

## Phase 1: Fix Client-Side Snapshot & Runtime Initialization (`report-runtime.js`)

- [x] 1.1 Update `buildInlinedHtmlSnapshot()` in `skills/html-report/assets/report-runtime.js` to preserve `type="module"` on ES module scripts (Datastar) and defer execution of `[defer]` classic scripts (`alpinejs`, `chart.js`, `mermaid`, `gridjs`, `lucide`) by placing their inlined tags at the end of `<body>` in document order so `document.body` and `[x-data]` exist before initialization.
- [x] 1.2 Sanitize cloned DOM state in `buildInlinedHtmlSnapshot()` / `HTMLReportPublisher.prepare()`: strip `<script id="__html_report_live_reload__">` and `.mermaidTooltip`, re-enable `#download-html-btn`, close `#settings-dropdown` / `#toc-dropdown` / `<details>` download accordions, clear pre-rendered Grid.js DOM (`[data-gridjs="true"]`) and stale Alpine `x-for` sibling clones, and neutralize/hide inert `[data-agent-prompt]` triggers in published mode.
- [x] 1.3 Fix `HTMLReportMermaid.initEnlarge()` to bind click handlers onto pre-existing `.mermaid-enlarge-btn` buttons idempotently, and ensure `HTMLReportBoard` / `#live-board-status` gracefully show offline local-storage status under `file://` instead of stale `"SSE Connected"`.

## Phase 2: Dedicated Asset-Aware Publish Script (`publish-report.mjs`)

- [x] 2.1 Create `skills/html-report/scripts/publish-report.mjs` with asset dependency detection (`discoverReportAssets()`) inspecting `refs/`, relative `src=`/`href=`, and local `fetch()` asset references, plus optional CDN inlining helper.
- [x] 2.2 Implement a deterministic zero-dependency ZIP archive writer (`createZipBuffer()` using `node:zlib` `deflateRawSync` + CRC32) in `publish-report.mjs`; output single `<slug>-published.html` when asset-free and `<slug>-published.zip` (`index.html` + `refs/...`) when local assets exist.
- [x] 2.3 Inject reader-first fallbacks **only for asset-based bundles**: embedded JSON text/data fallback (`#__html_report_embedded_assets__`) to bypass `file://` CORS on `.csv`/`.json`/`.md`, `<img>` `error` fallback cards with alt caption and filename, and a conditional **Asset Recovery Banner** (triggering only if relative assets fail to load) with zip-extraction guidance and an in-browser `<input type="file" webkitdirectory>` `refs/` folder relinker.

## Phase 3: Server Publish Endpoint & Browser Download Integration (`serve-report.mjs`, `report-runtime.js`)

- [x] 3.1 Add `.zip` MIME type and `GET`/`POST /api/publish` endpoint to `skills/html-report/scripts/serve-report.mjs` delegating to `publish-report.mjs` and returning either `.html` or `.zip` with proper `Content-Disposition` headers.
- [x] 3.2 Update `initDownloadButton()` / `HTMLReportPublisher.downloadPublished()` in `skills/html-report/assets/report-runtime.js` to download via `/api/publish` when connected to `serve-report.mjs` and fall back to the repaired client-side `buildInlinedHtmlSnapshot()` offline.

## Phase 4: Verification & Test Coverage

- [x] 4.1 Add unit & Playwright E2E regression tests covering Datastar module syntax, Alpine interaction, Grid.js mount, Mermaid Enlarge modal, clean Settings/Download state, live-reload removal, single-file asset-free publish, and `projects/quilt-101` `.zip` publish + missing-asset recovery banner (`file://`).
- [x] 4.2 Run the existing and new test suites (`node --test`) plus `verify-report.mjs` on exported artifacts and mark results.
