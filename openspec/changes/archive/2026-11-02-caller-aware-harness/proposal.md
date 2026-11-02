# Proposal: Caller-Aware Deterministic State Machine Harness

## Why

Currently, our system features two highly capable standalone architectures:
1. **The Deterministic State Machine Harness (`harness.mjs`)**: Orchestrates the compilation lifecycle through an explicit pure-Node.js FSM (`IDLE -> VALIDATING -> AUTO_FIXING -> ASSEMBLING -> VERIFYING -> REMEDIATING -> COMPLETED / FAILED`), providing sub-2ms startup, mechanical auto-fixing, bounded 3-attempt retries, and spoon-fed JSON diagnostics.
2. **The Caller-Aware Integration Engine (`caller-registry.mjs`)**: Provides a gitignored vault (`.caller-requests/`), YAML frontmatter caller profiles, zero-configuration auto-scaffolding, leaf caller resolution, 10-run pruning lifecycle, and default CWD output routing (`./report-<caller>.html`).

However, these two systems currently operate in disconnected silos. When an external agent or calling tool (e.g., `memory-leak-debugging` or `debug-optimize-lcp`) invokes `harness.mjs run fragment.html --caller <id>`:
- The harness ignores caller profiles and uses hardcoded default themes instead of the caller's requested palette and mandatory CDNs.
- Output routing defaults to generic `./report.html` rather than the caller's contextual `./report-<caller>.html`.
- Run diagnostics, FSM state history, and remediation directives are not persisted into the caller's ephemeral run vault (`.caller-requests/runs/<caller>/<run-id>/`).
- Retry attempts cannot correlate across invocations because ephemeral run state is lost between CLI executions.

### Core Design Philosophy: Progressive Complexity & Zero Standalone Footprint

Crucially, **the skill must remain lightweight, simple, and unencumbered when invoked by itself**. When a developer or direct user prompt uses `html-report` or `harness.mjs` standalone (without `--caller`), the tool must operate with **Zero Added Complexity**:
- **Zero Vault Clutter**: Does not read, touch, or create `.caller-requests/` or profile files.
- **Zero Overhead**: Bypasses caller resolution and run persistence states entirely.
- **Predictable Local Outputs**: Compiles directly to `./report.html` using the standard light theme.
- **Strictly Opt-In Complexity**: Advanced caller mechanisms (profile resolution, schema validation, 3-tier merging, vault trace logging, run pruning) activate **only** when `--caller <id>` is explicitly passed.

## What Changes

- **Progressive Dual-Mode FSM Lifecycle**:
  - **Standalone Mode (No `--caller`)**: Pure 6-state execution (`IDLE` -> `VALIDATING` -> `AUTO_FIXING` -> `ASSEMBLING` -> `VERIFYING` -> `COMPLETED / FAILED`). Zero vault interactions, zero profile scaffolding.
  - **Caller-Aware Mode (With `--caller <id>`)**: Activates the full 10-state lifecycle, including `RESOLVING_CALLER` (profile loading, compatibility check, 3-tier merge, output routing) and `RECORDING_RUN` (vault `run.json`/`trace.json` persistence and 10-run pruning).
- **Profile-Driven Deterministic Assembly (Caller-Only)**:
  - In caller-aware mode, `harness.mjs` automatically injects caller profile attributes (`default_theme`, `required_cdns`, `reportMode`) into `buildReport()` while honoring runtime CLI flags (`--theme`, `--pdf`, `--printable`, `--mode`).
- **Caller-Aware Default Output Routing**:
  - In caller-aware mode without `--output`, defaults to `./report-<leafCaller>.html` (and `./report-<leafCaller>.pdf`). In standalone mode, retains standard `./report.html`.
- **Correlated Multi-Attempt Remediation (Caller-Only)**:
  - External callers receive persistent `runId` and `vaultTracePath`. Retries with `--attempt 2 --run-id <runId>` update the existing run folder in `.caller-requests/runs/`.
- **Zero-Dep Pure Node Guarantee**:
  - 100% standard library built-ins (`node:fs`, `node:path`, `node:child_process`, `node:crypto`). Sub-2ms startup on any Node 18+ system.

## Capabilities

### New Capabilities
- `caller-harness-orchestration`: Unified FSM orchestration marrying caller profile resolution, 3-tier configuration merging, preflight linting/auto-fixing, deterministic report assembly, verification, bounded remediation, and vault run lifecycle management into a single-command CLI.

### Modified Capabilities
- `harness-orchestration`: Extended with dual-mode execution guaranteeing zero standalone footprint when `--caller` is omitted.
- `profile-resolution`: Interfaced directly with the FSM pipeline for external callers.

## Impact & Scope

- **Affected Files**:
  - `skills/html-report/scripts/harness.mjs` (dual-mode FSM execution and caller-registry integration)
  - `skills/html-report/scripts/caller-registry.mjs` (vault run trace helpers and harness hooks)
  - `skills/html-report/SKILL.md` (updated documentation with standalone vs. caller workflows)
  - `tests/caller-harness-integration.test.mjs` (dual-mode tests including zero standalone side-effect verification)
- **Zero Regression & Backward Compatibility**: Standalone behavior is mathematically invariant; existing commands and tests continue to work with identical inputs and outputs.
