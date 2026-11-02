# Proposal: Deterministic State Machine Harness & Remediation Orchestrator

## Why
While `build-report.mjs` and `verify-report.mjs` provide fast local execution, LLM agents—especially smaller, faster, or less capable models (e.g. Flash-Lite, local open-weight models, or constrained subagents)—frequently struggle with multi-step workflows. They hallucinate CLI options, skip verification steps, fail to interpret raw Playwright headless traces, and enter unbounded hallucination loops when CSS overflows occur.

Introducing a zero-dependency, package-manager-free deterministic state machine harness establishes a strict mathematical lifecycle around report generation. By wrapping the pipeline in an FSM supervisor with pre-flight auto-fixes and prescriptive "spoon-fed" JSON remediation directives, the skill becomes completely agnostic, blisteringly fast (<2ms startup), and dramatically easier for less capable models to operate reliably.

## What Changes
- **Zero-Dependency Harness CLI (`scripts/harness.mjs`)**: Native Node.js FSM with zero package manager requirements (`node:fs`, `node:path`, `node:child_process`). Runs instantly on any system with Node 18+ without `npm install` or `pnpm`.
- **Small-Model First Single-Command Surface**: Replaces the multi-step manual script sequence with a single command (`node skills/html-report/scripts/harness.mjs run --content fragment.html --title "Report Title"`).
- **Deterministic Pre-Flight Auto-Fix Engine (`--auto-fix`)**: Mechanically cures trivial model errors in <1ms (stripping accidental `<html>`/`<body>` wrappers, auto-slugifying missing `id` attributes on `h1-h3` headers) before invoking compiler or browser.
- **Spoon-Fed Remediation Protocol (Error-as-Instruction)**: Outputs machine-readable JSON containing exact DOM selectors, offending line numbers, and literal copy-paste fix instructions tailored for smaller models.
- **Bounded Retry Supervisor**: Enforces a strict 3-attempt ceiling with terminal failure transitions, preventing runaway token usage and infinite loops.

## Capabilities

### New Capabilities
- `harness-orchestration`: Explicit state machine supervisor coordinating fragment validation, auto-fixing, report assembly, verification execution, and terminal lifecycle transitions without package manager dependencies.
- `structured-remediation`: Machine-parsed diagnostic analysis of Playwright and runtime errors returning prescriptive JSON remediation directives and auto-fix transforms for bounded agent recovery.

### Modified Capabilities
None.

## Impact
- **Affected Files**:
  - `skills/html-report/scripts/harness.mjs` (new)
  - `skills/html-report/SKILL.md` (updated workflow pointing to single-command harness)
  - `skills/html-report/references/harness-architecture.md` (harness reference)
  - `tests/harness-linter.test.mjs`, `tests/harness-lifecycle.test.mjs`, `tests/harness-remediation.test.mjs` (new tests)
- **Backward Compatibility**: Fully backward compatible. Standalone scripts (`build-report.mjs`, `verify-report.mjs`, `caller-registry.mjs`) remain functional as underlying building blocks.
