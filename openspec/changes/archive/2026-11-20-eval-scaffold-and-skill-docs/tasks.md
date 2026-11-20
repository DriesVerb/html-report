# Tasks: Studio Scaffolder Diagnostics, Declarative Starter Templates & Skill Docs

> **Companion Dashboard:** [index.html](index.html) | **Proposal:** [proposal.md](proposal.md) | **Design:** [design.md](design.md) | **Delta Spec:** [skill-data-scaffolding-workflow](specs/skill-data-scaffolding-workflow/spec.md)

## Phase 1: Audit Studio Scaffolder, Starter Templates & Skill Docs

- [x] 1.1 Audit `packages/studio/scripts/lib/scaffold/data-introspector.mjs` and `packages/studio/scripts/scaffold-project.mjs` for `outside_workspace`/`not_found` warnings and CLI help options (`--custom-theme`, `--favicon`).
- [x] 1.2 Audit `packages/studio/scripts/lib/scaffold/widget-templates.mjs` and `skills/html-report/SKILL.md` for declarative starter widgets (`data-chart-source`, `data-gridjs-source`), `isRateOrAvgColumn()` averaging, and `<= 5120` B facade size.

## Phase 2: Full Verification & Spec Synchronization

- [x] 2.1 Run `node --test packages/studio/tests/studio-fast-assembly.test.mjs packages/studio/tests/modular-skills.test.mjs` and full `npm run test:unit` to confirm zero failures.
- [x] 2.2 Sync delta spec (`skill-data-scaffolding-workflow`) to `openspec/specs/` and validate with `openspec validate eval-scaffold-and-skill-docs`.

## Phase 3: Journey Update, Archive & Clean Git Commit

- [x] 3.1 Update companion [index.html](index.html) to reflect `100%` completion (`Shipped / Archived`) and sync `implementation-progress.html`.
- [x] 3.2 Archive `eval-scaffold-and-skill-docs` via `openspec archive eval-scaffold-and-skill-docs --yes` and commit all Plan 2 changes (`packages/studio/**`, `skills/html-report/SKILL.md`, synced specs, archived change, and `implementation-progress.html`) so `git status` is clean.
