# Tasks: Datastar.js Addon & Real-Time Live Dashboards with LLM-Agnostic Hook Streaming & Testing Harness

## Phase 1: Build CLI & Shell Integration
- [x] 1.1 Register Datastar in `ADDON_REGISTRY.datastar` and `ADDON_ALIASES` in `skills/html-report/scripts/build-report.mjs`
- [x] 1.2 Add auto-detection signatures for `data-signals`, `data-bind`, `data-on-`, `data-indicator`, etc.
- [x] 1.3 Implement `--live` CLI flag in `build-report.mjs`
- [x] 1.4 Update CSP `connect-src` in `skills/html-report/assets/template-shell.html` to allow `http:` and `https:`

## Phase 2: Runtime Rehydration & Signals Integration
- [x] 2.1 Add DOM `MutationObserver` in `skills/html-report/assets/report-runtime.js` to rehydrate Lucide icons post-morph
- [x] 2.2 Add theme change hook to dispatch active DaisyUI theme to Datastar signal if `$theme` is bound

## Phase 3: Task Telemetry Schema & LLM Adapters (AGY & Codex)
- [x] 3.1 Formalize `TaskTelemetrySchema`, `SessionState`, and `TaskItem` data model in `skills/html-report/scripts/datastar-sse.mjs`
- [x] 3.2 Implement `DatastarBridge` translating schema state transitions into `datastar-fragment` and `datastar-merge-signals`
- [x] 3.3 Implement `AgyTelemetryAdapter` mapping Antigravity transcripts and planner steps into the schema
- [x] 3.4 Implement `CodexTelemetryAdapter` mapping OpenAI stream chunks and tool calls into the schema

## Phase 4: Synthetic Simulation & De-Risking Test Harness
- [x] 4.1 Create `MockAgyStreamer` replaying sample AGY `transcript.jsonl` steps with simulated delays
- [x] 4.2 Create `MockCodexStreamer` replaying sample OpenAI streaming reasoning and tool chunks
- [x] 4.3 Add burst load test (100 events in 2s) to verify zero DOM corruption and stable memory in `tests/datastar-stream.test.mjs`
- [x] 4.4 Verify icon rehydration post-morph in headless Playwright environment

## Phase 5: Live Server Integration, Documentation & Showcase
- [x] 5.1 Add `/__datastar_stream__` endpoint in `skills/html-report/scripts/serve-report.mjs`
- [x] 5.2 Create architectural guide `skills/html-report/references/datastar-live-dashboards.md` with schema reference
- [x] 5.3 Update `skills/html-report/SKILL.md` with `--live` flag and Datastar patterns
- [x] 5.4 Add interactive live dashboard demo section to `skills/html-report/examples/example.html`
- [x] 5.5 Verify test suite and update living journey companion
