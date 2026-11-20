# Proposal: Studio Scaffolder Diagnostics, Declarative Starter Templates & Skill Docs

> **Change:** `eval-scaffold-and-skill-docs` | **Journey Companion:** [index.html](index.html) | **Design:** [design.md](design.md) | **Tasks:** [tasks.md](tasks.md) | **Delta Spec:** [skill-data-scaffolding-workflow](specs/skill-data-scaffolding-workflow/spec.md)

## Why

Empirical evaluation (`projects/agent-skill-eval-v2`) surfaced three scaffolding & documentation friction points:

1. **Silent `--ref` Rejection**: Passing a `--ref` file outside `workspaceRoot` returned `ok: true` with `stagedPath: null` and zero explanation/warning.
2. **Stale Imperative Scaffold Starters & Summing Rates**: `widget-templates.mjs` still emitted imperative `new Chart(...)` and `new gridjs.Grid(...)` scripts instead of declarative `data-chart-source` / `data-gridjs-source`, summed rate/percentage/latency columns (`availability_pct`) in `kpi-row` instead of averaging them, and used `&amp;` inside Mermaid node text.
3. **Skill CLI Clarity**: `skills/html-report/SKILL.md` needed explicit guidance that `--ref` paths must reside inside `workspaceRoot` and that omitting `--check-*` runs all core + auto-detected addon checks, while remaining under the 5,120-byte facade budget.

## What Changes

1. **Explicit `--ref` Staging Diagnostics (`data-introspector.mjs`, `scaffold-project.mjs`)**:
   - Record `reason` (`"outside_workspace"` or `"not_found"`) and human-readable `warning` on unstaged `--ref` items, surface `warnings` in JSON/CLI output, and document `--custom-theme` / `--favicon` in `--help`.
2. **Declarative Starter Templates & Smart KPI Averaging (`widget-templates.mjs`)**:
   - Upgrade `chart-pair` and `grid-table` presets to declarative `data-chart-source` and `data-gridjs-source` with `<script type="application/json">` data islands.
   - Average rate/percentage/latency columns (`isRateOrAvgColumn`) in `kpi-row` and keep Mermaid labels unescaped.
3. **Skill Documentation & Final Verification/Commit (`skills/html-report/SKILL.md`)**:
   - Update `SKILL.md` (verified `<= 5120` bytes), run the full repository unit test suite (`npm run test:unit`) + `modular-skills.test.mjs`, sync delta specs, update companion `index.html`, archive the change, and commit all Plan 2 changes cleanly.
