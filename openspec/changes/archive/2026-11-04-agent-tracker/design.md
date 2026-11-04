# Design: Publication-Grade Live Agent Tracker (`agent-tracker`)

## Context
See [proposal.md](proposal.md) for background and motivation. To avoid vendor lock-in and support diverse autonomous agents (Google Antigravity, Anthropic Claude Code, OpenAI Codex, Cursor, etc.), the architecture adopts the **Facade + Strategy Pattern**:
1. **Agent-Agnostic Facade (`AgentTrackerFacade`)**: A unified API surface that shields consumers from provider idiosyncrasies.
2. **Pluggable Strategies (`AgentTelemetryStrategy`)**: Dedicated strategy implementations that encapsulate vendor-specific parsing, schema normalization, and tool call extraction.
3. **Live Side-by-Side Verification (`current-feature.html`)**: A dedicated live verification environment where developers can observe the feature preview and the strategy verification runner side-by-side on `http://localhost:3000/current-feature.html`.

## Architecture Overview
```mermaid
flowchart TD
    subgraph MultiAgentRuntimes["Diverse Agent Runtimes & Formats"]
        AGY["Google Antigravity\n(transcript.jsonl steps)"]
        Claude["Anthropic Claude Code\n(tool_use & thinking_delta)"]
        Codex["OpenAI Codex / Swarm\n(chat completion tool_calls)"]
        Generic["Custom Agent / Webhook\n(REST JSON telemetry)"]
    end

    subgraph StrategyLayer["Telemetry Strategy Layer (Design Pattern)"]
        StrategyInterface["<<interface>>\nAgentTelemetryStrategy\n+ canHandle(raw)\n+ normalize(raw)\n+ extractHeartbeat()\n+ extractActiveTool()\n+ extractThought()"]
        
        AgyStrat["AgyTelemetryStrategy"]
        ClaudeStrat["ClaudeCodeTelemetryStrategy"]
        CodexStrat["CodexSwarmTelemetryStrategy"]
        GenericStrat["GenericTelemetryStrategy"]

        StrategyInterface <|-- AgyStrat
        StrategyInterface <|-- ClaudeStrat
        StrategyInterface <|-- CodexStrat
        StrategyInterface <|-- GenericStrat

        AGY --> AgyStrat
        Claude --> ClaudeStrat
        Codex --> CodexStrat
        Generic --> GenericStrat
    end

    subgraph FacadeLayer["Unified Agent Tracker Facade"]
        Facade["AgentTrackerFacade\n+ setStrategy(strategy)\n+ ingest(rawPayload)\n+ getCanonicalState()\n+ broadcastDatastarFragment()"]
        AgyStrat --> Facade
        ClaudeStrat --> Facade
        CodexStrat --> Facade
        GenericStrat --> Facade
    end

    subgraph DevServer["Dev Server (serve-report.mjs)"]
        SSEHub["/__datastar_stream__ (SSE Hub)"]
        Facade --> SSEHub
    end

    subgraph Verification["Live Side-by-Side Verification (current-feature.html)"]
        direction LR
        subgraph ColLeft["Left Column: Live Feature Preview"]
            LiveObserver["Live Core Observer\n- Heartbeat Pill & Stopwatch\n- Active Tool Running\n- Latest Intent Bubble\n- Recent Action Feed"]
        end
        subgraph ColRight["Right Column: Strategy & Test Harness"]
            StrategySwitcher["Strategy Selector (AGY, Claude, Codex)\n- Raw Vendor Payload View\n- Normalized Canonical Event View\n- Live Assertion Check Suite"]
        end
        SSEHub --> ColLeft
        StrategySwitcher -->|Triggers Simulated Ingest| Facade
    end
```

## Goals / Non-Goals

**Goals:**
- **Strict Vendor Independence**: Core tracking logic and UI components consume only normalized canonical events (`AgentHeartbeatState`, `ActiveToolRecord`, `ThoughtRecord`).
- **Pluggable Strategy Pattern**: Adding a new agent provider requires only writing a single `AgentTelemetryStrategy` subclass with 0 changes to UI or server logic.
- **Dedicated Live Verification (`current-feature.html`)**: Interactive side-by-side environment demonstrating that Antigravity, Claude Code, and Codex all normalize into identical high-fidelity tracker states.
- **Outside-In Simple-to-Hard Phasing**: Phase 1 delivers the Core Observer and Strategy Facade; Phase 2 adds deep tool inspection and attention alerts; Phase 3 adds multi-agent swarms and system daemons.

**Non-Goals:**
- Reverse-engineering closed proprietary encryption or tampering with agent authentication.
- Implementing heavy vendor SDKs; normalization is done via lightweight pure JavaScript object mappers.

## Decisions

### Decision 1: Facade + Strategy Pattern over Vendor-Specific Endpoints
- **Choice**: A single `AgentTrackerFacade` backed by dynamic `AgentTelemetryStrategy` implementations.
- **Rationale**: Providers frequently evolve their JSON formats (e.g. Claude Code introducing `thinking_delta`, OpenAI changing `tool_calls`). Encapsulating vendor variance behind a Strategy isolates changes to a single mapper file.
- **Alternatives Considered**: Creating separate `/agy_stream` and `/claude_stream` endpoints (causes endpoint proliferation and duplicates UI rendering code).

### Decision 2: Dedicated Side-by-Side Verification Page (`current-feature.html`)
- **Choice**: Serve `current-feature.html` directly from dev server root with split layout: left column shows the feature in real time, right column shows the strategy runner and assertions.
- **Rationale**: Gives the developer instantaneous visual confirmation that the feature works across multiple agent providers without guessing or inspecting hidden console logs.

## Risks / Trade-offs
- **[Risk] Schema differences across models**: Different LLMs handle tool inputs as JSON strings, objects, or partial chunks.
  - *Mitigation*: The Strategy layer includes safe JSON parsing with fallback stringification to guarantee no unhandled exceptions crash the tracker.

## References
- Comprehensive OpenAI Codex, Function Calling & Swarm Guide: [openai-codex-telemetry-reference.md](../../../skills/html-report/references/openai-codex-telemetry-reference.md)
- Datastar Live Hypermedia Streaming Guide: [datastar-live-dashboards.md](../../../skills/html-report/references/datastar-live-dashboards.md)
- Architecture & Styling Blueprint: [architecture-and-styling.md](../../../skills/html-report/references/architecture-and-styling.md)
