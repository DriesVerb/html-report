# agent-tracker Specification

## Purpose
Provides comprehensive real-time multi-agent activity monitoring, live transcript tailing, interactive tool execution inspection with visual diffs, subagent swarm hierarchy tracking, and context/token telemetry dashboard.

## Requirements

### Requirement: Agent-Agnostic Facade & Strategy Normalization Engine
The agent tracker SHALL provide an `AgentTrackerFacade` utilizing the Strategy pattern (`TelemetryAdapterStrategy`) to decouple the tracker from specific LLM vendors, normalizing events from Google Antigravity, Claude Code, OpenAI Codex, and generic webhooks into a unified canonical event schema.

#### Scenario: Normalizing Google Antigravity transcript step
- **GIVEN** an active `AgentTrackerFacade` configured with `AgyTelemetryStrategy`
- **WHEN** a raw Antigravity step with `thinking` and `tool_calls` is ingested
- **THEN** the facade MUST normalize the event into a canonical `AgentHeartbeatState` and `ActiveToolRecord` without provider-specific schema leakage.

#### Scenario: Normalizing Claude Code tool_use and thinking blocks
- **GIVEN** an active `AgentTrackerFacade` configured with `ClaudeCodeTelemetryStrategy`
- **WHEN** a raw Claude Code event with `content_block` containing `type: "tool_use"` or `type: "thinking"` is ingested
- **THEN** the facade MUST extract the tool name, input arguments, and reasoning text into canonical tracker records.

#### Scenario: Normalizing OpenAI Codex function calls
- **GIVEN** an active `AgentTrackerFacade` configured with `CodexSwarmTelemetryStrategy`
- **WHEN** a chat completion chunk with `delta.tool_calls` is received
- **THEN** the facade MUST normalize the function name, parsed JSON arguments, and execution state into the canonical schema.

---

### Requirement: Live Side-by-Side Feature Verification (current-feature.html)
The dev server and report harness SHALL provide a dedicated live verification dashboard at `/current-feature.html` displaying the active agent tracker side-by-side with an interactive strategy switcher, raw event payload inspector, and multi-model test driver.

#### Scenario: Accessing live verification side-by-side view
- **GIVEN** the dev server running on `http://localhost:3000`
- **WHEN** a user navigates to `/current-feature.html` or clicks the link from `index.html`
- **THEN** the server MUST serve the live verification page rendering the Core Observer on the left and the Strategy verification runner on the right.

#### Scenario: Switching agent strategies dynamically
- **GIVEN** the live verification dashboard open at `/current-feature.html`
- **WHEN** the user selects a different agent strategy (e.g. Claude Code or OpenAI Codex) and clicks simulate
- **THEN** the dashboard MUST ingest the raw vendor event, demonstrate strategy normalization in the inspector, and update the Core Observer display in real time.

---

### Requirement: Live Transcript Tailing Daemon
The agent tracker system SHALL provide a file-watching daemon (`agent-tracker.mjs`) that automatically locates and tails active agent conversation transcripts (`transcript.jsonl` and `transcript_full.jsonl`), parsing events in real time and streaming updates via SSE.

#### Scenario: Auto-detecting and streaming active conversation steps
- **GIVEN** an agent executing tasks in a workspace
- **WHEN** the agent writes new steps (`USER_INPUT`, `PLANNER_RESPONSE`, `thinking`, or `tool_calls`) to `transcript.jsonl`
- **THEN** the tailing daemon MUST parse each step, extract reasoning and tool calls, and push Datastar SSE fragments to `/__datastar_stream__` with sub-100ms latency.

---

### Requirement: Multi-Agent Swarm & Subagent Hierarchy Visualizer
The dashboard SHALL provide a multi-agent hierarchy view representing orchestrator agents and subagents spawned via `invoke_subagent`, displaying agent roles, live states, and parent-child delegation links.

#### Scenario: Subagent invocation visualization
- **GIVEN** a running orchestrator agent session
- **WHEN** the orchestrator invokes a subagent via `invoke_subagent`
- **THEN** the dashboard MUST render a nested subagent card within `#agent-swarm-hierarchy` showing its `TypeName`, `Role`, live execution status badge, and dedicated thought/tool feed.

---

### Requirement: Interactive Tool Execution & Live Code Diff Inspector
The dashboard SHALL render rich tool execution cards featuring live elapsed execution stopwatches, ANSI-highlighted terminal drawers, and side-by-side or unified diff previews for file modification tools (`edit_file`, `write_file`).

#### Scenario: Live code diff inspection
- **GIVEN** an active tool invocation for `edit_file` or `write_file`
- **WHEN** the event is received with Target and Replacement text
- **THEN** the tool card MUST render a syntax-highlighted diff view highlighting additions and removals with line numbers.

---

### Requirement: Context Window & Token Velocity Telemetry
The dashboard SHALL provide real-time telemetry gauges displaying context window saturation percentage, token velocity (tokens/sec), and breakdown across prompt, reasoning, and completion tokens.

#### Scenario: Real-time context saturation gauge
- **GIVEN** an active agent session streaming telemetry
- **WHEN** token usage updates are received
- **THEN** the dashboard MUST update the context saturation radial gauge and token breakdown counters without full-page reloads.

---

### Requirement: Human-in-the-Loop Attention & Status Alerts
The dashboard SHALL provide configurable audio and visual alerts when an agent transitions into a state requiring human attention (`Waiting on User` or `Error`), along with thread-level filtering controls.

#### Scenario: Alert on user input required
- **GIVEN** the dashboard is open in the browser
- **WHEN** an agent issues an `ask_question` tool call or enters an idle state waiting for user response
- **THEN** the dashboard MUST display a prominent amber attention badge and trigger an optional chime sound.
