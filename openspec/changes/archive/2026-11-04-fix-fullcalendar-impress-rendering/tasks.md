# Tasks: Fix FullCalendar Rendering & Impress.js Presentation Guard

## Phase 1: Diagnostics & Harness Fixes
- [x] 1.1 Diagnose FullCalendar rendering and Impress mode lifecycle in browser runtime
- [x] 1.2 Fix `timeout: null` override bug in `skills/html-report/playwright/harness/runner.mjs`

## Phase 2: Impress.js Dynamic Mode Activation & UI Controls
- [x] 2.1 Add `data-presentation` dynamic observer and cleanup in `skills/html-report/assets/report-runtime.js`
- [x] 2.2 Add Next / Previous slide controls and active slide indicators in Impress showcase
- [x] 2.3 Expose global helper methods (`window.impressNext()`, `window.impressPrev()`)

## Phase 3: FullCalendar Robustness & Example Rehydration
- [x] 3.1 Verify and strengthen FullCalendar auto-polling and container initialization in `report-runtime.js`
- [x] 3.2 Ensure example showcase markup and data attributes cleanly trigger calendar rendering
- [x] 3.3 Re-build root `index.html` via `build-report.mjs`

## Phase 4: Verification & Live Dashboard
- [x] 4.1 Run Playwright `--check-calendar` and Impress interaction verification tests
- [x] 4.2 Update live dashboard on `http://localhost:3000` reflecting complete test passes
