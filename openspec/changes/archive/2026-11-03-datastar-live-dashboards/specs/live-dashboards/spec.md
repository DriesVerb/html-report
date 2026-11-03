# Capability Delta: Live Dashboards & Datastar Streaming

## ADDED REQUIREMENTS

### Requirement: Datastar CDN Addon Registration & CLI Ingestion
The build CLI MUST register Datastar in `ADDON_REGISTRY.datastar` and support auto-detection and explicit injection.

#### Scenario: Explicit Addon Flag
- **GIVEN** an HTML fragment with no library signatures
- **WHEN** running `node skills/html-report/scripts/build-report.mjs --addons datastar`
- **THEN** the output HTML MUST include `<script type="module" src="https://cdn.jsdelivr.net/npm/@starfederation/datastar@1.0.0-beta.9/dist/datastar.js"></script>`

#### Scenario: Convenience `--live` Flag
- **GIVEN** any report fragment
- **WHEN** running `node skills/html-report/scripts/build-report.mjs --live`
- **THEN** the builder MUST automatically enable the `datastar` addon and set `data-report-mode="live"` on the document root or body.

---

### Requirement: Task & Session Telemetry Schematic Language
The repository MUST provide a structured, deterministic schematic contract (`TaskTelemetrySchema`) in `skills/html-report/scripts/datastar-sse.mjs` representing sessions, phases, tasks, and tool calls.

#### Scenario: Schema State Ingestion & Metric Calculation
- **GIVEN** an active session initialized with 2 phases and 4 tasks
- **WHEN** 2 tasks are marked `completed` and 1 task is marked `running`
- **THEN** `SessionMetrics` MUST automatically compute `progressPct: 50`, `completedTasks: 2`, `runningTasks: 1`, and `totalTasks: 4`.

#### Scenario: Datastar Morph Generation from Task State
- **GIVEN** a task item transitioning from `pending` to `running`
- **WHEN** `DatastarBridge.dispatchTaskUpdate(task)` is called
- **THEN** it MUST emit a `datastar-fragment` targeting `#task-${task.id}` with `mergeMode: outer` containing the active task badge and spinner.

---

### Requirement: LLM-Agnostic Telemetry Pipeline (AGY & Codex)
The repository MUST provide a vendor-neutral telemetry normalization pipeline in `skills/html-report/scripts/datastar-sse.mjs` supporting Google Antigravity (AGY) and OpenAI Codex.

#### Scenario: AGY Transcript Ingestion
- **GIVEN** an instance of `AgyTelemetryAdapter` connected to a `DatastarBridge`
- **WHEN** processing an AGY transcript step with `thinking: "Planning step 2..."` and a `tool_calls` entry for `read_file`
- **THEN** the adapter MUST dispatch canonical events `thought.delta` and `tool.invoked` with valid arguments to the bridge without throwing.

#### Scenario: OpenAI Codex Stream Chunk Ingestion
- **GIVEN** an instance of `CodexTelemetryAdapter` connected to a `DatastarBridge`
- **WHEN** processing a streaming chunk containing `delta.reasoning_content` or `delta.tool_calls`
- **THEN** the adapter MUST dispatch canonical events `thought.delta` and `tool.invoked` to the bridge.

---

### Requirement: Post-Morph Icon & Widget Rehydration
The client runtime MUST observe DOM morphs triggered by Datastar and re-hydrate dynamic child elements.

#### Scenario: Lucide Icons in Morphed Fragment
- **GIVEN** a running report with `report-runtime.js` active
- **WHEN** Datastar morphs a fragment containing `<i data-lucide="check-circle"></i>`
- **THEN** `window.lucide.createIcons()` MUST be automatically executed so that the SVG vector icon replaces the `<i>` placeholder.

---

### Requirement: Simulation & Testing Harness
The test suite MUST include synthetic replayers to validate streaming resilience under burst loads.

#### Scenario: Synthetic Burst Test
- **GIVEN** a test runner replaying 100 simulated AGY or Codex events in under 2 seconds
- **WHEN** streaming to a test client
- **THEN** the resulting DOM MUST match the final schema state without duplicate task items, dropped cards, or unhandled exceptions.
