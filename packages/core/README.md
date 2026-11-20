# `@html-report/core` — Deterministic Assembly, Theme & Linting Engine

`@html-report/core` is the zero-dependency build engine for `html-report`. It compiles a Semantic Fragment (`<main id="report-main">`) and optional metadata into a standalone single-file HTML5 deliverable in under 100ms, lints fragments for layout/theme issues, compiles OKLCH palettes, and bundles offline archives or PWAs.

> **Package Boundary Rule:** `@html-report/core` MUST NEVER import or reference studio packages or server runtimes. Downstream packages import `@html-report/core` exclusively via declared subpaths in [package.json](package.json).

---

## Declared `package.json` Subpath Exports

| Subpath | Target Module | Responsibility |
| :--- | :--- | :--- |
| `@html-report/core` / `@html-report/core/build` | [scripts/build-report.mjs](scripts/build-report.mjs) | `buildReport()`, `buildAgentManifest()`, `stampAgentHooks()`, mode normalization |
| `@html-report/core/harness` | [scripts/harness.mjs](scripts/harness.mjs) | `lintFragment()`, `diagnose()`, `--fast` & static Playwright verification |
| `@html-report/core/theme` | [scripts/theme-compiler.mjs](scripts/theme-compiler.mjs) | OKLCH contrast math, preset custom themes, `--daisyui-custom-themes` compiler |
| `@html-report/core/publish` | [scripts/publish-report.mjs](scripts/publish-report.mjs) | Portable HTML + local assets bundler and store-only ZIP writer |
| `@html-report/core/pwa` | [scripts/generate-pwa.mjs](scripts/generate-pwa.mjs), [scripts/pwa-builder.mjs](scripts/pwa-builder.mjs) | Web App Manifest, Service Worker, SVG icon generator |
| `@html-report/core/compatibility` | [scripts/compatibility.mjs](scripts/compatibility.mjs) | SemVer compatibility checks & `getPackageVersion()` |
| `@html-report/core/env` | [scripts/env.mjs](scripts/env.mjs) | Symlink-safe CLI execution check, Chrome discovery, skill path resolution |
| `@html-report/core/registry` | [scripts/caller-registry.mjs](scripts/caller-registry.mjs) | External project registry tracking builds & upgrades |
| `@html-report/core/runtime` | [assets/report-runtime.js](assets/report-runtime.js) | Client-side runtime loader + `getBundledRuntimeSource()` |

---

## Directory & Module Map (`<= 650` Lines Each)

### 1. Deterministic Report Assembly (`build-report.mjs` -> `scripts/lib/build/`)
- [scripts/build-report.mjs](scripts/build-report.mjs) — Top-level `buildReport()` pipeline orchestrator combining shell template, runtime, addon CDN tags, theme CSS, and agent manifest.
- [scripts/lib/build/addon-registry.mjs](scripts/lib/build/addon-registry.mjs) — CDN addon catalog (`charts`, `mermaid`, `gridjs`, `leaflet`, `katex`, `fullcalendar`, `showdown`, `quill`, `hljs`, `dayjs`, `marked`, `reveal`, `mockjs`, `datastar`, `impress`), SRI tags, and auto-detection from fragment HTML.
- [scripts/lib/build/fragment-sanitizer.mjs](scripts/lib/build/fragment-sanitizer.mjs) — Strips boilerplate wrappers, normalizes `<main id="report-main">` attributes, and repairs common markup hazards.
- [scripts/lib/build/agent-manifest.mjs](scripts/lib/build/agent-manifest.mjs) — Deterministic `data-agent-id` hook stamper, `#agent-manifest` JSON builder, and optional authoring plugin injection (via `require.resolve` when installed).
- [scripts/lib/build/vendor-disk-cache.mjs](scripts/lib/build/vendor-disk-cache.mjs) — On-demand disk vendor downloader for used CDN packages (`Core 4` + detected addons) persisted to `.cache/html-report-cdn/`.
- [scripts/lib/build/cli.mjs](scripts/lib/build/cli.mjs) — CLI flag parser and help printer for `build-report.mjs`.

### 2. Verification & Linting Harness (`harness.mjs` -> `scripts/lib/harness/` & `playwright/harness/`)
- [scripts/harness.mjs](scripts/harness.mjs) — End-to-end verification runner (`--project <slug>` resolution, `--fast` static gate + optional headless browser verification).
- [scripts/lib/harness/fragment-linter.mjs](scripts/lib/harness/fragment-linter.mjs) — Static HTML checks & mechanical auto-fixes (missing heading IDs, bare `<table>`, bare `<canvas>`, outer boilerplate leaks, responsive DaisyUI stepper traps).
- [scripts/lib/harness/diagnostics.mjs](scripts/lib/harness/diagnostics.mjs) — Root-cause fix suggestion engine for lint and runtime layout failures.
- [scripts/lib/harness/server-policy.mjs](scripts/lib/harness/server-policy.mjs) — Startup policy determining whether static deliverable vs live server is appropriate for the target mode.
- [scripts/lib/harness/cli.mjs](scripts/lib/harness/cli.mjs) — CLI parser, `--project <slug>` resolution, `--help`, and formatted console diagnostics output.
- [playwright/harness/cdn-cache.mjs](playwright/harness/cdn-cache.mjs) — Playwright route interceptor (`attachCdnDiskCache()`) serving cached CDN packages from `.cache/html-report-cdn/` in `<1ms`.

### 3. Portable Bundle & ZIP Exporter (`publish-report.mjs` -> `scripts/lib/publish/`)
- [scripts/publish-report.mjs](scripts/publish-report.mjs) — `publishReport()` orchestrator producing standalone `./dist` or `.zip` packages.
- [scripts/lib/publish/asset-discovery.mjs](scripts/lib/publish/asset-discovery.mjs) — Scans HTML for local `src`/`href` assets safely within workspace boundaries.
- [scripts/lib/publish/asset-resilience.mjs](scripts/lib/publish/asset-resilience.mjs) — Rewrites relative asset references and emits offline resilience helpers.
- [scripts/lib/publish/zip-writer.mjs](scripts/lib/publish/zip-writer.mjs) — Zero-dependency pure-JS ZIP archive builder with CRC32.

### 4. Browser Runtime (`assets/report-runtime.js` + `assets/runtime/*.js`)
- [assets/template-shell.html](assets/template-shell.html) — Canonical DaisyUI v4 / Tailwind CDN / Alpine HTML shell (`<!-- {{TITLE}} -->`, `<!-- {{CONTENT}} -->`, etc.).
- [assets/report-runtime.js](assets/report-runtime.js) — CommonJS loader exposing all 63 named helpers (compatible with Node ESM static `cjs-module-lexer`) and `getBundledRuntimeSource()` which concatenates `assets/runtime/01..08.js` in exact order:
  1. [assets/runtime/01-theme-engine.js](assets/runtime/01-theme-engine.js) — Theme state persistence, OKLCH variable helpers, Chart.js/Mermaid theme synchronization.
  2. [assets/runtime/02-theme-switcher.js](assets/runtime/02-theme-switcher.js) — Navbar 32-theme dropdown switcher, search filter, and live-preview binding.
  3. [assets/runtime/03-shell-controls.js](assets/runtime/03-shell-controls.js) — TOC dropdown, fullscreen toggle, smooth scrolling, and responsive table/grid guards.
  4. [assets/runtime/04a-impress-deck.js](assets/runtime/04a-impress-deck.js) — Legacy 3D spatial presentation adapter (`impress.js`).
  5. [assets/runtime/04b-reveal-shell.js](assets/runtime/04b-reveal-shell.js) — Reveal.js presentation toolbar, fullscreen reflow, `N` speaker notes popup, and stacked all-slides toggle.
  6. [assets/runtime/05-cdn-hydrators.js](assets/runtime/05-cdn-hydrators.js) — KaTeX, Highlight.js, FullCalendar, and Quill hydration + `window.reinitReportContent()`.
  7. [assets/runtime/05b-widget-hydrators.js](assets/runtime/05b-widget-hydrators.js) — Zero-JS declarative widget auto-hydrators for `data-chart` (Chart.js), `data-gridjs` (Grid.js), and `data-leaflet` (Leaflet + Esri ArcGIS tiles).
  8. [assets/runtime/06-public-feeds.js](assets/runtime/06-public-feeds.js) — Client-side `#feed-registry` polling for zero-backend dashboards.
  9. [assets/runtime/07-settings-and-mermaid.js](assets/runtime/07-settings-and-mermaid.js) — Mermaid diagram renderer + enlarge modal + report settings drawer.
  10. [assets/runtime/08-publisher-and-board.js](assets/runtime/08-publisher-and-board.js) — Export helpers, Showdown Markdown artifact viewer (`openMarkdownViewer()`), and publisher utilities.

### 5. Standalone Core Tests
All core unit tests live under [tests/](tests/), including [tests/codebase-digestibility.test.mjs](tests/codebase-digestibility.test.mjs) enforcing the `<= 650` line budget across workspace modules.
