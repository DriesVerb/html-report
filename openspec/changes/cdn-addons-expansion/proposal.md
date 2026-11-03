# Proposal: CDN Addons Expansion (Day.js, Impress.js, Mock.js, Showdown, FullCalendar)

## Why
While `html-report` already bundles core interactive components (Tailwind CSS, DaisyUI, Lucide, Alpine.js) and optional addons (Chart.js, Mermaid, Grid.js, KaTeX, Leaflet, Highlight.js, Marked), modern technical and analytical reports frequently require specialized capabilities:
1. **Date & Time Operations (`dayjs`)**: Lightweight, immutable date formatting, parsing, diffing, and relative timestamps without the 70kB overhead of Moment.js.
2. **Interactive 3D Presentations (`impress.js`)**: Transforming executive summaries and slide decks into zoomable, rotatable 3D canvas journeys directly within the report shell.
3. **Synthetic Data & API Mocking (`mock.js`)**: Generating realistic mock datasets (random names, dates, metrics, JSON schemas) and intercepting simulated asynchronous requests without external backend dependencies.
4. **Flexible Markdown Rendering (`showdown`)**: Two-way client-side Markdown-to-HTML conversion with options for custom extensions, tables, footnotes, and task lists, complementing Marked.
5. **Interactive Calendars & Timelines (`fullcalendar`)**: Full-featured scheduling grids, sprint roadmaps, release calendars, and incident timelines with week, month, day, and event modal views.

Adding first-class CDN support for these five libraries enriches the `html-report` ecosystem while preserving the core principle of **progressive disclosure**: zero bundle cost for unused libraries, with automatic signature detection and explicit CLI flags.

---

## Architectural Decisions
* **D1 (Lazy Ingestion & Auto-Detection)**: Each addon is registered in `ADDON_REGISTRY` with dedicated regex signatures and aliases (including common misspellings such as `fullcalender`). If a report fragment contains library signatures or if `--addons` specifies them, the appropriate CDN `<script>` and `<link>` tags are injected.
* **D2 (DaisyUI Theme Awareness)**: FullCalendar and Impress.js must adapt seamlessly to DaisyUI dark/light theme switching. Standard CSS variables (`--b1`, `--b2`, `--bc`, `--p`) are mapped into calendar grids and presentation slides.
* **D3 (Graceful Fallback & Ready Handshake)**: In `report-runtime.js`, initialization hooks detect if these globals exist (`window.dayjs`, `window.impress`, `window.Mock`, `window.showdown`, `window.FullCalendar`) and trigger clean DOM bindings before setting `window.__REPORT_READY__ = true`.
* **D4 (Zero Conflict with Marked)**: Showdown and Marked can coexist without collision. Distinct auto-detection signatures (`data-showdown` vs `data-marked`) and explicit CLI flags ensure report authors choose the desired markdown engine.

---

## What Changes

### 1. Build CLI (`skills/html-report/scripts/build-report.mjs`)
* Expand `ADDON_REGISTRY` to include:
  - `dayjs` (`https://cdn.jsdelivr.net/npm/dayjs@1.11.13/dayjs.min.js`, plugins: relativeTime, localizedFormat)
  - `impress` (`https://cdn.jsdelivr.net/npm/impress.js@2.0.0/js/impress.js`)
  - `mockjs` (`https://cdn.jsdelivr.net/npm/mockjs@1.1.0/dist/mock.min.js`)
  - `showdown` (`https://cdn.jsdelivr.net/npm/showdown@2.1.0/dist/showdown.min.js`)
  - `fullcalendar` (`https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js`, plus core CSS)
* Expand `ADDON_ALIASES` with mappings:
  - `dayjs`, `day` -> `dayjs`
  - `impress`, `impressjs` -> `impress`
  - `mock`, `mockjs` -> `mockjs`
  - `showdown`, `markdown-showdown` -> `showdown`
  - `fullcalendar`, `fullcalender`, `calendar` -> `fullcalendar`
* Add auto-detection regexes for each library in `detectAddons()`.

### 2. Runtime Support (`skills/html-report/assets/report-runtime.js`)
* Add initialization hooks for FullCalendar instances (`[data-fullcalendar]` / `#calendar`).
* Add Impress.js root initialization (`#impress`).
* Add Day.js and Mock.js helper bindings for interactive cards.
* Synchronize calendar and presentation styles when the DaisyUI theme changes.

### 3. Verification & Test Suite
* Update Playwright addon assertions to recognize the new libraries.
* Add unit tests in `tests/build-report.test.mjs` verifying injection, aliases, and detection.
* Add an interactive showcase example demonstrating all 5 libraries in `example.html`.

---

## Capabilities

### New Capabilities
* `cdn-addons-expansion`: Auto-detection, CLI injection, and runtime styling integration for Day.js, Impress.js, Mock.js, Showdown, and FullCalendar.

---

## Impact
* **Bundle size for non-addon reports**: 0 bytes added (scripts remain on-demand CDN links).
* **CLI compatibility**: 100% backward compatible with existing `--addons` invocations.
* **Author workflow**: Authors can drop `<div id="calendar">`, `<div id="impress">`, or `<script>` utilizing `dayjs` / `Mock` / `showdown` directly into report fragments and have them build automatically.
