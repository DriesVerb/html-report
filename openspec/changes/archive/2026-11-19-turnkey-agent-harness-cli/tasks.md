# Tasks: Turnkey Project-Aware Agent Harness (`harness.mjs run --project <slug> --fast`)

> **Companion Dashboard:** [index.html](index.html) | **Proposal:** [proposal.md](proposal.md) | **Design:** [design.md](design.md) | **Delta Spec:** [turnkey-agent-harness-cli](specs/turnkey-agent-harness-cli/spec.md)

## Phase 1: Project-Aware Harness CLI (`@html-report/core`)

- [x] 1.1 Add `--project <slug>` parsing and default `projects/<slug>/fragment.html` -> `projects/<slug>/index.html` path resolution in `packages/core/scripts/lib/harness/cli.mjs` and `packages/core/scripts/harness.mjs`.
- [x] 1.2 Forward `project` into `buildReport()` inside `runLifecycle()` so project metadata and `#agent-manifest` match `build-report.mjs --project <slug>`.

## Phase 2: Mechanical Auto-Fix Expansion (`fragment-linter.mjs`)

- [x] 2.1 Add `STEPPER_RESPONSIVE_TRAP` lint rule and auto-fix (`steps-vertical sm:steps-horizontal` -> `steps-horizontal`) in `packages/core/scripts/lib/harness/fragment-linter.mjs`.
- [x] 2.2 Add `BARE_CANVAS_WRAPPER` lint rule and auto-fix in `packages/core/scripts/lib/harness/fragment-linter.mjs`.

## Phase 3: Skill Facades & Verification

- [x] 3.1 Update `skills/html-report/SKILL.md` and sibling skills to promote the one-shot `harness.mjs run --project <slug> --fast` command while remaining `<= 5,120` bytes.
- [x] 3.2 Add unit tests in `packages/core/tests/` for `--project` resolution and new auto-fixes, and sync companion [index.html](index.html) to `localhost:3031`.
