# Delta Specification: skill-data-scaffolding-workflow

## MODIFIED Requirements

### Requirement: Pre-Computed Numeric Column Summaries & `--json` Output in `scaffold-project.mjs`
`introspectDataFile()` SHALL compute `{ count, sum, avg, min, max }` summaries for each detected numeric column in CSV/JSON reference files, `stageReferenceFiles()` SHALL report `reason` (`"outside_workspace"` or `"not_found"`) and `warning` messages when a `--ref` file cannot be staged, starter widget presets (`chart-pair`, `grid-table`) SHALL emit declarative `data-chart-source` / `data-gridjs-source` JSON islands with rate/latency KPI averaging in `kpi-row`, and `scaffold-project.mjs` SHALL support `--json` to emit the scaffolded project paths, `warnings`, and introspected dataset summaries to `stdout`.

#### Scenario: Agent scaffolds a data-driven report from a CSV file with `--json`
- **WHEN** an agent runs `node skills/html-report/scripts/scaffold-project.mjs --project q4-sales --ref sales.csv --widgets kpi-row,chart-pair,grid-table --json`
- **THEN** `scaffold-project.mjs` stages `sales.csv` into `projects/q4-sales/refs/`, generates `projects/q4-sales/fragment.html` and `projects/q4-sales/index.html` pre-wired with the CSV data, and prints JSON containing `columnSummaries` (`sum`, `avg`, `min`, `max`) to `stdout`.

#### Scenario: Outside-workspace `--ref` emits structured warning and `kpi-row` averages rate/pct columns
- **WHEN** `scaffoldProject()` receives a `--ref` outside `workspaceRoot` or scaffolds a CSV containing `availability_pct`
- **THEN** `stagedRefs[0]` includes `reason: "outside_workspace"` and a `warning` surfaced in `result.warnings`, and `kpi-row` computes the average for `availability_pct` rather than summing percentages.
