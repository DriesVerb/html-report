# Tasks: Data-First Scaffolding & Schema Introspection in Agent Skills

> **Companion Dashboard:** [index.html](index.html) | **Proposal:** [proposal.md](proposal.md) | **Design:** [design.md](design.md) | **Delta Spec:** [skill-data-scaffolding-workflow](specs/skill-data-scaffolding-workflow/spec.md)

## Phase 1: Dataset Summary Introspection & `--json` Output (`@html-report/studio`)

- [x] 1.1 Add pre-computed `columnSummaries` (`{ count, sum, avg, min, max }`) for numeric columns in `packages/studio/scripts/lib/scaffold/data-introspector.mjs`.
- [x] 1.2 Add `--json` CLI flag support to `packages/studio/scripts/scaffold-project.mjs` to output structured project paths and dataset summaries.

## Phase 2: Skill Workflow Integration & Verification

- [x] 2.1 Document `scaffold-project.mjs --project <slug> --ref <file> --widgets ... --json` in `skills/html-report/SKILL.md` and `skills/html-studio/SKILL.md` (staying under `5,120` bytes).
- [x] 2.2 Add unit tests for `columnSummaries` and `scaffold-project.mjs --json`, and sync companion [index.html](index.html) to `localhost:3031`.
