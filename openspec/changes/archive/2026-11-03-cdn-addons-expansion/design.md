# Design: CDN Addons Expansion

## Technical Overview
This design expands the `html-report` addon infrastructure by registering five new production-grade libraries:
1. **Day.js** (Date manipulation & relative timestamps)
2. **Impress.js** (3D slide deck presentations)
3. **Mock.js** (Browser mock data & REST simulation)
4. **Showdown** (Alternative Markdown compiler)
5. **FullCalendar** (Interactive scheduling & event calendar)

The integration maintains a **zero-dependency default**: reports that do not use these libraries incur zero bundle overhead.

---

## 1. Addon Registry Architecture

In `skills/html-report/scripts/build-report.mjs`, the `ADDON_REGISTRY` table will be extended with the following definitions:

```javascript
export const ADDON_REGISTRY = {
  // Existing: charts, mermaid, gridjs, katex, leaflet, hljs, marked ...
  
  dayjs: {
    name: "Day.js",
    signatures: [/\bdayjs\b/i, /data-dayjs/i, /dayjs\s*\(/],
    head: `<script defer src="https://cdn.jsdelivr.net/npm/dayjs@1.11.13/dayjs.min.js" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/dayjs@1.11.13/plugin/relativeTime.js" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/dayjs@1.11.13/plugin/customParseFormat.js" crossorigin="anonymous"></script>`
  },

  impress: {
    name: "Impress.js",
    signatures: [/id=["']impress["']/i, /class=["'][^"']*\bstep\b[^"']*data-x/i, /\bimpress\s*\(\s*\)/],
    head: `<script defer src="https://cdn.jsdelivr.net/npm/impress.js@2.0.0/js/impress.js" crossorigin="anonymous"></script>`
  },

  mockjs: {
    name: "Mock.js",
    signatures: [/\bMock\.(?:mock|Random)\b/i, /data-mock/i, /id=["']mock-/i],
    head: `<script defer src="https://cdn.jsdelivr.net/npm/mockjs@1.1.0/dist/mock.min.js" crossorigin="anonymous"></script>`
  },

  showdown: {
    name: "Showdown",
    signatures: [/\bshowdown\b/i, /new\s+showdown\.Converter/i, /data-showdown/i, /id=["']showdown-/i],
    head: `<script defer src="https://cdn.jsdelivr.net/npm/showdown@2.1.0/dist/showdown.min.js" crossorigin="anonymous"></script>`
  },

  fullcalendar: {
    name: "FullCalendar",
    signatures: [/id=["']calendar["']/i, /data-fullcalendar/i, /FullCalendar\.Calendar/i, /class=["'][^"']*\bfc\b/i],
    head: `<script defer src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js" crossorigin="anonymous"></script>`
  }
};
```

### Aliases
```javascript
const ADDON_ALIASES = {
  // Existing aliases ...
  dayjs: "dayjs",
  day: "dayjs",
  impress: "impress",
  impressjs: "impress",
  mock: "mockjs",
  mockjs: "mockjs",
  showdown: "showdown",
  fullcalendar: "fullcalendar",
  fullcalender: "fullcalendar",
  calendar: "fullcalendar"
};
```

---

## 2. Runtime Lifecycle & DaisyUI Theme Sync

### FullCalendar Theming
FullCalendar 6 exposes CSS custom properties for theming. In `report-runtime.js` and `template-shell.html`, we map DaisyUI CSS variables into FullCalendar:
```css
:root {
  --fc-page-bg-color: transparent;
  --fc-neutral-bg-color: hsl(var(--b2, 0 0% 95%));
  --fc-list-event-hover-bg-color: hsl(var(--b3, 0 0% 90%));
  --fc-theme-standard-border-color: hsl(var(--bc, 0 0% 20%) / 0.15);
  --fc-border-color: hsl(var(--bc, 0 0% 20%) / 0.15);
  --fc-button-bg-color: hsl(var(--p, 259 94% 51%));
  --fc-button-border-color: hsl(var(--p, 259 94% 51%));
  --fc-button-text-color: hsl(var(--pc, 0 0% 100%));
}
```
When `applyTheme()` executes, FullCalendar is notified to trigger `calendar.render()` or dynamic CSS property recalculation.

### Impress.js Scoping, Presentation Guard & Print-Equivalent Treatment
Impress.js manipulates viewport scales and body classes (`.impress-supported`). To prevent Impress from capturing global scrolling or breaking layouts:
* **Presentation Guard**: Impress 3D initialization ONLY activates when explicitly requested as a presentation (via `--presentation`, explicit `--addons impress`, or `data-presentation="true"`).
* **Print-Equivalent Static Fallback**: When `@media print` is active, or `--printable` is set, or presentation mode is not active, all `.step` slide elements receive print-friendly static styling:
  ```css
  /* Impress print & static document flow */
  @media print, (data-presentation="false") {
    .impress-not-presentation .step,
    @media print {
      .step {
        position: relative !important;
        opacity: 1 !important;
        transform: none !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
        margin-bottom: 2rem !important;
      }
    }
  }
  ```
* **Embedded Mode**: When presentation mode is explicitly enabled within a bounded report container, Impress initializes within `.impress-wrapper` with `overflow: hidden; height: 500px; position: relative;`.
* **Standalone Presentation Mode**: When `--presentation` is passed and `#impress` is the root container, full-screen canvas transitions apply with slide controls.
* **Agent Proactive Recommendation**: When a user's prompt explicitly requests a presentation or slide deck, the agent recommends enabling `--addons impress` with the 3D step transitions layout, while noting that standard card flow remains available if they prefer printable static slides.

---

## 3. Verification & Safety Guards
* **Non-blocking script execution**: All scripts use `defer` to ensure initial HTML rendering is never held up.
* **Network failure tolerance**: If a CDN cannot be reached or fails in an offline sandbox, runtime guards prevent throwing uncaught exceptions.
* **Test automation**:
  - `tests/build-report.test.mjs` verifies detection of all 5 addons individually and concurrently.
  - Playwright test runner verifies addon initialization in `example.html`.
