# reveal-presentation-fixes Specification

## Purpose
Defines first-class Reveal.js presentation assembly and scaffolding, `#presentation-shell` Fullscreen mode, modeless follow-along Speaker Notes popup modal, multi-mode slide spacing tokens and `reveal.css` cascade guards, dedicated Reveal.js style guide, Leaflet marker CSP compatibility, embedded slide widget/TOC runtime hooks, accurate `preflight.mjs` Playwright detection, and manifest `favicon` persistence.

## Requirements

### Requirement: First-Class Reveal.js Presentation Addon & Scaffolding
`build-report.mjs` and `scaffold-project.mjs` MUST support Reveal.js (`reveal` addon) as the default engine for `--mode presentation`, while preserving explicit `--impress` support for legacy 3D decks.

#### Scenario: Building a Reveal.js presentation without manual fragment CDN tags
- **GIVEN** a fragment containing `<div class="reveal" id="presentation-deck"><div class="slides"><section>...</section></div></div>`
- **WHEN** `build-report.mjs --mode presentation` compiles the fragment
- **THEN** `<head>` includes the pinned Reveal.js CSS and JS assets from `ADDON_REGISTRY.reveal`
- **AND** `impress.js` is NOT injected unless `#impress` signatures or `--impress` are present.

#### Scenario: Scaffolding a new presentation project
- **GIVEN** `scaffold-project.mjs --project demo-deck --mode presentation` is executed
- **WHEN** `projects/demo-deck/fragment.html` is generated
- **THEN** it contains `#presentation-shell`, presentation controls (Fullscreen, Notes, All Slides), and a Reveal.js `.reveal > .slides > section` starter structure with inner `.slide-body` flex-layout wrappers (`min-h-full w-full max-w-6xl mx-auto flex flex-col`) and sample `<aside class="notes">` blocks.

### Requirement: Fullscreen Presentation Shell & Layout Reflow
Every Reveal.js presentation compiled in `presentation` mode MUST support a Fullscreen toggle (`#presentation-fullscreen-btn` and `F` shortcut) rooted at `#presentation-shell` so both slides and presenter overlays remain visible in fullscreen, with automatic layout and widget reflow.

#### Scenario: Entering and exiting Fullscreen mode via button or F key
- **GIVEN** a Reveal.js presentation rendered in `presentation` mode
- **WHEN** the presenter clicks the Fullscreen button or presses `F` (with focus outside text inputs)
- **THEN** `#presentation-shell` enters native browser Fullscreen (or activates `.is-fullscreen` `100vw × 100dvh` fallback when Fullscreen API is unavailable/blocked), exiting `.is-stacked` if active
- **AND** `#presentation-shell` displays a compact Fullscreen HUD (slide counter, Prev/Next, Notes toggle, Exit Fullscreen) without obscuring slide content
- **AND** `revealInstance.layout()`, registered Leaflet maps (`invalidateSize()`), and `window.reportCharts` (`resize()`) re-measure to fit the fullscreen viewport.

### Requirement: Follow-Along Speaker Notes Popup Modal
Reveal.js presentations MUST provide a modeless floating Speaker Notes popup modal (`#presentation-notes-modal`) inside `#presentation-shell` that stays open across slide transitions, updates live on every slide change (horizontal and vertical), and remains non-blocking so slide navigation continues uninterrupted.

#### Scenario: Opening the Notes popup and following along across slides
- **GIVEN** a Reveal.js deck with `<aside class="notes">` (including rich HTML lists/emphasis) and/or `data-notes="..."` on slides (including vertical sub-slides)
- **WHEN** the presenter clicks the Notes toggle button or presses `N` and navigates across slides
- **THEN** `#presentation-notes-modal` opens as a non-blocking floating popup (`aria-modal="false"`) visible in both normal and Fullscreen modes
- **AND** its header, sanitized rich notes body, and "Up Next" cue update automatically on each `slidechanged` event to match the active horizontal/vertical slide (or show a clean empty state when a slide has no notes)
- **AND** keyboard (`←`/`→`/`↑`/`↓`/`Space`) and slide click interactions remain active while the notes popup is open.

#### Scenario: Published HTML export preserves presentation fullscreen and notes
- **GIVEN** a Reveal.js presentation compiled with `build-report.mjs --mode presentation --published`
- **WHEN** the published file is opened standalone (including over `file://`)
- **THEN** authoring chrome (`#edit-dock`, `#settings-dropdown`) is removed, while `#presentation-fullscreen-btn`, `#presentation-notes-modal`, and keyboard shortcuts (`F`, `N`) remain fully functional.

### Requirement: Standardized Multi-Mode Slide Spacing, Cascade Guards & Style Guide
Every Reveal.js presentation MUST apply responsive spacing tokens (`--slide-pad-x`, `--slide-pad-top`, `--slide-pad-bottom`, `--slide-gap`) and inner `.slide-body` layout protection across Embedded, Fullscreen, Stacked, and Print modes without `reveal.css` overrides breaking Tailwind/DaisyUI spacing or `.leaflet-tile` sizing, and MUST be documented in a dedicated style guide (`skills/html-report/references/reveal-presentation-style-guide.md`).

#### Scenario: Slide padding, safe-zone clearance, cascade isolation & verification
- **GIVEN** a Reveal.js presentation compiled with `.reveal-stage` and `.slide-body` wrappers
- **WHEN** rendered at desktop viewports (`1280×800`, `1440×900`) and checked by `verify-report.mjs`
- **THEN** every `<section>` has horizontal padding `>= 24px` and bottom safe-zone clearance (`>= 52px` / `3.25rem+`) above `.controls`, `.slide-number`, and `.progress`
- **AND** slide content does not clip or overflow vertically (`section.scrollHeight <= section.clientHeight + 2`) or overlap `.controls` / `.slide-number`
- **AND** in Fullscreen mode `.slide-body` centers cleanly within `max-w-6xl`, while in `.is-stacked` and `@media print` slides render as separated cards with `break-inside: avoid`
- **AND** `skills/html-presentation/SKILL.md` and `skills/html-report/SKILL.md` link directly to `skills/html-report/references/reveal-presentation-style-guide.md`.

### Requirement: Embedded Reveal.js Widget & TOC Synchronization
When Reveal.js is active inside the DaisyUI template shell, hidden-slide widgets (Leaflet maps and Chart.js canvases) and navbar TOC links MUST synchronize automatically on slide transitions.

#### Scenario: Switching to a slide containing Leaflet or Chart.js
- **GIVEN** a Reveal.js slide deck where `#map` or a `<canvas>` resides on Slide 2 or later
- **WHEN** the user navigates to that slide via keyboard, controls, or navbar TOC link
- **THEN** Reveal.js switches to that slide, calls `invalidateSize()` on Leaflet maps and `resize()` on `window.reportCharts`, and keeps Leaflet panes below the `z-50` sticky navbar.

### Requirement: Leaflet Marker CSP Compliance
Default `L.marker()` icons and shadows MUST load without Content Security Policy `img-src` violations in `template-shell.html`.

#### Scenario: Rendering standard Leaflet markers under strict CSP
- **GIVEN** a report compiled with `template-shell.html` using `L.marker([lat, lng])`
- **WHEN** `verify-report.mjs` runs against the compiled file
- **THEN** 0 CSP console errors are emitted for `marker-icon.png` or `marker-shadow.png`.

### Requirement: Accurate Preflight Playwright Detection & Favicon Persistence
`preflight.mjs` MUST locate Playwright installed under `skills/html-report/playwright/node_modules/`, and `build-report.mjs` MUST persist custom `--favicon` values across `--project` rebuilds.

#### Scenario: Detecting Playwright from skills/html-report/scripts/preflight.mjs
- **GIVEN** Playwright Chromium is installed under `skills/html-report/playwright/node_modules/playwright`
- **WHEN** `node skills/html-report/scripts/preflight.mjs --json` executes
- **THEN** `browser.ready` reports `true` with `strategy: "playwright-bundled"` and the resolved executable path.

#### Scenario: Rebuilding a project preserves custom favicon
- **GIVEN** a project built with `--project sky-project --favicon "⛷️"`
- **WHEN** `build-report.mjs --project sky-project` is later invoked without repeating `--favicon`
- **THEN** `report.manifest.json` retains `"favicon": "⛷️"` and the rebuilt `index.html` renders the `"⛷️"` favicon.
