# Delta Specification: skill-data-scaffolding-workflow

## ADDED Requirements

### Requirement: Pre-Computed Numeric Column Summaries & `--json` Output in `scaffold-project.mjs`
`introspectDataFile()` SHALL compute `{ count, sum, avg, min, max }` summaries for each detected numeric column in CSV/JSON reference files, and `scaffold-project.mjs` SHALL support `--json` to emit the scaffolded project paths and introspected dataset summaries as machine-readable JSON.

#### Scenario: Agent scaffolds a data-driven report from a CSV file with `--json`
- **WHEN** an agent runs `node skills/html-report/scripts/scaffold-project.mjs --project q4-sales --ref sales.csv --widgets kpi-row,chart-pair,grid-table --json`
- **THEN** `scaffold-project.mjs` stages `sales.csv` into `projects/q4-sales/refs/`, generates `projects/q4-sales/fragment.html` and `projects/q4-sales/index.html` pre-wired with the CSV data, and prints JSON containing `columnSummaries` (`sum`, `avg`, `min`, `max`) to `stdout`.
