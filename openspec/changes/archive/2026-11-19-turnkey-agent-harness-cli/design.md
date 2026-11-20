# Design: Turnkey Project-Aware Agent Harness (`harness.mjs run --project <slug> --fast`)

> **Change:** `turnkey-agent-harness-cli` | **Proposal:** [proposal.md](proposal.md) | **Tasks:** [tasks.md](tasks.md) | **Journey:** [index.html](index.html)

## Technical Decisions

### 1. `--project <slug>` Resolution in `packages/core/scripts/lib/harness/cli.mjs` & `harness.mjs`
- Add `--project <slug>` (and `-P <slug>`) to `parseArgs()` in `packages/core/scripts/lib/harness/cli.mjs`.
- When `project` is specified:
  - If positional `file` is omitted, default `file` to `path.join("projects", project, "fragment.html")`.
  - If `output` is omitted, default `output` to `path.join("projects", project, published ? "published.html" : "index.html")`.
  - Forward `project` into `buildReport()` during the `ASSEMBLING` state so `#agent-manifest` and `meta[name="html-report-source"]` are stamped consistently.

### 2. Static Auto-Fix Transforms in `fragment-linter.mjs`
- **`STEPPER_RESPONSIVE_TRAP`**: Detect `steps-vertical\s+sm:steps-horizontal` in class attributes during `lintFragment()` (`fixable: true`) and replace with `steps-horizontal` in `autoFixFragment()`.
- **`BARE_CANVAS_WRAPPER`**: Detect `<canvas\b[^>]*>[\s\S]*?<\/canvas>` whose immediate parent lacks a bounded height utility (`h-\d+`, `h-full`, `min-h-`) during `lintFragment()` (`fixable: true`) and wrap in `<div class="relative h-72 sm:h-80 w-full min-w-0">...</div>` in `autoFixFragment()`.

### 3. Streamlined `SKILL.md` Workflow
- Update `skills/html-report/SKILL.md` Step 2 to feature:
  ```bash
  # One-shot <150ms inner loop: Lint + Auto-Fix + Assemble into projects/<slug>/index.html
  node skills/html-report/scripts/harness.mjs run --project q4-audit --title "Q4 Audit" --fast
  ```
- Keep all 6 `SKILL.md` facades strictly under `5,120` bytes and compliant with `UBIQUITOUS_GLOSSARY`.
