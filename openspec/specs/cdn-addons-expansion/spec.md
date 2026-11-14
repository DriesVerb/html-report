# cdn-addons-expansion Specification

## Purpose
Defines on-demand CDN registration, signature auto-detection, CLI alias resolution, and isolation guards for third-party report libraries (Day.js, Impress.js, Mock.js, Showdown, FullCalendar, and Quill).

## Requirements

### Requirement: Day.js CDN Registration and Auto-Detection
The build pipeline MUST support Day.js as an on-demand addon.

#### Scenario: Day.js detected via signature
- **WHEN** a fragment contains `dayjs(`, `data-dayjs`, or `dayjs.`
- **THEN** `build-report.mjs` injects the Day.js CDN script (`https://cdn.jsdelivr.net/npm/dayjs@1.11.13/dayjs.min.js`) into the `<head>` of the built report.

#### Scenario: Day.js requested via explicit CLI flag
- **WHEN** `build-report.mjs` is executed with `--addons dayjs` or `--addons day`
- **THEN** the Day.js script is injected regardless of content signatures.

---

### Requirement: Impress.js CDN Registration, Presentation Guard, and Print-Equivalent Treatment
The build pipeline MUST support Impress.js for slide presentations, with strict safeguards ensuring Impress.js receives the same treatment as printable output unless explicitly requested as an interactive presentation.

#### Scenario: Explicit presentation intent requirement
- **WHEN** a report is requested as an interactive presentation (via `--presentation` CLI flag, explicit `--addons impress`, or `data-presentation="true"`)
- **THEN** Impress.js 3D viewport canvas transitions and step navigation are initialized.
- **OTHERWISE** (standard analytical report mode or printable mode), Impress.js 3D transitions MUST NOT hijack page scroll, and all presentation slides MUST be rendered statically in document flow.

#### Scenario: Impress print-equivalent fallback treatment
- **WHEN** `@media print` is active, or `--printable` is set, or presentation mode is not explicitly invoked
- **THEN** all `.step` slide elements MUST be displayed as standard stacked cards with `opacity: 1`, `position: relative`, `transform: none`, and `break-inside: avoid`, ensuring full visibility and print compatibility without blank screens or 3D coordinate clipping.

#### Scenario: Impress container scoping
- **WHEN** an Impress.js presentation is embedded within a standard report
- **THEN** the container MUST be isolated inside `.impress-wrapper` with bounded viewport constraints so it never breaks the parent sticky DaisyUI navbar or overall document scrolling.

#### Scenario: Agent offering Impress.js CDN for explicit presentation requests
- **WHEN** a user explicitly asks for a "presentation", "slide deck", or "interactive slides"
- **THEN** the agent MUST proactively offer the Impress.js CDN addon (`--addons impress`), explaining that it enables zoomable 3D slide transitions while preserving DaisyUI theming and print-equivalent fallback.

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

---

### Requirement: Quill WYSIWYG CDN Registration and Auto-Detection
The build pipeline MUST support Quill.js v2.0 as an on-demand rich text WYSIWYG editing addon.

#### Scenario: Quill detected via DOM signatures
- **WHEN** a fragment or document contains `class="ql-editor"`, `id="editor"`, `id="quill-editor"`, `data-quill`, or `new Quill(`
- **THEN** `build-report.mjs` injects the Quill v2.0 stylesheet (`https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css`) and JavaScript bundle (`https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js`) into the `<head>` of the built report.

#### Scenario: Quill requested via explicit CLI flags
- **WHEN** `build-report.mjs` is executed with `--quill`, `--wysiwyg`, `--editor`, or `--addons quill`
- **THEN** the Quill stylesheet and script are injected regardless of content signatures.
