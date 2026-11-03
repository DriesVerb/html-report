# Capability Delta: CDN Addons Expansion

## ADDED Requirements

### Requirement: Day.js CDN Registration and Auto-Detection
The build pipeline MUST support Day.js as an on-demand addon.

#### Scenario: Day.js detected via signature
- **WHEN** a fragment contains `dayjs(`, `data-dayjs`, or `dayjs.`
- **THEN** `build-report.mjs` injects the Day.js CDN script (`https://cdn.jsdelivr.net/npm/dayjs@1.11.13/dayjs.min.js`) into the `<head>` of the built report.

#### Scenario: Day.js requested via explicit CLI flag
- **WHEN** `build-report.mjs` is executed with `--addons dayjs` or `--addons day`
- **THEN** the Day.js script is injected regardless of content signatures.

---

### Requirement: Impress.js CDN Registration and Auto-Detection
The build pipeline MUST support Impress.js for 3D visual presentations.

#### Scenario: Impress.js detected via signature
- **WHEN** a fragment contains `id="impress"`, `class="step"`, or `impress()`
- **THEN** `build-report.mjs` injects the Impress.js CDN script (`https://cdn.jsdelivr.net/npm/impress.js@2.0.0/js/impress.js`).

#### Scenario: Impress container styling
- **WHEN** an Impress.js presentation is embedded
- **THEN** the container MUST respect viewport constraints and not break parent navbar scroll behavior.

---

### Requirement: Mock.js CDN Registration and Auto-Detection
The build pipeline MUST support Mock.js for client-side synthetic data generation.

#### Scenario: Mock.js detected via signature
- **WHEN** a fragment contains `Mock.mock(`, `Mock.Random`, or `data-mock`
- **THEN** `build-report.mjs` injects the Mock.js CDN script (`https://cdn.jsdelivr.net/npm/mockjs@1.1.0/dist/mock.min.js`).

#### Scenario: Mock.js alias resolution
- **WHEN** `--addons mock` or `--addons mockjs` is passed to the CLI
- **THEN** the Mock.js addon is loaded correctly.

---

### Requirement: Showdown CDN Registration and Auto-Detection
The build pipeline MUST support Showdown as a client-side Markdown converter.

#### Scenario: Showdown detected via signature
- **WHEN** a fragment contains `showdown.Converter`, `data-showdown`, or `id="showdown-target"`
- **THEN** `build-report.mjs` injects the Showdown CDN script (`https://cdn.jsdelivr.net/npm/showdown@2.1.0/dist/showdown.min.js`).

#### Scenario: Showdown co-existence with Marked
- **WHEN** a fragment contains both Showdown and Marked signatures
- **THEN** both scripts are injected into the `<head>` without collision, each operating independently within its respective DOM containers.

---

### Requirement: FullCalendar CDN Registration and Auto-Detection
The build pipeline MUST support FullCalendar for interactive calendars and event schedules.

#### Scenario: FullCalendar detected via signature
- **WHEN** a fragment contains `id="calendar"`, `data-fullcalendar`, `FullCalendar.Calendar`, or `class="fc"`
- **THEN** `build-report.mjs` injects the FullCalendar CDN bundle (`https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js`).

#### Scenario: Alias and misspelling tolerance
- **WHEN** `--addons fullcalendar` or `--addons fullcalender` or `--addons calendar` is specified
- **THEN** the CLI resolves to the `fullcalendar` addon entry.

#### Scenario: FullCalendar DaisyUI theme synchronization
- **WHEN** the user changes the DaisyUI theme via the navbar dropdown
- **THEN** FullCalendar CSS custom properties and theme borders MUST update to match the active theme's background and text colors.
