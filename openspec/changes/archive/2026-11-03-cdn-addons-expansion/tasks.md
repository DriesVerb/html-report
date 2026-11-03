# Tasks: CDN Addons Expansion (Day.js, Impress.js, Mock.js, Showdown, FullCalendar)

## Phase 1: Addon Registry & CLI Build Integration
- [x] 1.1 Register Day.js CDN bundle and relativeTime/customParseFormat plugins in `ADDON_REGISTRY`.
- [x] 1.2 Register Impress.js CDN bundle in `ADDON_REGISTRY` with presentation mode guard and print-equivalent fallback.
- [x] 1.3 Register Mock.js CDN bundle in `ADDON_REGISTRY` with client-side mock interception.
- [x] 1.4 Register Showdown CDN bundle in `ADDON_REGISTRY` with markdown converter signatures.
- [x] 1.5 Register FullCalendar 6 CDN bundle and CSS variables in `ADDON_REGISTRY` with misspelling aliases (`fullcalender`, `calendar`).
- [x] 1.6 Update `detectAddons()` in `skills/html-report/scripts/build-report.mjs` with precise auto-detection regexes.

## Phase 2: Runtime Initialization & DaisyUI Theme Sync
- [x] 2.1 Update `report-runtime.js` to expose initialization helpers for `dayjs`, `impress`, `Mock`, `showdown`, and `FullCalendar`.
- [x] 2.2 Wire DaisyUI theme switcher to dynamically update FullCalendar CSS custom properties and re-render calendar instances.
- [x] 2.3 Implement container scoping for embedded Impress.js presentations within `.impress-wrapper`.
- [x] 2.4 Verify graceful offline degradation if CDN scripts fail to load in restricted network sandboxes.
- [x] 2.5 Impress.js Presentation Guard & Print Treatment: enforce that Impress.js ONLY activates 3D transitions when explicitly asked (via `--presentation`, `--addons impress`, or `data-presentation="true"`), treating slides identically to printable output in standard/print mode.

## Phase 3: Automated Unit & CLI Tests
- [x] 3.1 Add unit tests in `tests/build-report.test.mjs` verifying auto-detection signatures for all 5 new addons.
- [x] 3.2 Add unit tests verifying CLI aliases (`--addons fullcalender`, `mock`, `day`, `impressjs`).
- [x] 3.3 Add unit tests verifying multi-addon co-existence (e.g. Marked and Showdown together).
- [x] 3.4 Verify Impress.js presentation guard and print-equivalent styling in unit tests.
- [x] 3.5 Run test suite and assert 100% test pass rate.

## Phase 4: Showcase Examples & Documentation
- [x] 4.1 Add an interactive demo section for Day.js, Impress.js, Mock.js, Showdown, and FullCalendar in `skills/html-report/examples/example.html`.
- [x] 4.2 Update `skills/html-report/SKILL.md` with capabilities, CDN table, auto-detection signatures, and code snippets.
- [x] 4.3 Add agent workflow rule in `SKILL.md`: when a user explicitly says they want a presentation, proactively offer the Impress.js CDN (`--addons impress`) with 3D transitions and print-safe fallback.
- [x] 4.4 Update `README.md` ecosystem library count and feature highlights.
- [x] 4.5 Build and verify companion `index.html` report and sync to `localhost:3000`.
