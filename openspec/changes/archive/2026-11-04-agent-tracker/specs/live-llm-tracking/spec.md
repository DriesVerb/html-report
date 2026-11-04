# Spec Delta

## MODIFIED Requirements

### Requirement: Datastar Live LLM Tracking Dashboard
The report MUST provide real-time hypermedia tracking components powered by Datastar.js and SSE (`/__datastar_stream__`) displaying LLM thoughts, tool calls, subagent activity, and task progress with live fragment morphing.

#### Scenario: Live Chain-of-Thought Stream
- **GIVEN** an active Datastar stream connection
- **WHEN** an agent emits a thought delta event
- **THEN** Datastar MUST append or morph the thought into `#agent-thought-stream` without page reload.

#### Scenario: Live Tool Invocation & Terminal Output
- **GIVEN** an active Datastar stream connection
- **WHEN** a tool call event is received
- **THEN** Datastar MUST prepend a tool invocation card to `#tool-call-feed` displaying tool name, arguments, status indicator, and collapsible terminal output drawer.

#### Scenario: Real-Time Task Card Morphing
- **GIVEN** a task item `#task-${id}` in the dashboard
- **WHEN** the server broadcasts a `datastar-fragment` with `selector: #task-${id}` and updated status
- **THEN** Datastar MUST morph the task card in-place, updating the status badge, checkbox, and completion state.

#### Scenario: Subagent Swarm Stream Routing
- **GIVEN** an active Datastar stream connection
- **WHEN** a subagent event is broadcast with a target conversation ID or subagent name
- **THEN** Datastar MUST route and morph the subagent fragment into the appropriate thread in `#agent-swarm-hierarchy`.
