# Spec Delta: Bidirectional HTML &harr; Agent Interactive Loop

## Purpose
Enables users viewing an HTML report or dashboard to prompt an autonomous AI agent directly from within the report, inspect DOM and chart element context, stream real-time Datastar SSE fragment updates, and approve mutating agent actions.

## ADDED Requirements

### Requirement: Floating & Keyboard-Invocable Agent Prompt Dock
The browser report shell MUST provide a persistent floating prompt dock (`HTMLReportAgentDock`) that can be opened via button click or keyboard shortcut (`Cmd+K` / `Ctrl+K`).

#### Scenario: Toggling the agent dock via keyboard shortcut
- **GIVEN** a rendered report loaded with `report-runtime.js`
- **WHEN** the user presses `Cmd+K` or `Ctrl+K`
- **THEN** the floating agent dock toggles its visibility between collapsed and expanded
- **AND** focuses the prompt input field.

### Requirement: Element-Level DOM & Chart Context Serialization
The client runtime MUST serialize the DOM snippet, Chart.js dataset state, table data, and theme attributes for any targeted element without exceeding a 10KB payload limit.

#### Scenario: Serializing element context with attached Chart.js data
- **GIVEN** a card or container element containing a canvas with an active Chart.js instance
- **WHEN** `HTMLReportAgent.serializeElementContext(el)` is called
- **THEN** it returns a structured object containing `elementId`, `selector`, `domSnippet`, `datasetState`, and `activeTheme`
- **AND** the serialized JSON payload size is strictly less than 10,240 bytes.

### Requirement: Dev Server Multi-Turn Session Tracking & Streaming Prompt API
The dev server MUST expose `POST /api/agent/prompt` with multi-turn session tracking in `SessionState` retaining conversation continuity across turns and pruning sessions inactive for 15 minutes.

#### Scenario: Submitting multi-turn prompt and receiving Datastar SSE fragments
- **GIVEN** an active dev server running with `serve-report.mjs`
- **WHEN** a client submits a prompt with a `sessionId` and `targetSelector`
- **THEN** the server maintains conversation history across successive turns
- **AND** streams real-time updates via Datastar SSE `datastar-merge-fragments`.

### Requirement: Interactive Guardrails for Mutating Agent Actions
When an agent proposes state-mutating actions (recalculating metrics, applying filters, or updating parameters), the system MUST render an interactive confirmation card requiring explicit user approval before execution.

#### Scenario: User approval of a proposed mutating action
- **GIVEN** an agent response containing a proposed mutating action with an action ID
- **WHEN** the user clicks "Approve" on the confirmation card
- **THEN** the client dispatches approval to `POST /api/agent/confirm-action`
- **AND** the server executes the action and returns verified confirmation.
