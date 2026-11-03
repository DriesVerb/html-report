# Proposal: Datastar.js Addon & Real-Time Live Dashboards with LLM-Agnostic Hook Streaming & Task Telemetry Schema

## Why
`html-report` excels at generating publication-grade, self-contained HTML5 reports and PDF-ready documents. Modern analytical workflows and autonomous agent frameworks require **live dashboards** that stream real-time events without heavy front-end builds (such as React, Vue, or Webpack):
1. **Real-Time LLM Hook & Thought Streaming**: Autonomous agents generate progressive thoughts, reasoning chains (Chain-of-Thought), tool invocations, and file edits. Reviewers benefit from a live-morphing UI to inspect progress rather than watching raw terminal logs.
2. **Standardized Task & Session Telemetry Schema**: A formal schematic language (`TaskTelemetrySchema`) defining session lifecycles, phases, task states (`pending`, `running`, `completed`, `failed`), and tool calls gives Datastar a predictable contract to stream over SSE.
3. **LLM-Agnostic Telemetry Standard**: Normalizing heterogeneous events from **Google Antigravity (AGY)** and **OpenAI Codex** into a canonical schema decouples the UI from model providers.
4. **Surgical Live DOM Morphing**: Replaces disruptive full-page browser reloads in `serve-report.mjs` with fine-grained SSE morphing (`Idiomorph`).

---

## Scope De-Risking & Pragmatic Phasing

> [!IMPORTANT]
> **De-Risking Principle**: Highly ambitious runtime interventions (such as "Pause Agent", thread cancellation, or mid-stream prompt steering) introduce complex concurrency, race conditions, and provider-specific execution state hazards. 
> 
> To ensure stability and reliability, **Phase 1 through Phase 3 focus exclusively on passive, read-only observability and robust test harness validation**. All bidirectional execution controls are deferred to an isolated future phase subject to spike testing.

### What is In Scope (Phases 1–3)
* **Passive Read-Only Observability**: Streaming Chain-of-Thought, tool invocation cards, and task progress checklists.
* **Deterministic Schema & Adapters**: Ingesting AGY transcript steps and Codex streaming chunks.
* **Synthetic Test Harness**: Simulating agent streams with mocked event emitters to verify DOM stability, rehydration, and memory overhead under high frequency.
* **Live Dev Server Integration**: Morphing report updates into `localhost:3000` via SSE.

### What is Explicitly Deferred (Future Phase)
* **Agent Execution Controls**: "Pause Agent", "Cancel Run", or runtime process suspension.
* **Interactive Steering Injections**: Modifying prompt context mid-flight.

---

## Architectural Decisions

* **D1 (Passive-First Telemetry Engine)**:
  Prioritize unidirectional SSE telemetry (`Agent -> SSE Hub -> Datastar -> DOM`). The browser acts as an observer without mutating the agent's internal control loop.
* **D2 (Formal Task & Session Telemetry Schema)**:
  Define a strict, JSON-schema-compliant schematic contract (`TaskTelemetrySchema`):
  - `SessionState`: `sessionId`, `agentType` (`agy` | `codex`), `status`, `metrics`.
  - `PhaseDefinition`: Ordered phases (`phaseId`, `title`, `status`, `tasks`).
  - `TaskItem`: Granular tasks (`id`, `title`, `status`, `toolCalls`, `artifacts`).
* **D3 (Synthetic Simulation Test Harness First)**:
  Before running against live agent processes, build standalone test fixtures (`MockAgyStreamer`, `MockCodexStreamer`) that replay historical transcripts and streaming chunks to verify rendering stability, no-flicker morphing, and zero memory leaks.
* **D4 (On-Demand Addon Ingestion & `--live` Flag)**:
  Datastar is registered in `ADDON_REGISTRY.datastar` with explicit regex signatures. A `--live` CLI flag enables Datastar and sets `data-report-mode="live"`.
* **D5 (Autonomous Post-Morph Runtime Re-Hydration)**:
  A lightweight `MutationObserver` in `report-runtime.js` automatically rehydrates Lucide icons and badges when Datastar applies DOM patches.

---

## Capabilities

### New Capabilities
* `live-dashboards`: First-class support for Datastar.js reactive signals, backend SSE streaming, hot DOM morphing, formal `TaskTelemetrySchema` validation, and synthetic test harness for AGY and Codex.
