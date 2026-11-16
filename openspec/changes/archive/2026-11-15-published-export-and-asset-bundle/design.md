# Design: Asset-Aware Publish Pipeline & Standalone Export Fidelity

> **Change:** `2026-11-15-published-export-and-asset-bundle` | **Proposal:** [proposal.md](proposal.md) | **Delta Spec:** [specs/publish-clean-export/spec.md](specs/publish-clean-export/spec.md) | **Tasks:** [tasks.md](tasks.md)

## Context & Architectural Split

Inspection of [`quilting-101-beginner-workshop-block-guide-published.html`](../../../projects/quilt-101/index.html) revealed two overlapping failure classes:

1. **Runtime & Snapshot Inlining Bugs (affect ALL downloaded HTMLs, with or without assets)**:
   - Client-side `buildInlinedHtmlSnapshot()` (`skills/html-report/assets/report-runtime.js:928-993`) clones the already-mutated live DOM mid-click, converts CDN `<script type="module">` and `<script defer>` tags in `<head>` into synchronous classic inline `<script>` elements, and omits live-reload / AI-button cleanup.
2. **Asset & Multi-Document Dependency Bugs (affect asset-based reports)**:
   - Reports built from reference documents (`projects/quilt-101/refs/` containing images, PDFs, or CSV/MD data) rely on relative paths (`refs/...`) or server APIs (`/events`, `/api/board/state`) that 404 or hit `file://` CORS when opened standalone from a user's `Downloads` folder.

Attempting to solve both purely inside an in-browser DOM serializer has hard limits (browsers on `file://` or plain DOM snapshots cannot gather untouched source fragments or package sibling `refs/` files into a `.zip`). Conversely, relying *only* on a CLI script leaves the navbar **Download as HTML** button broken.

**Chosen Architecture**: Fix client-side snapshot serialization **and** introduce a server/CLI **asset-aware publish pipeline** (`skills/html-report/scripts/publish-report.mjs`) wired into `serve-report.mjs` (`/api/publish`).

---

## Component Design

### 1. Fixing Client-Side Snapshot Serialization (`skills/html-report/assets/report-runtime.js`)

Even when `Download as HTML` falls back offline (under `file://` or static hosts without `serve-report.mjs`), `buildInlinedHtmlSnapshot()` must produce a working document:

1. **Preserve `type="module"` & `defer` Execution Semantics**:
   - In `buildInlinedHtmlSnapshot()`: check `const origType = scriptEl.getAttribute("type");` and `const hasDefer = scriptEl.hasAttribute("defer");`.
   - If `origType` is `"module"` (e.g. Datastar), preserve `inlineScript.setAttribute("type", "module")`—or convert to `<script type="module">...</script>` (note: ES module inline scripts retain `import`/`export` syntax *and* automatically defer until HTML parsing finishes!).
   - If `hasDefer` is true for classic UMD scripts (`alpinejs`, `chart.js`, `mermaid`, `gridjs`, `lucide`), **move those inlined scripts out of `<head>` to the end of `<body>`** (or load via `data:text/javascript;charset=utf-8,...` with `defer`, while respecting CSP `script-src`: since CSP in `template-shell.html` uses `'unsafe-inline'`, placing deferred classic inline scripts at the end of `<body>` in original document order avoids CSP `data:` script blocking AND guarantees `document.body` and all `[x-data]` elements exist before `Alpine.start()` runs!).
   - Ensure end-of-`<body>` execution happens *before* the runtime/fragment initializer expects globals, OR keep the polling initializer in `fragment.html` working identically.

2. **Pre-Serialize Clean State (Avoid Mutated Live DOM Artifacts)**:
   - Do **not** set `htmlBtn.disabled = true` (or `btn.disabled = true`) in `document` *before* cloning—OR explicitly re-enable `#download-html-btn` on `clone` inside `buildInlinedHtmlSnapshot()`.
   - Remove `.dropdown-open`, `open`, and reset `aria-expanded="false"` on `#settings-dropdown`, `#toc-dropdown`, `#settings-section-appearance`, and `#settings-section-download` inside `clone`.
   - Remove `<script id="__html_report_live_reload__">` and `.mermaidTooltip` inside `clone`.
   - Clear `#toolkit-gridjs` (`[data-gridjs="true"]`) cloned inner `.gridjs-container` inside `clone` so `new gridjs.Grid(...).render(el)` mounts into an empty element without Grid.js's `"container is not empty"` abort error.
   - In `HTMLReportMermaid.initEnlarge()` (`report-runtime.js:5558`): if `.mermaid-enlarge-btn` already exists inside `.mermaid-wrapper`, bind the click listener (`if (!btn.__enlargeWired) { btn.__enlargeWired = true; btn.addEventListener(...); }`) instead of skipping when `wrapper.querySelector(".mermaid-enlarge-btn")` is truthy.
   - In `HTMLReportPublisher.stripAuthoringElements()`: when `publishedMode` is active, neutralize orphaned `[data-agent-prompt]` triggers (add `hidden` / `print:hidden` or convert via `data-agent-prompt-hidden` cleanly rather than leaving dead buttons that silently `return` on `!isAiCapable()`).
   - For Alpine `x-for` templates: when serializing a live DOM clone that already stamped `<li>` nodes after `<template x-for>`, strip rendered siblings matching `_x_lookup` or mark/clean generated nodes so Alpine doesn't choke on duplicate un-scoped bindings when re-initializing.
   - Update `HTMLReportBoard` / `#live-board-status` on `file://` init: set badge text cleanly to `"Offline (Local Save)"` and persist state (e.g., workshop checklist) to `localStorage` seamlessly when `isFileProtocol()` is true.

---

### 2. Asset-Aware Publish Script (`skills/html-report/scripts/publish-report.mjs`)

Builds clean published output **from source** (`fragment.html` + `report.manifest.json` + project dir), avoiding live-DOM corruption altogether.

#### Step A: Asset Discovery (`discoverReportAssets(projectDir, html)`)
Inspects the compiled HTML and project directory to determine whether the report is **asset-free** or **asset-based**:
- Checks if `<projectDir>/refs/` contains non-empty files.
- Scans HTML for relative (non-`http:`, non-`data:`, non-`#`, non-`javascript:`) resource attributes (`src="..."`, `href="..."` excluding hash anchors) and relative `fetch("...")` calls inside inline scripts.
- Resolves safe normalized project-relative paths (rejecting traversal outside `projectDir`).

#### Step B: Packaging Branch
- **Case 1 — Asset-Free Report (`assets.length === 0`)**:
  - Builds via `buildReport({ ..., published: true })` (plus optional `--inline-cdn` flag when offline single-file mode is requested via `/api/publish?inline=1`), producing deterministic `<slug>-published.html`.
- **Case 2 — Asset-Based Report (`assets.length > 0`)**:
  - Emits `<slug>-published.zip` containing:
    - `index.html` (clean `--published` build with reader fallbacks & asset recovery script injected)
    - `refs/<file>` (exact relative layout copied from `projects/<slug>/refs/`, or any discovered relative asset path)
  - **Zero external npm dependencies**: Implement a minimal deterministic ZIP archive builder (`createZipBuffer(entries)`) in pure Node using `node:zlib`'s `deflateRawSync` + standard CRC32 table (fixed DOS timestamp for reproducible builds!). This keeps `package.json` zero-dependency and works uniformly on Linux/macOS/Windows without requiring system `zip`.

#### Step C: Reader-First Fallbacks & Missing-Asset Recovery (Injected Only for Asset-Based Exports)
Injected into `index.html` of asset-based bundles (never cluttering asset-free HTMLs):
1. **Inline Data Fallback (`#__html_report_embedded_assets__`)**:
   - Small referenced text/data assets (`.json`, `.csv`, `.md`, `.txt` up to a safe size cap like 512 KB total) are embedded as a JSON map `{ "refs/notes.md": "..." }` inside `<script id="__html_report_embedded_assets__" type="application/json">`.
   - A tiny runtime `window.__resolveReportAsset(path)` / `fetch` fallback wraps relative local asset fetches when `window.location.protocol === "file:"` so browser CORS never breaks data visualizations or markdown viewers.
2. **Broken `<img>` & Missing PDF/Doc Graceful Fallback**:
   - Attach delegated/image `error` listeners to local `<img>` elements: if an image fails to load (`refs/quil2.jpeg`), swap/overlay an accessible placeholder card displaying the `alt` description and expected relative path (`refs/quil2.jpeg`), rather than leaving a collapsed broken icon.
   - Record missing paths in a runtime set.
3. **Reader Recovery Banner ("Assets Needed" Starter Prompt — Triggered Only on Asset Failure)**:
   - On `load` + after `error` listeners settle (~500 ms), **only if one or more relative assets failed to load** (e.g., user dragged `index.html` out of the zip without extracting `refs/`), display a non-intrusive dismissible top banner:
     - Explains plainly for browser readers: *"This report uses external images/documents in `refs/`. Keep `index.html` in the same extracted folder as `refs/`, or locate your `refs/` folder below to restore images and links."*
     - Provides a one-click **"Select `refs/` Folder"** button wired to a hidden `<input type="file" webkitdirectory multiple>` that maps selected filenames to `URL.createObjectURL(file)` in-memory and hot-replaces broken `<img>` `src` and `<a>` `href` links immediately without needing a server!
     - Also notes the optional CLI fallback (`npx serve` / `node ... serve-report.mjs`) for full local hosting.

---

### 3. Server Endpoint Integration (`skills/html-report/scripts/serve-report.mjs`)

- Add `.zip: "application/zip"` to `MIME_TYPES`.
- Add `GET /api/publish` (and `POST /api/publish` accepting current theme / inline preferences):
  - Resolves the active project directory (from query `?project=...` or `servedFilePath`).
  - Runs `publishProject(...)` from `publish-report.mjs`:
    - If asset-free: responds with `Content-Type: text/html; charset=utf-8` and `Content-Disposition: attachment; filename="<slug>-published.html"`.
    - If asset-based: responds with `Content-Type: application/zip` and `Content-Disposition: attachment; filename="<slug>-published.zip"`.
- In `report-runtime.js` (`initDownloadButton()` / `HTMLReportPublisher.downloadPublished()`):
  - When served over `http:`/`https:` with Published toggle ON (and `serve-report.mjs` `/api/publish` returns `200`), trigger download from `/api/publish` (parsing `Content-Disposition` filename cleanly).
  - When on `file://` or if `/api/publish` is unavailable (e.g. standalone file), fall back seamlessly to the repaired client-side `buildInlinedHtmlSnapshot()`.

---

## Risks & Trade-offs

| Decision | Trade-off | Mitigation |
| :--- | :--- | :--- |
| Place deferred inlined scripts at end of `<body>` instead of `<head>` | Slight shift in script placement vs live `<head>` order | Maintains `'unsafe-inline'` CSP compatibility (avoids needing `data:` in `script-src`) while matching `defer` timing after DOM parse |
| Server `/api/publish` builds from source `fragment.html` | Ephemeral unsaved browser state (e.g. manually unchecked UI) isn't baked into HTML | That's desirable for published exports—and checklist/interactive state stays persisted or initialized fresh; offline `file://` download still snapshots fixed DOM |
| Zero-dependency pure-JS ZIP writer (`node:zlib`) | ~80 lines of custom CRC32/PKZIP framing to test carefully | Unit test output against `unzip -t` / standard ZIP magic headers and multi-file roundtrip in Node |
| Optional CDN inlining flag in `publish-report.mjs` | Full offline CDNs add ~2–3 MB to HTML inside zip | Default to fixing inlined scripts cleanly when downloading standalone, and expose `--inline-cdn` so server/client exports stay usable offline |
