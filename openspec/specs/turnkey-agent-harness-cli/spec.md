# turnkey-agent-harness-cli Specification

## Purpose

Provides a turnkey, project-aware `--project <slug>` workflow in `harness.mjs` that resolves `projects/<slug>/fragment.html` and `projects/<slug>/index.html` automatically, while expanding mechanical auto-fixes in `fragment-linter.mjs` to repair responsive DaisyUI stepper traps and bare `<canvas>` elements in a single sub-150ms command.

## Requirements

### Requirement: Project-Aware `--project <slug>` Flag in `harness.mjs`
`harness.mjs` (`run`, `lint`, `fix`) SHALL accept `--project <slug>`, automatically resolving `projects/<slug>/fragment.html` as the default input Semantic Fragment and `projects/<slug>/index.html` (or `projects/<slug>/published.html` when `--published` is set) as the default Output Deliverable.

#### Scenario: One-command fast lint, auto-fix, and assembly by project slug
- **WHEN** an agent runs `node skills/html-report/scripts/harness.mjs run --project q4-audit --title "Q4 Audit" --fast`
- **THEN** `harness.mjs` validates and auto-fixes `projects/q4-audit/fragment.html` and compiles `projects/q4-audit/index.html` in `<150ms` without requiring explicit input/output file paths.

### Requirement: Auto-Fix for Responsive DaisyUI Stepper Trap and Bare Canvas Elements
`lintFragment()` and `autoFixFragment()` SHALL detect and automatically repair `steps-vertical sm:steps-horizontal` class combinations and bare `<canvas>` elements that lack a bounded height container.

#### Scenario: Fragment with responsive stepper trap is auto-repaired during harness run
- **WHEN** a Semantic Fragment contains `<ul class="steps steps-vertical sm:steps-horizontal">`
- **THEN** `autoFixFragment()` rewrites the class to `steps steps-horizontal` so Tailwind Play CDN renders a horizontal stepper properly.
