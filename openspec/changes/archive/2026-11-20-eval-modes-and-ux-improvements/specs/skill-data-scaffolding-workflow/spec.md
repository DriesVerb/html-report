# Delta Specification: skill-data-scaffolding-workflow

## MODIFIED Requirements

### Requirement: Pre-Computed Numeric Column Summaries & `--json` Output in `scaffold-project.mjs`
`introspectDataFile()` SHALL compute `{ count, sum, avg, min, max }` summaries for each detected numeric column in CSV/JSON reference files, `stageReferenceFiles()` SHALL resolve `fs.realpathSync()` for both `workspaceRoot` and candidate files to reject symlink escapes (`reason: "outside_workspace"`) and report `"not_found"` with `warning` messages when a `--ref` file cannot be staged, starter widget presets (`chart-pair`, `grid-table`) SHALL emit sanitized declarative `data-chart-source` / `data-gridjs-source` JSON islands (`safeJsonEmbed()` escaping `<`, `>`, `&`, `\u2028`, `\u2029`) and sanitized Mermaid node labels (`renderMermaidFlowWidget()`), `kpi-row` SHALL average both snake/kebab-case and camelCase rate/latency columns (`isRateOrAvgColumn()`), and `scaffold-project.mjs` SHALL support `--json` to emit the scaffolded project paths, `warnings`, and introspected dataset summaries to `stdout`.

#### Scenario: Agent scaffolds a data-driven report from a CSV file with `--json`
- **WHEN** an agent runs `node skills/html-report/scripts/scaffold-project.mjs --project q4-sales --ref sales.csv --widgets kpi-row,chart-pair,grid-table --json`
- **THEN** `scaffold-project.mjs` stages `sales.csv` into `projects/q4-sales/refs/`, generates `projects/q4-sales/fragment.html` and `projects/q4-sales/index.html` pre-wired with the CSV data, and prints JSON containing `columnSummaries` (`sum`, `avg`, `min`, `max`) to `stdout`.

#### Scenario: Outside-workspace `--ref` emits structured warning and `kpi-row` averages rate/pct columns
- **WHEN** `scaffoldProject()` receives a `--ref` outside `workspaceRoot` or scaffolds a CSV containing `availability_pct`
- **THEN** `stagedRefs[0]` includes `reason: "outside_workspace"` and a `warning` surfaced in `result.warnings`, and `kpi-row` computes the average for `availability_pct` rather than summing percentages.

#### Scenario: Symlink escape `--ref` is rejected and camelCase `errorRate` is averaged
- **WHEN** `stageReferenceFiles()` encounters a symlink inside `projects/_uploads/` pointing outside `workspaceRoot` or `generateStarterFragment()` processes a column named `errorRate`
- **THEN** `stagedRefs[0]` rejects the symlink with `stagedPath: null` and `reason: "outside_workspace"`, and `kpi-row` computes the mean of `errorRate` rather than its sum.
