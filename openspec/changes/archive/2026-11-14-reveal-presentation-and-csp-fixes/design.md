# Design: First-Class Reveal.js Presentation Support, Fullscreen & Follow-Along Notes, Spacing & Style Guide, Leaflet CSP Fix & Pipeline Ergonomics

## Architecture Overview

```text
scaffold-project.mjs (--mode presentation)
  ├── Emits #presentation-shell > toolbar + .reveal-stage > .reveal > .slides > section > .slide-body + aside.notes
  └── Persists favicon + mode + addons in report.manifest.json

build-report.mjs
  ├── ADDON_REGISTRY.reveal (reveal.css + reveal.js@5.1.0, SRI-pinned)
  ├── --mode presentation -> activates "reveal" (keeps --impress opt-in)
  ├── --published preserves #presentation-shell, fullscreen & notes modal (outside authoring markers)
  └── Reads/writes favicon in agentManifest & rebuildCommand

template-shell.html + report-runtime.js
  ├── #presentation-shell (native requestFullscreen() + .is-fullscreen fallback + Fullscreen HUD)
  ├── #presentation-notes-modal (role="dialog", aria-modal="false" modeless popup inside Top Layer)
  │     └── Syncs on ready/slidechanged (horizontal & vertical aside.notes HTML + data-notes + Up Next)
  ├── Spacing Tokens (--slide-pad-x/top/bottom, --slide-gap) across Embedded / Fullscreen / Stacked / Print
  ├── .slide-body flex wrapper & scoped reveal.css normalization guards (cards, lists, .leaflet-tile)
  ├── Reveal slidechanged & fullscreenchange -> Reveal.layout() + L.Map.invalidateSize() + Chart.resize() + TOC jump
  └── CSP img-src allows https://unpkg.com + #map z-index <= 15 below z-50 navbar

Documentation & Verification
  ├── skills/html-report/references/reveal-presentation-style-guide.md (linked from SKILL.md)
  ├── preflight.mjs -> resolves playwright from skills/html-report/playwright/node_modules
  └── verify-report.mjs -> slide padding/overflow/control-overlap, fullscreen, notes sync & SSE waitUntil
```

## Key Technical Decisions

### 1. Reveal.js Addon Registration & Legacy Impress Compatibility
- Add `reveal` to `ADDON_REGISTRY` in `skills/html-report/scripts/build-report.mjs` matching `.reveal`, `Reveal.initialize`, or `id="presentation-deck"`.
- Default `--mode presentation` / `--presentation` to `reveal` unless `#impress` signatures or explicit `--impress` are present, preserving backwards compatibility for existing Impress.js decks.
- In `scaffold-project.mjs`, emit a `#presentation-shell` Reveal.js starter fragment when `mode === "presentation"`, wrapping each slide's content in `<div class="slide-body min-h-full w-full max-w-6xl mx-auto flex flex-col justify-center gap-5 sm:gap-6">` and including starter `<aside class="notes">` blocks.

### 2. Embedded Reveal.js Runtime, Fullscreen Shell & Widget Synchronization
- Initialize Reveal.js with `embedded: true` and `disableLayout: true` inside `.reveal-stage` so Tailwind breakpoints, DaisyUI navbar dropdowns, Leaflet pointer coordinates, and Chart.js hover hitboxes are never distorted by CSS `transform: scale(...)`.
- **Single Fullscreen Ancestor (`#presentation-shell`):** Wrap the presentation toolbar/HUD, `.reveal-stage`, and `#presentation-notes-modal` in `#presentation-shell` (auto-wrapping `.reveal-stage` in `report-runtime.js` if omitted by custom fragments). Calling `requestFullscreen()` on `.reveal` alone hides external toolbars and modals outside the browser's Top Layer; rooting fullscreen on `#presentation-shell` keeps the Notes popup and HUD visible in fullscreen. Provide `.is-fullscreen` (`position: fixed; inset: 0; z-index: 70; width: 100vw; height: 100dvh;`) as a deterministic fallback when Fullscreen API is unavailable/blocked, and exit `.is-stacked` cleanly before entering fullscreen.
- **Reflow & TOC Hooks:** On `slidechanged` and `fullscreenchange` (plus `.is-fullscreen` toggle), trigger `revealInstance.layout()`, `leafletMap.invalidateSize()`, and `window.reportCharts.forEach(c => c.resize())`. In `initTOC()`, jump Reveal.js to the slide owning a target heading `#id` when not in stacked/print view.

### 3. Modeless Follow-Along Speaker Notes Popup Modal (`#presentation-notes-modal`)
- Standard `<dialog>.showModal()` dims and blocks interaction with slides; Reveal's stock `RevealNotes` plugin relies on `window.open()` (which breaks on `file://`, triggers popup blockers, and fails in single-screen fullscreen).
- Implement `#presentation-notes-modal` as a **non-blocking floating popup** (`role="dialog" aria-modal="false"`, `z-index: 80` inside `#presentation-shell`) with:
  - Live synchronization on `ready` and `slidechanged` using `revealInstance.getCurrentSlide()` (supporting horizontal & vertical slides, sanitized `<aside class="notes">` rich HTML, and `data-notes="..."` fallback).
  - Header with current slide number/title, font-size toggle, corner/side docking (`bottom-right`, `bottom-left`, `side-right`), and close button; footer with **"Up Next"** slide title cue and inline Prev/Next buttons.
  - Keyboard coordination (`F` toggles fullscreen, `N` toggles notes modal, `Esc` closes notes modal / exits `.is-fullscreen` without interfering with inputs or `#all-settings-modal`/`#markdown-viewer-modal`).
  - Placed outside `html-report:authoring` markers so `--published` exports retain fullscreen and follow-along notes.

### 4. Multi-Mode Slide Spacing System, `reveal.css` Guards & Style Guide
- Define CSS tokens (`--slide-pad-x`, `--slide-pad-top`, `--slide-pad-bottom`, `--slide-gap`) on `.reveal-stage`:
  - **Embedded:** `clamp(1.75rem, 3.2vw, 3.25rem)` X, `clamp(1.5rem, 2.5vw, 2.5rem)` top, `>= 3.75rem` bottom safe-zone above `.controls`, `.slide-number`, and `.progress`; stage height `clamp(600px, calc(100vh - 10.5rem), 840px)` on desktop.
  - **Fullscreen (`:fullscreen` / `.is-fullscreen`):** `100vw × 100dvh` with `.slide-body` constrained to `max-w-6xl mx-auto` and generous `2.5rem–5rem` X / `4.25rem–5rem` bottom padding.
  - **Stacked (`.is-stacked`) & Print (`@media print`):** Hide `.controls`/`.progress`/`.slide-number`, apply `gap-6 sm:gap-8`, card borders/radius/padding (`1.75rem 2rem`), and `break-inside: avoid`.
- Add scoped `reveal.css` normalization guards inside `.reveal-stage .reveal` so DaisyUI cards, alerts, badges, Tailwind `space-y-*`/`gap-*`, and `.leaflet-tile` images are never distorted by `reveal.css` defaults.
- Author `skills/html-report/references/reveal-presentation-style-guide.md` (parallel to `charts-and-mermaid-style-guide.md`) and link it from `skills/html-presentation/SKILL.md` and `skills/html-report/SKILL.md`.

### 5. Leaflet CSP, Preflight Playwright Lookup & Manifest Favicon Persistence
- Add `https://unpkg.com` to `img-src` in `template-shell.html` CSP, cap `.leaflet-container` panes at `z-index <= 15` below the `z-50` sticky navbar, and document `L.divIcon` in `references/architecture-and-styling.md`.
- In `skills/html-report/scripts/preflight.mjs` (`detectBrowserReadiness()`), resolve `playwright` via `import("playwright")` first, falling back to `pathToFileURL(path.resolve(__dirname, "../playwright/node_modules/playwright/index.mjs"))`.
- Store `favicon` in `report.manifest.json` (`buildAgentManifest`) and restore `saved.favicon` in `build-report.mjs` when `--project` is passed without `--favicon`, while avoiding `--title` truncation in `create.html`.
