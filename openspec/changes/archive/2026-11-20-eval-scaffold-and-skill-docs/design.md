# Design: Studio Scaffolder Diagnostics, Declarative Starter Templates & Skill Docs

> **Change:** `eval-scaffold-and-skill-docs` | **Proposal:** [proposal.md](proposal.md) | **Tasks:** [tasks.md](tasks.md) | **Journey:** [index.html](index.html)

## Technical Decisions

### 1. Reference Staging Warnings (`data-introspector.mjs` & `scaffold-project.mjs`)
- In `stageReferenceFiles()`, distinguish between files found outside `resolvedWs` (`reason: "outside_workspace"`) and missing files (`reason: "not_found"`), attaching a concrete remediation `warning` string pointing to `projects/_uploads/` or `projects/<slug>/refs/`.
- Aggregate non-empty warnings into `result.warnings` in `scaffoldProject()` and print them in non-JSON CLI mode.
- Document `--custom-theme` and `--favicon` in `scaffold-project.mjs` CLI `--help`.

### 2. Declarative Starters & Rate Averaging (`widget-templates.mjs`)
- Add `isRateOrAvgColumn(colName)` matching `pct`, `percent`, `percentage`, `rate`, `ratio`, `avg`, `mean`, `score`, `ms`, `latency`, `mttr`, `duration` tokens so `kpi-row` displays averages instead of sums for rate/latency metrics.
- Emit `<canvas data-chart-source="#starter-chart-...">` and `<div data-gridjs-source="#starter-grid-data">` paired with `<script type="application/json">` blocks instead of imperative inline `<script>` initialization.

### 3. Skill Facade Budget & Full Repo Verification
- Keep `skills/html-report/SKILL.md` strictly under `5120` bytes (currently `5027` bytes) as enforced by `packages/studio/tests/modular-skills.test.mjs`.
- Run `npm run test:unit`, sync `skill-data-scaffolding-workflow` spec, archive change, and ensure `git status` is clean before pushing `main`.
