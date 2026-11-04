# Tasks: Live-Reload Hot Swap & Pre-Paint Theme Restore

## 1. Pre-paint theme restore

- [x] 1.1 Add early inline theme script to `<head>` of `template-shell.html` that applies `html_report_active_theme` before CSS loads
- [x] 1.2 Rebuild a report and confirm the script precedes the DaisyUI stylesheet in the output

## 2. In-place hot swap (dev server)

- [x] 2.1 Rewrite `injectLiveReload()` in `serve-report.mjs`: fetch the page, compare the raw-HTML safety signature, then morph `<main>` with Idiomorph 0.7.3 (loaded from CDN on demand)
- [x] 2.2 Skip morphing JS-generated widgets (`canvas`, `.fc`, `.leaflet-container`, `.gridjs-container`, `[data-hot-keep]`)
- [x] 2.3 Serialise rapid `reload` events (busy flag plus one queued follow-up)

## 3. Fallback reload with scroll restore

- [x] 3.1 Save `scrollY` to `sessionStorage` before a fallback reload and restore it until `__REPORT_READY__` (4 s cap)
- [x] 3.2 Fall back when `<head>`/inline scripts change, `<main>` is missing, the CDN is unreachable, or the swap throws

## 4. Runtime re-hydration

- [x] 4.1 Add and export `reinitReportContent()` in `report-runtime.js` (icons, TOC, hljs, Day.js, md links, Mermaid, space check)

## 5. Verification

- [x] 5.1 Syntax-check `serve-report.mjs`, `report-runtime.js`, and the injected client snippet
- [x] 5.2 Run the existing test suite (`node --test tests/*.test.mjs`) with no regressions (199/199 tests pass across all 18 test suites)
- [x] 5.3 E2E: content-only change keeps theme, scroll and page instance; TOC and Mermaid update
- [x] 5.4 E2E: inline-script change does a full reload and restores theme and scroll
- [x] 5.5 `openspec validate live-reload-hot-swap` passes
