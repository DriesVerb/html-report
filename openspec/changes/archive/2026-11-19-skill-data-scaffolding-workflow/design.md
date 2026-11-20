# Design: Data-First Scaffolding & Schema Introspection in Agent Skills

> **Change:** `skill-data-scaffolding-workflow` | **Proposal:** [proposal.md](proposal.md) | **Tasks:** [tasks.md](tasks.md) | **Journey:** [index.html](index.html)

## Technical Decisions

### 1. Pre-Computed Numeric Summaries in `data-introspector.mjs`
- Enhance `introspectDataFile()` in `packages/studio/scripts/lib/scaffold/data-introspector.mjs` to compute `columnSummaries` for every column in `numericColumns`:
  ```javascript
  columnSummaries[colName] = { count, sum, avg, min, max };
  ```
- This allows agents calling `scaffold-project.mjs --json` to immediately read verified aggregates (`sum`, `avg`, `min`, `max`) without writing one-off Python/Node data analysis scripts.

### 2. `--json` CLI Flag in `scaffold-project.mjs`
- When `--json` is passed to `skills/html-report/scripts/scaffold-project.mjs`, emit a single deterministic JSON payload to `stdout` containing:
  - `slug`, `projectDir`, `fragmentPath`, `outputPath`
  - `mode`, `theme`, `addons`, `widgets`
  - `datasets`: array of `{ fileName, format, rowCount, columns, labelColumn, numericColumns, columnSummaries }`

### 3. Skill Facade Documentation (`skills/html-report/SKILL.md` & `skills/html-studio/SKILL.md`)
- Document the 1-command data bootstrap pattern in `skills/html-report/SKILL.md` Step 1:
  ```bash
  # Optional fast bootstrap from CSV/JSON data + widget presets (<100ms):
  node skills/html-report/scripts/scaffold-project.mjs --project q4-audit --title "Q4 Audit" --ref data.csv --widgets kpi-row,chart-pair,grid-table --json
  ```
