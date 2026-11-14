# Proposal: First-Class Reveal.js Presentation Support, Fullscreen & Follow-Along Notes, Spacing & Style Guide, Leaflet CSP Fix & Pipeline Ergonomics

> **Companion Journey Dashboard:** [index.html](./index.html)
> **Source Field Review:** [projects/sky-project/skill-review.md](../../../projects/sky-project/skill-review.md)

## Why
Running `/html-presentation` end-to-end via `scaffold-project.mjs`, `build-report.mjs`, and `verify-report.mjs`—plus reviewing presenter ergonomics across embedded and fullscreen decks—surfaced seven concrete gaps between documented skill behavior and actual tooling behavior:
1. **Reveal.js vs. Impress.js mismatch:** [skills/html-presentation/SKILL.md](../../../skills/html-presentation/SKILL.md) specifies **Reveal.js** (`.reveal > .slides > section`), yet `build-report.mjs` and `scaffold-project.mjs` still wire `impress.js` for `--mode presentation`, `ADDON_REGISTRY` has no `reveal` entry, and [skills/html-report/SKILL.md](../../../skills/html-report/SKILL.md) still references Impress.js.
2. **No Fullscreen Presentation Mode:** Embedded `.reveal-stage` is height-constrained, and Reveal.js's built-in `F` shortcut only fullscreens `.reveal` itself—hiding external toolbars and modals outside the browser's `:fullscreen` Top Layer, while failing silently without a CSS fallback in restricted iframes or headless environments.
3. **No Follow-Along Speaker Notes Popup Modal:** Reveal.js's stock `RevealNotes` plugin relies on `window.open()` to external files (which breaks on `file://` origins, hits popup blockers, and cannot share a single fullscreen screen), while ad-hoc inline drawers below the stage scroll away, break on vertical sub-slides (`<section><section>`), ignore `data-notes`, and strip HTML formatting.
4. **Cramped Slide Spacing & `reveal.css` Specificity Collisions:** `reveal.css` injects `(0,2,1)` selectors (`.reveal .slides > section { display: block; }`, `.reveal p`, `.reveal ul`, `.reveal img`) that override Tailwind `(0,1,0)` `p-*` and `flex` classes directly on `<section>`, pushing content to the top edge, overlapping `.controls`/`.slide-number`, and forcing cramped `text-xs` layouts with no unified spacing parity across Embedded, Fullscreen, Stacked, and Print modes.
5. **Missing Dedicated Reveal.js Style Guide:** `skills/html-report/references/` has [charts-and-mermaid-style-guide.md](../../../skills/html-report/references/charts-and-mermaid-style-guide.md), but lacks an equivalent best-practices style guide for Reveal.js presentations.
6. **Leaflet default marker CSP block:** `template-shell.html` restricts `img-src` CSP so `https://unpkg.com` is blocked, causing standard `L.marker()` calls (`marker-icon.png`, `marker-shadow.png`) to emit CSP console errors and fail `verify-report.mjs`.
7. **Hidden-slide widget, CLI & Preflight bugs:** Embedded decks need `invalidateSize()` / `chart.resize()` on `slidechanged`, z-index isolation below the `z-50` navbar, and TOC anchor routing to jump to the owning slide; `preflight.mjs` fails to resolve `playwright` from `skills/html-report/playwright/node_modules/`; and `report.manifest.json` does not persist `--favicon`.

## What Changes
1. **First-Class `reveal` Addon, Presentation Shell & Scaffolding**:
   - Register `reveal` (`reveal.js@5.1.0` CSS & JS) in `ADDON_REGISTRY` (`build-report.mjs`), support `--mode presentation` defaulting to Reveal.js (while retaining `--impress` for legacy 3D decks), and emit a clean Reveal.js starter with `.slide-body` inner flex wrappers and sample `<aside class="notes">` blocks in `scaffold-project.mjs`.
   - Add `#presentation-shell` + `.reveal-stage` CSS/runtime hooks (`embedded: true, disableLayout: true`, hidden-slide `Leaflet`/`Chart.js` resize on `slidechanged`, stacked print fallback, TOC-to-slide navigation) in `template-shell.html` / `report-runtime.js`.
2. **Fullscreen Mode & Modeless Follow-Along Notes Popup Modal**:
   - Wrap toolbar/HUD, `.reveal-stage`, and `#presentation-notes-modal` inside `#presentation-shell` so native `requestFullscreen()` (plus `.is-fullscreen` `100vw × 100dvh` fallback) keeps presenter controls and notes visible in the Top Layer, with `F` shortcut, compact Fullscreen HUD, and `fullscreenchange` reflow (`Reveal.layout()`, `Leaflet.invalidateSize()`, `Chart.resize()`).
   - Add a non-blocking floating `#presentation-notes-modal` (`role="dialog" aria-modal="false"`) synced on Reveal `ready` and `slidechanged` across horizontal and vertical slides, rendering sanitized `<aside class="notes">` HTML and `data-notes`, an "Up Next" cue, inline Prev/Next controls, font-size toggle, corner/side docking, `N` shortcut, and `--published` preservation.
3. **Multi-Mode Slide Spacing System, `reveal.css` Guards & Best-Practices Style Guide**:
   - Define adaptive `--slide-pad-x`, `--slide-pad-top`, `--slide-pad-bottom` (`>= 3.75rem` bottom safe-zone), and `--slide-gap` tokens across Embedded, Fullscreen (`max-w-6xl` framing), Stacked (`.is-stacked`), and Print modes, plus `.slide-body` layout wrappers and scoped `reveal.css` normalization guards (protecting DaisyUI cards, lists, typography rhythm, and `.leaflet-tile` images).
   - Author `skills/html-report/references/reveal-presentation-style-guide.md` and link it from `skills/html-presentation/SKILL.md` and `skills/html-report/SKILL.md`.
4. **Leaflet CSP & Marker Compatibility**:
   - Allow `https://unpkg.com` in `template-shell.html` `img-src` CSP, cap `.leaflet-container` panes below the `z-50` sticky navbar, and document `L.divIcon` as a zero-network, theme-aware marker option.
5. **Preflight Playwright Resolution, Manifest Favicon & Presentation Verification**:
   - Update `preflight.mjs` (`detectBrowserReadiness()`) to resolve `playwright` from `skills/html-report/playwright/node_modules/playwright`, persist `favicon` in `report.manifest.json`, avoid truncating `--title` in `create.html`, and extend `verify-report.mjs` to validate slide padding floors, zero vertical overflow, zero `.controls`/`.slide-number` overlap, fullscreen reflow, notes popup live sync, and SSE `waitUntil: "load"`.

## Capabilities
- `reveal-presentation-fixes`: First-class Reveal.js addon & scaffolding, `#presentation-shell` fullscreen mode, modeless follow-along speaker notes popup modal, multi-mode slide spacing tokens & `reveal.css` guards, dedicated Reveal.js style guide, Leaflet CSP marker compatibility, hidden-slide widget/TOC runtime hooks, `preflight.mjs` Playwright resolution, and manifest `favicon` persistence.

## Impact
- **Created:** `skills/html-report/references/reveal-presentation-style-guide.md`
- **Modified:** `skills/html-report/scripts/build-report.mjs`, `skills/html-report/scripts/scaffold-project.mjs`, `skills/html-report/scripts/preflight.mjs`, `skills/html-report/assets/template-shell.html`, `skills/html-report/assets/report-runtime.js`, `skills/html-report/assets/create.html`, `skills/html-report/playwright/verify-report.mjs` (and harness check), `skills/html-report/SKILL.md`, `skills/html-presentation/SKILL.md`, `skills/html-report/references/architecture-and-styling.md`.
- **Tests:** Unit and Playwright regression tests covering Reveal.js `--mode presentation`, fullscreen reflow, modeless notes popup live sync, `--published` parity, multi-mode slide spacing/overflow/control clearance, Leaflet `L.marker()` CSP compliance, `preflight.mjs`, and `--favicon` persistence.
