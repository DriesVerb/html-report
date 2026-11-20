# Delta Specification: declarative-widget-hydration

## MODIFIED Requirements

### Requirement: Declarative Chart.js Hydration (`data-chart`)
`report-runtime.js` SHALL automatically hydrate `<canvas data-chart="...">` and `<canvas data-chart-source="#...">` elements using `Chart.js`, applying an 8-token active DaisyUI theme palette (`primary`, `secondary`, `accent`, `info`, `success`, `warning`, `error`, `neutral`) when dataset colors are omitted, defaulting pie/doughnut/polarArea charts with `> 4` labels to a compact bottom legend (`position: "bottom"`, `boxWidth: 10`, `padding: 8`), defaulting to `responsive: true` and `maintainAspectRatio: false`, and registering instances in `window.reportCharts`.

#### Scenario: Agent authors a chart using only a declarative HTML attribute
- **WHEN** a Semantic Fragment contains `<canvas data-chart='{"type":"bar","data":{"labels":["Q1","Q2"],"datasets":[{"label":"Revenue","data":[42,58]}]}}'></canvas>` with no inline `<script>`
- **THEN** `buildReport()` auto-detects the `charts` addon and `report-runtime.js` renders a responsive Chart.js bar chart synchronized with the active DaisyUI theme.

#### Scenario: Doughnut chart with 8 labels uses neutral token and compact bottom legend
- **WHEN** a Semantic Fragment contains `<canvas data-chart='{"type":"doughnut","data":{"labels":["A","B","C","D","E","F","G","H"],"datasets":[{"label":"Share","data":[10,12,8,15,20,11,14,10]}]}}'></canvas>`
- **THEN** `initDeclarativeCharts()` assigns the 8th slice to the `neutral` theme token and configures a bottom legend with `boxWidth: 10` and `padding: 8`.
