# Tasks: Reveal.js Presentation Support, Fullscreen & Follow-Along Notes, Spacing & Style Guide, Leaflet CSP & Pipeline Ergonomics

## Phase 1: First-Class Reveal.js Addon, Shell & Spacing System
- [x] 1.1 Register `reveal` (`reveal.js@5.1.0` CSS + JS) in `ADDON_REGISTRY` in `skills/html-report/scripts/build-report.mjs` and route `--mode presentation` to `reveal` (keeping `--impress` opt-in for `#impress` decks)
- [x] 1.2 Add `#presentation-shell`, embedded `.reveal-stage`, multi-mode spacing tokens (`--slide-pad-x`, `--slide-pad-top`, `--slide-pad-bottom` `>= 3.75rem`, `--slide-gap`), `.slide-body` flex wrapper rules, scoped `reveal.css` cascade guards (protecting DaisyUI cards, lists & `.leaflet-tile`), `.is-stacked` card framing, and `@media print` stacking in `skills/html-report/assets/template-shell.html`
- [x] 1.3 Add `slidechanged` widget resize hooks (`Leaflet.invalidateSize()` + `window.reportCharts` `resize()`) and navbar TOC-to-slide navigation in `skills/html-report/assets/report-runtime.js`
- [x] 1.4 Update `skills/html-report/scripts/scaffold-project.mjs` to emit `#presentation-shell`, presentation controls (Fullscreen, Notes, All Slides), `.reveal > .slides > section` starter slides with `.slide-body` wrappers, generous spacing rhythm, and sample `<aside class="notes">` blocks

## Phase 2: Fullscreen Mode & Follow-Along Speaker Notes Popup Modal
- [x] 2.1 Add `#presentation-shell` fullscreen CSS (`:fullscreen`, `:-webkit-full-screen`, `.is-fullscreen` `100vw × 100dvh` fallback, `max-w-6xl` `.slide-body` centering) and compact Fullscreen mini-HUD in `skills/html-report/assets/template-shell.html`
- [x] 2.2 Implement `initPresentationShell()` in `skills/html-report/assets/report-runtime.js` wiring `#presentation-fullscreen-btn`, `F` shortcut, exiting `.is-stacked` on entry, and running `Reveal.layout()`, `Leaflet.invalidateSize()`, and `Chart.resize()` on `fullscreenchange`
- [x] 2.3 Implement the modeless `#presentation-notes-modal` (`role="dialog" aria-modal="false"`) inside `#presentation-shell` with sanitized `<aside class="notes">` HTML + `data-notes` extraction for horizontal and vertical slides, "Up Next" cue, inline Prev/Next controls, font-size toggle, and corner/side docking (`bottom-right`, `bottom-left`, `side-right`)
- [x] 2.4 Wire `#presentation-notes-btn` (with has-notes indicator badge), `N` shortcut, `Esc` precedence, and Reveal `ready`/`slidechanged` listeners in `skills/html-report/assets/report-runtime.js`, ensuring `--published` exports preserve fullscreen and notes UI

## Phase 3: Dedicated Style Guide & Skill Alignment
- [x] 3.1 Author `skills/html-report/references/reveal-presentation-style-guide.md` covering `embedded: true` + `disableLayout: true`, `.slide-body` specificity rules, multi-mode spacing tokens & safe zones, typography/density budgets, Fullscreen + Follow-Along Notes authoring, widget sizing, and DaisyUI theme bindings
- [x] 3.2 Link `reveal-presentation-style-guide.md` from `skills/html-presentation/SKILL.md` and `skills/html-report/SKILL.md`, and update examples to use `.slide-body` wrappers and safe-zone guidance

## Phase 4: Leaflet CSP, Preflight, Favicon & Verification
- [x] 4.1 Allow `https://unpkg.com` in `img-src` CSP and cap `.leaflet-container` pane z-index below `z-50` in `skills/html-report/assets/template-shell.html`, and document `L.divIcon` in `skills/html-report/references/architecture-and-styling.md`
- [x] 4.2 Update `detectBrowserReadiness()` in `skills/html-report/scripts/preflight.mjs` to resolve `playwright` from `skills/html-report/playwright/node_modules/playwright/index.mjs` when not in root `node_modules`
- [x] 4.3 Persist `favicon` in `report.manifest.json` (`buildAgentManifest`) and restore it on `build-report.mjs --project <slug>` rebuilds, and avoid truncating `--title` in `skills/html-report/assets/create.html`
- [x] 4.4 Extend `skills/html-report/playwright/verify-report.mjs` and `tests/` to verify Reveal.js `--mode presentation`, fullscreen reflow, modeless notes popup live sync across horizontal & vertical slides, `--published` parity, slide padding floors, zero vertical overflow, zero `.controls`/`.slide-number` overlap, Leaflet `L.marker()` CSP compliance, `preflight.mjs`, `--favicon` persistence, and `waitUntil: "load"` on live SSE URLs
