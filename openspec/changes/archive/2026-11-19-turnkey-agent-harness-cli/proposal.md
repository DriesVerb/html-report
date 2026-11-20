# Proposal: Turnkey Project-Aware Agent Harness (`harness.mjs run --project <slug> --fast`)

> **Change:** `turnkey-agent-harness-cli` | **Journey Companion:** [index.html](index.html) | **Design:** [design.md](design.md) | **Tasks:** [tasks.md](tasks.md) | **Delta Spec:** [turnkey-agent-harness-cli](specs/turnkey-agent-harness-cli/spec.md)

## Why

Currently, `skills/html-report/SKILL.md` instructs agents to execute 3 to 4 separate sequential commands (`build-report.mjs`, `verify-report.mjs`, `serve-report.mjs`). Meanwhile, `harness.mjs` already implements a sub-150ms static gate (`lintFragment` + `autoFixFragment` + `buildReport`), **but** `harness.mjs` lacks `--project <slug>` path resolution (requiring explicit positional `<fragment.html>` and `--output <index.html>` paths) and is not promoted in `SKILL.md` as the primary inner-loop command.

Additionally, common agent markup mistakes—such as bare `<canvas>` tags without a fixed-height container or `steps-vertical sm:steps-horizontal` classes—are caught late during Playwright browser verification rather than being auto-repaired during the sub-150ms static lint/fix pass.

## What Changes

1. **Project-Aware `--project <slug>` Flag in `harness.mjs`**:
   - Running `node skills/html-report/scripts/harness.mjs run --project <slug> --fast` automatically resolves `projects/<slug>/fragment.html` as input and `projects/<slug>/index.html` (or `published.html` with `--published`) as output.
   - Works identically across `harness.mjs run`, `harness.mjs lint`, and `harness.mjs fix`.
2. **Expanded Mechanical Auto-Fixes in `fragment-linter.mjs`**:
   - Automatically normalizes `steps-vertical sm:steps-horizontal` to `steps-horizontal` (preventing Tailwind CDN responsive DaisyUI class traps).
   - Automatically wraps bare `<canvas>` elements that lack a bounded relative height wrapper in `<div class="relative h-72 sm:h-80 w-full min-w-0">...</div>`.
3. **2-Speed Agent Workflow in `SKILL.md` Facades**:
   - Updates `skills/html-report/SKILL.md` (and sibling skill files) to promote `harness.mjs run --project <slug> --fast` (<150ms) for the inner authoring loop and `verify-report.mjs --quick` for final visual validation.
