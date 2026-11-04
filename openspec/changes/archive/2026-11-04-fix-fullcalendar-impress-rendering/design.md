# Technical Design: FullCalendar Grid Hydration & Impress.js Dynamic Mode Activation

## Architecture Overview
```mermaid
flowchart TD
    UserToggle[User Clicks 'Simulate Presentation Mode'] --> AttrChange[Set html[data-presentation='true']]
    AttrChange --> RuntimeObserver[report-runtime.js Dynamic Observer / Hook]
    RuntimeObserver --> CheckImpress{Impress.js Available?}
    CheckImpress -- Yes --> CleanFallback[Remove impress-static-fallback]
    CleanFallback --> InitImpress[impress('impress').init()]
    InitImpress --> EnableControls[Show Prev / Next / Step Indicators]
    
    DOMReady[DOMContentLoaded / Script Ready] --> PollFC{FullCalendar Loaded?}
    PollFC -- Yes --> InitFC[Mount FullCalendar on #calendar / data-fullcalendar]
    InitFC --> SyncColors[Sync DaisyUI Theme CSS Variables]
```

## Core Fixes & Implementations
1. **Dynamic Impress Observer (`skills/html-report/assets/report-runtime.js`)**:
   - Add a `MutationObserver` on `document.documentElement` targeting attribute `data-presentation`.
   - On change to `'true'`, invoke `initImpress()`.
   - Update `initImpress()`:
     - Remove `impress-static-fallback` class from the `#impress` container.
     - Call `window.impress('impress').init()` if not already initialized, or navigate to step 0.
     - Dispatch custom event `impress:ready`.
   - Expose navigation helpers `window.impressNext()` and `window.impressPrev()`.
   - Provide interactive UI buttons (Next, Prev, Reset) in `#showcase-impress`.
2. **FullCalendar Hydration & Retries (`report-runtime.js`)**:
   - Ensure `initFullCalendar()` checks if `window.FullCalendar` is loaded; if not yet loaded due to defer, retry with exponential/polling delay.
   - Guard against empty containers or missing data attributes.
   - Retain calendar instances in `window.reportCalendars`.
3. **Playwright Harness Runner Timeout Bug Fix (`runner.mjs`)**:
   - In `runHarness()`, ensure `options.timeout` defaults to `30000` (or `5000` in quick) when `rawOptions.timeout` is null or undefined, without being clobbered by `...rawOptions`.
4. **Showcase Examples & Prebuilt Sync**:
   - Re-compile `index.html` from updated `skills/html-report/examples/example.html`.
   - Verify all Playwright checks pass cleanly.
