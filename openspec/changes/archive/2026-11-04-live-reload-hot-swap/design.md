# Technical Design: Live-Reload Hot Swap & Pre-Paint Theme Restore

## Context

See [proposal.md](./proposal.md) (Why). Current state before this change:

- The [template-shell.html](../../../skills/html-report/assets/template-shell.html) hard-codes `<html data-theme="light">`. The runtime is inlined at the end of `<body>`, after the synchronous Tailwind CDN script, and restores `html_report_active_theme` in `scanAndRegisterExistingCustomThemes()` at `DOMContentLoaded`. So the first paint is always `light`.
- `injectLiveReload()` in `serve-report.mjs` listens on the `/__live_reload__` SSE stream and calls `window.location.reload()` on every `reload` event.
- Report content lives in a single `<main>`. Report-specific inline scripts (for example Chart.js setup) sit inside `<main>`, and the runtime script follows it.
- Constraint from the project: no npm or bundler for reports. Everything comes from CDNs, and the shell's CSP already allows `cdn.jsdelivr.net`.

## Goals / Non-Goals

**Goals:**
- No theme flash on any reload, whether hot or full.
- Keep the user's place (scroll, theme, open dropdowns) when only content changed.
- Never show stale or broken content: when unsure, fall back to a full reload.

**Non-Goals:**
- Re-running changed inline scripts in place (true module HMR).
- Preserving state inside JS-generated widgets whose *data* changed (charts, calendars, maps) without a full reload.
- Changing behaviour of static `print`/`report` deliverables beyond the pre-paint theme script.

## Decisions

### D1: Pre-paint theme script in `<head>` (before the DaisyUI stylesheet)
A tiny inline IIFE right after `<meta charset>` reads `html_report_active_theme` and sets `data-theme` on `<html>`. It runs before any CSS is applied, so the first frame is already correct.
- *Alternative: bake the theme into HTML at build time.* Rejected: the build can't see the browser's `localStorage`, and different viewers have different themes.
- *Alternative: hide the body until the runtime is ready.* Rejected: it swaps a colour flash for a blank flash and delays first paint.

### D2: Morph `<main>` with Idiomorph instead of reloading (Vite-style)
On `reload`, the client fetches the page (`cache: no-store`), parses it with `DOMParser`, and calls `Idiomorph.morph(currentMain, nextMain)`. Identical nodes stay in place, so focus, scroll and Alpine state survive.
- *Alternative: Vite.* Rejected: there is no "Vite CDN". Vite is a Node dev server plus bundler, which would add npm and a build step against the project's CDN-only constraint.
- *Alternative: `innerHTML` replacement of `<main>`.* Rejected: it destroys every node, including canvases holding live charts, and visibly flickers.
- *Alternative: Datastar fragment morphing.* Datastar is only loaded on `live-report` pages. Idiomorph is a ~3 KB on-demand load that works for every mode.

### D3: Safety signature decides hot swap vs. full reload
The client compares a signature of the *raw server HTML*: all `<head>` stylesheets, `script[src]`, `<style>`, and the text of every inline `<script>` (excluding the live-reload script). It compares against a baseline fetched when the page loads. If anything differs, it does a full reload.
- The signature is taken from raw HTML, never the live DOM, because Tailwind CDN and Mermaid inject `<style>` nodes at runtime and would make every comparison fail.

### D4: Preserve JS-generated widgets during morph
`beforeNodeMorphed` skips `<canvas>`, `.fc` (FullCalendar), `.leaflet-container`, `.gridjs-container`, and any element marked `data-hot-keep`. Their generated DOM would otherwise be reset to empty server markup. This is safe because D3 guarantees that the scripts driving them are unchanged.

### D5: Runtime re-init hook `reinitReportContent()`
After a morph, the client calls `window.reinitReportContent()`, which re-runs only content-level hydration: Lucide icons, TOC, highlight.js, Day.js, markdown auto-links, Mermaid (re-rendered from its stored source), and space detection. Navbar, theme and download wiring are left alone because they live outside `<main>`.

### D6: Scroll-restoring full-reload fallback
Before any fallback reload, the client stores `scrollY` in `sessionStorage` (one key per path). After the reload it sets `history.scrollRestoration = "manual"` and re-applies the position until `window.__REPORT_READY__` is set (capped at 4 s), so async chart and Mermaid layout shifts don't move the user.

## Risks / Trade-offs

- [Idiomorph CDN unreachable] → Falls back to the full reload with scroll restore (D6).
- [A JS-generated widget not in the D4 skip list gets reset by the morph] → Mark it `data-hot-keep`. A full browser refresh always recovers.
- [Content-only edits to `<main>` that a widget reads at init time (for example a `data-*` config on a canvas) won't re-initialise that widget] → Accepted for live preview; a manual refresh applies it. A later change could treat `data-*` changes on kept nodes as part of the signature.
- [Baseline fetch races a file write right after page load] → Worst case is one unnecessary full reload.
- [Rapid successive `reload` events] → Serialised: a busy flag queues at most one follow-up swap.

## Migration Plan

- No migration needed. The hot swap is live as soon as the dev server restarts.
- The pre-paint script reaches existing reports when they are rebuilt with `build-report.mjs`.
- Rollback: revert the three touched files. Nothing persistent changes apart from a transient `sessionStorage` key.
