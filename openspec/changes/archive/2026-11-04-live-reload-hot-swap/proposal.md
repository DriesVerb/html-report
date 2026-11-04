# Proposal: Live-Reload Hot Swap & Pre-Paint Theme Restore

> Companion journey dashboard (planned, not yet generated): `index.html` in this folder. See [tasks.md](./tasks.md).
>
> **Retroactive change:** the implementation was written before this proposal existed. These artifacts record the decisions that were made and track the remaining verification.

## Why

When the dev server (`serve-report.mjs`) live-reloads a report, the page flashes the default `light` theme before switching back to the user's theme. The scroll position is also often lost. This happens because every file change triggers a full `location.reload()`, and the saved theme is only re-applied at `DOMContentLoaded`, after the first paint. During active work, reports are rebuilt many times a minute, so the flash and scroll jumps make the live dashboard tiring to follow.

## What Changes

- **Pre-paint theme restore:** the report shell applies the saved theme (`localStorage` key `html_report_active_theme`) in `<head>` before any stylesheet renders. Reports with no saved theme still default to `light`.
- **In-place hot swap on live reload:** when a served report changes on disk, the dev server's injected client fetches the new HTML and morphs only `<main>` in place, like Vite's HMR, instead of reloading the tab. Theme, scroll position, and other page state are kept.
- **Safe fallback:** if `<head>` assets or any inline script changed, if the page has no `<main>`, or if the morph library can't be loaded (offline), the client does a full reload and then restores the previous scroll position.
- **Content re-hydration hook:** the runtime exposes a re-init entry point that re-runs content-level hydration (icons, TOC, code highlighting, dates, markdown links, Mermaid, space detection) after a swap.
- No **BREAKING** changes. Static `print`/`report` deliverables are unaffected, apart from gaining the pre-paint theme restore.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `report-generation-core`: the theme requirement now says a previously selected theme is restored before first paint. A new requirement says live reload must preserve theme and scroll position, with a defined fallback.

## Impact

- `skills/html-report/assets/template-shell.html`: early theme script in `<head>`.
- `skills/html-report/assets/report-runtime.js`: new `reinitReportContent()` export.
- `skills/html-report/scripts/serve-report.mjs`: rewritten `injectLiveReload()` client snippet (hot swap + fallback + scroll restore).
- New runtime dependency, dev server only: Idiomorph `0.7.3`, loaded on demand from jsDelivr (already allowed by the shell's CSP). It is never part of built reports.
- Existing built reports pick up the pre-paint script only after a rebuild. The hot swap applies to every page the dev server serves.
