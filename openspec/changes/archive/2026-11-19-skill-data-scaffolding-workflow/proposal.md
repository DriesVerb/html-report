# Proposal: Data-First Scaffolding & Schema Introspection in Agent Skills

> **Change:** `skill-data-scaffolding-workflow` | **Journey Companion:** [index.html](index.html) | **Design:** [design.md](design.md) | **Tasks:** [tasks.md](tasks.md) | **Delta Spec:** [skill-data-scaffolding-workflow](specs/skill-data-scaffolding-workflow/spec.md)

## Why

`packages/studio/scripts/scaffold-project.mjs` and `packages/studio/scripts/lib/scaffold/data-introspector.mjs` already implement a zero-dependency CSV/JSON data introspector and deterministic widget preset scaffolder (`kpi-row`, `chart-pair`, `grid-table`, `mermaid-flow`, `timeline`) that stages reference datasets into `projects/<slug>/refs/`, computes column types and KPI sums/averages, and emits a pre-wired `projects/<slug>/fragment.html` and `projects/<slug>/index.html` in `<100ms`.

However, **none of the `skills/*/SKILL.md` files document `scaffold-project.mjs`**, so agents manually inspect CSV/JSON files and hand-write entire fragments from scratch on every task.

## What Changes

1. **Machine-Readable `--json` Introspection Output in `scaffold-project.mjs`**:
   - Add `--json` output mode to `scaffold-project.mjs` returning `{ slug, projectDir, fragmentPath, outputPath, datasets: [{ fileName, rowCount, columns, numericColumns, labelColumn, summaries }], widgets, addons }` so agents get both the scaffolded project and exact dataset schema in one `<100ms` tool call.
2. **Computed Dataset Summaries in `data-introspector.mjs`**:
   - Include pre-computed `{ sum, avg, min, max, count }` for each numeric column in `introspectDataFile()` so agents don't have to write ad-hoc scripts to calculate KPI numbers from CSV/JSON files.
3. **Expose `scaffold-project.mjs` Across `SKILL.md` Facades**:
   - Add `node skills/html-report/scripts/scaffold-project.mjs --project <slug> --title "<Title>" --ref <data.csv> --widgets kpi-row,chart-pair,grid-table --json` as the recommended bootstrap command in `skills/html-report/SKILL.md` and `skills/html-studio/SKILL.md`.
