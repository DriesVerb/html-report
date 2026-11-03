# Tasks: CDN Addons Expansion (Day.js, Impress.js, Mock.js, Showdown, FullCalendar)

## Phase 1: Addon Registry & CLI Build Integration
- [ ] 1.1 Register Day.js CDN bundle and relativeTime/customParseFormat plugins in `ADDON_REGISTRY`.
- [ ] 1.2 Register Impress.js CDN bundle in `ADDON_REGISTRY` with viewport-safe container styles.
- [ ] 1.3 Register Mock.js CDN bundle in `ADDON_REGISTRY` with client-side mock interception.
- [ ] 1.4 Register Showdown CDN bundle in `ADDON_REGISTRY` with markdown converter signatures.
- [ ] 1.5 Register FullCalendar 6 CDN bundle and CSS variables in `ADDON_REGISTRY` with misspelling aliases (`fullcalender`, `calendar`).
- [ ] 1.6 Update `detectAddons()` in `skills/html-report/scripts/build-report.mjs` with precise auto-detection regexes.

## Phase 2: Runtime Initialization & DaisyUI Theme Sync
- [ ] 2.1 Update `report-runtime.js` to expose initialization helpers for `dayjs`, `impress`, `Mock`, `showdown`, and `FullCalendar`.
- [ ] 2.2 Wire DaisyUI theme switcher to dynamically update FullCalendar CSS custom properties and re-render calendar instances.
- [ ] 2.3 Implement container scoping for embedded Impress.js presentations to prevent hijacking report body scroll.
- [ ] 2.4 Verify graceful offline degradation if CDN scripts fail to load in restricted network sandboxes.

## Phase 3: Automated Unit & CLI Tests
- [ ] 3.1 Add unit tests in `tests/build-report.test.mjs` verifying auto-detection signatures for all 5 new addons.
- [ ] 3.2 Add unit tests verifying CLI aliases (`--addons fullcalender`, `mock`, `day`, `impressjs`).
- [ ] 3.3 Add unit tests verifying multi-addon co-existence (e.g. Marked and Showdown together).
- [ ] 3.4 Run test suite and assert 100% test pass rate.

## Phase 4: Showcase Examples & Documentation
- [ ] 4.1 Add an interactive demo section for Day.js, Impress.js, Mock.js, Showdown, and FullCalendar in `skills/html-report/examples/example.html`.
- [ ] 4.2 Update `skills/html-report/SKILL.md` with capabilities, CDN table, auto-detection signatures, and code snippets.
- [ ] 4.3 Update `README.md` ecosystem library count and feature highlights.
- [ ] 4.4 Build and verify companion `index.html` report and sync to `localhost:3000`.
