# Capability Delta: FullCalendar Hydration & Impress.js Presentation Guard

## ADDED REQUIREMENTS

### Requirement: Impress.js Presentation Guard & Dynamic Mode Activation
The runtime MUST guard Impress.js from capturing scroll by keeping `.step` elements stacked statically by default, and MUST dynamically observe attribute transitions to `data-presentation="true"` to initialize and activate the 3D presentation stage.

#### Scenario: Default Static Flow
- **GIVEN** a report document containing `#impress` and `.step` cards without `data-presentation="true"`
- **WHEN** the document loads in the browser
- **THEN** `#impress` MUST have class `impress-static-fallback` and `.step` elements MUST render as static stacked printable cards.

#### Scenario: Dynamic Presentation Activation
- **GIVEN** a report document with `impress-static-fallback` active
- **WHEN** attribute `data-presentation="true"` is set on `document.documentElement`
- **THEN** the runtime `MutationObserver` MUST remove `impress-static-fallback`, initialize `window.impress('impress')`, activate the first slide, and enable interactive slide navigation.

#### Scenario: Slide Navigation Controls
- **GIVEN** an active presentation mode session
- **WHEN** invoking `window.impressNext()` or `window.impressPrev()`
- **THEN** the presentation stage MUST transition to the next or previous `.step` element smoothly.

---

### Requirement: Robust FullCalendar Container Hydration & Addon Isolation
The runtime MUST robustly query and mount FullCalendar on content containers and auto-retry if deferred scripts are still loading, while strictly ignoring internal stylesheets.

#### Scenario: Container Mounting with Event Hydration
- **GIVEN** a container `#calendar` or `div[data-fullcalendar]` in `<main>` with event JSON data
- **WHEN** `initFullCalendar()` executes
- **THEN** it MUST mount the calendar grid, display the toolbar and events, and record the instance in `window.reportCalendars`.

#### Scenario: Injected Head Style Tag Isolation
- **GIVEN** FullCalendar 6 injecting a `<style data-fullcalendar>` tag into `<head>`
- **WHEN** the runtime queries calendar containers or test harness executes checks
- **THEN** it MUST ignore any elements inside `<head>` or of tag name `STYLE`.
