# Proposal: Fix FullCalendar Rendering & Impress.js Presentation Guard in Example Showcase

## Problem Context & User Feedback
The user noticed in `example.html`:
1. **FullCalendar does not render at all**: Section 11.5 FullCalendar scheduling grid fails to render or display its events in `example.html`. When tested via `verify-report.mjs`, runner timeout issues and element rendering problems prevented proper lifecycle execution.
2. **Impress.js does not work**: Clicking "Simulate Presentation Mode" does not initialize or advance the Impress.js 3D presentation. `initImpress()` is only invoked once at `DOMContentLoaded` when `data-presentation` is not set; runtime mode switches never re-trigger Impress initialization, static fallback classes are not removed, and there are no presentation controls (Next / Prev / Reset) for users to interact with slides.
3. **Showcase Consistency**: Ensure both `skills/html-report/examples/example.html` and the pre-built `index.html` seamlessly showcase all 17 CDN libraries, including responsive scheduling and guarded 3D presentations.

## Proposed Solutions
1. **FullCalendar Initialization & Robustness**:
   - Ensure `initFullCalendar()` properly queries and mounts calendars, handles retry / defer timings, and prevents any silent initialization aborts.
   - Fix timeout and check configuration bug in `runner.mjs` where `...rawOptions` overrides default timeout with `null`.
   - Ensure `example.html` properly provides FullCalendar styling and script bindings.
2. **Impress.js Dynamic Lifecycle & Interactive Controls**:
   - Add a `MutationObserver` or explicit event listener in `report-runtime.js` to observe changes to `data-presentation` on `<html>` or `<body>`.
   - When presentation mode becomes `true`, clear `.impress-static-fallback`, initialize `window.impress()`, and activate coordinates.
   - Add visual controls (Next Slide, Prev Slide, Slide Indicator) to the Impress demo card in `example.html` and `index.html` so users can experience the 3D presentation directly inside the report.
   - When switching back to static mode, clean up coordinates and restore static card flow.
3. **Live Journey Dashboard**:
   - Serve a live journey dashboard on `http://localhost:3000` via `skills/html-report/scripts/serve-report.mjs implementation-progress.html --port 3000`.
   - Update `tasks.md` and live progress as fixes are verified.
