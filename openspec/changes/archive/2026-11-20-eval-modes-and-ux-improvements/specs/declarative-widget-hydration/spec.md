# Delta Specification: declarative-widget-hydration

## MODIFIED Requirements

### Requirement: Declarative Grid.js Hydration (`data-gridjs`)
`report-runtime.js` SHALL automatically hydrate `[data-gridjs]` and `[data-gridjs-source]` elements using `Grid.js` with default search, sort, and pagination (`limit: 10`) when those options are omitted, `template-shell.html` SHALL constrain `.gridjs-container` and `.gridjs-wrapper` to `max-width: 100%` with internal `overflow-x: auto`, `table-layout: auto`, `min-width: 100%`, and single-line `th.gridjs-th` (`white-space: nowrap !important`) headers, and `checkInsufficientHorizontalSpace()` SHALL skip `.gridjs-wrapper` and `.gridjs-table`.

#### Scenario: Agent authors an interactive data table via `data-gridjs`
- **WHEN** a Semantic Fragment contains `<div data-gridjs='{"columns":["Name","Score"],"data":[["Alice",98],["Bob",91]]}'></div>`
- **THEN** `buildReport()` auto-detects the `gridjs` addon and `report-runtime.js` mounts a searchable, sortable, paginated Grid.js table.

#### Scenario: Narrow and wide Grid.js tables render cleanly at desktop and 640px mobile viewports
- **WHEN** a report contains both a 3-column and a 10-column `data-gridjs` table viewed at `1280x900` and `640x800`
- **THEN** the 3-column table fills `100%` of `.gridjs-wrapper`, the 10-column table scrolls horizontally inside `.gridjs-wrapper` with single-line non-wrapping headers, page horizontal overflow remains `0px`, and `checkInsufficientHorizontalSpace()` does not flag `.gridjs-wrapper`.
