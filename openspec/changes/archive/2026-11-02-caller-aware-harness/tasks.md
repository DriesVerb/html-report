# Tasks: Caller-Aware Deterministic State Machine Harness

## 1. Dual-Mode FSM State Architecture & Caller Resolution
- [x] 1.1 Extend `STATES` in `harness.mjs` with `RESOLVING_CALLER` and `RECORDING_RUN`.
- [x] 1.2 Implement conditional mode fork: bypass caller states completely when `--caller` is omitted (Standalone Mode).
- [x] 1.3 Integrate `caller-registry.mjs` resolution into `harness.mjs` strictly when `--caller` flag is passed.
- [x] 1.4 Add CLI argument `--run-id` and `--theme` overrides to `parseArgs()` in `harness.mjs`.

## 2. Profile-Driven Deterministic Assembly & Output Routing
- [x] 2.1 Pass profile `default_theme`, `required_cdns`, and `reportMode` into `buildReport()` during `ASSEMBLING` state when in caller-aware mode.
- [x] 2.2 Wire caller-aware default output path routing to `./report-<callerId>.html` (and `./report-<callerId>.pdf`) when `--output` is unspecified; preserve `./report.html` for standalone mode.
- [x] 2.3 Verify runtime overrides take precedence over caller profile defaults while maintaining non-destructive profile integrity.

## 3. Ephemeral Vault Run Lifecycle & Trace Recording
- [x] 3.1 Implement structured `run.json` and `trace.json` persistence inside `.caller-requests/runs/<callerId>/<runId>/` during `RECORDING_RUN` in caller mode.
- [x] 3.2 Ensure `pruneRuns()` is triggered after run completion, maintaining the strict 10-run limit per caller.
- [x] 3.3 Link multi-attempt retries using `--run-id` so remediation diagnostics and final completion are correlated in the same run folder.

## 4. Test Suite, Verification & Companion Dashboard
- [x] 4.1 Create test suite `tests/caller-harness-integration.test.mjs` verifying:
  - Zero filesystem side-effects in standalone mode (no `.caller-requests` created or modified).
  - Proper FSM transitions, profile overrides, vault traces, and output routing in caller mode.
- [x] 4.2 Verify all existing test suites (`node --test`) remain 100% green with zero regressions.
- [x] 4.3 Build and serve the companion HTML dashboard on `http://localhost:3000` reflecting live journey state.
