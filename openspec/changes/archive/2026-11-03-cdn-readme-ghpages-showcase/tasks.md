# Tasks: CDN Documentation, GitHub Pages Parity & Showcase

## Phase 1: README.md Updates
- [x] 1.1 Add prominent GitHub Pages link and badge (`https://driesverb.github.io/html-report/`) at the top of README.md
- [x] 1.2 Update CDN stack documentation to 16 libraries including Day.js, Impress.js, Mock.js, Showdown, and FullCalendar
- [x] 1.3 Add Cryptographic Security (SRI, CSP, and No-Referrer) section to README.md
- [x] 1.4 Update test metrics (144 tests passing in ~2s) and fix stale 11-CDN references

## Phase 2: Reference Example (`example.html`) Parity
- [x] 2.1 Verify `skills/html-report/examples/example.html` contains all 16 CDN showcase sections
- [x] 2.2 Verify interactive initializers and scripts for Chart.js, Leaflet, Grid.js, KaTeX, Marked, Highlight.js, and CSV dashboard

## Phase 3: GitHub Pages (`index.html`) Upgrade
- [x] 3.1 Update `index.html` head with new CDN scripts, stylesheets, SRI hashes, CSP, and `no-referrer`
- [x] 3.2 Update `index.html` titles and Section 1 CDN directory grid to 16 cards (4-column responsive layout)
- [x] 3.3 Add Section 11 (Day.js, Impress.js, Mock.js, Showdown, FullCalendar) to `index.html`
- [x] 3.4 Wire runtime initializers in `index.html` for Day.js, Mock.js, Showdown, FullCalendar, and theme sync
- [x] 3.5 Update Grid.js benchmark table to list all 16 libraries

## Phase 4: Verification & Integrity Testing
- [x] 4.1 Run unit and integration test suite (`node --test tests/*.test.mjs`)
- [x] 4.2 Verify `index.html` and `example.html` in headless Chromium with zero console errors
- [x] 4.3 Verify responsive behavior across all 5 breakpoints

## Phase 5: Journey State, Archive & Git Sync
- [x] 5.1 Build companion `index.html` and sync with `implementation-progress.html`
- [x] 5.2 Archive change to `openspec/changes/archive/2026-11-03-cdn-readme-ghpages-showcase`
- [x] 5.3 Commit all changes and push to `origin/main`
