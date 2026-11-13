# reactive-data-copilot Specification

## Purpose
Enables real-time, vendor-neutral coupling between live heterogeneous data and media streams (visual images like Pokémon sprites, weather API feeds, and financial charts) and autonomous AI agent commentary over Datastar hypermedia Server-Sent Events (SSE).

## Requirements

### Requirement: Normalized Multimodal Telemetry Reactor Contract
The system MUST define a vendor-neutral schematic contract (`TelemetryReactorSchema`) supporting discriminated modalities: `time-series`, `environmental-api`, and `visual-image`.

#### Scenario: Ingestion of Visual Image Event (e.g. Pokémon Picture)
- **WHEN** a visual element emits an event with `modality: "visual-image"`, an image URI, and entity metadata
- **THEN** the reactor validates the event schema, assigns a monotonic event sequence ID, and forwards it to the multimodal pipeline without throwing.

#### Scenario: Ingestion of Weather API Feed Event
- **WHEN** a declarative public feed emits an event with `modality: "environmental-api"` containing temperature, humidity, and alert flags
- **THEN** the reactor validates the schema and checks for environmental anomaly thresholds.

### Requirement: Windowed Anomaly and Threshold Trigger Policies
The system MUST provide configurable debounce, statistical thresholding, and anomaly filters so that LLM inference is triggered only on meaningful data transitions.

#### Scenario: Suppression of Routine Weather & Ticker Jitter
- **WHEN** incoming metric fluctuations remain within baseline thresholds (delta < 1% or temperature change < 0.5°C)
- **THEN** the reactor suppresses LLM inference calls while updating rolling telemetry windows.

#### Scenario: Activation on Sudden Environmental or Visual Transition
- **WHEN** a sudden weather alert is flagged or a new distinct image entity is presented
- **THEN** the reactor immediately schedules an evaluation cycle and notifies the attached `AgentReactorInterface`.

### Requirement: Vendor-Neutral Multimodal Agent Reactor Interface
The system MUST provide an abstract reactor interface supporting multimodal engines (Google Gemini / AGY, OpenAI GPT-4o, Anthropic Claude, and local vision LLMs).

#### Scenario: Streaming Multimodal Commentary Delta
- **WHEN** a multimodal agent reactor processes an image or weather event and yields token chunks
- **THEN** the bridge dispatches Datastar SSE fragments targeting `#agent-reaction-bubble` to live subscribers over `/__datastar_stream__`.

### Requirement: Interactive Multimodal Showcase Component
The report MUST provide a publication-grade DaisyUI component offering interactive tabs across financial charts, visual image recognition, and weather API feeds paired with live agent commentary.

#### Scenario: Live DOM Morphing of Agent Sentiment and Insights
- **WHEN** an agent emits a sentiment update (e.g. Bullish/Bearish or Weather Advisory) with accompanying analysis
- **THEN** the Datastar client morphs the sentiment badge and appends the reasoning card with timestamp synchronization.

### Requirement: Agent-Agnostic Turnkey AI Inference Router
The Turnkey AI Bridge in `serve-report.mjs` SHALL NOT hardcode a dependency on `agy` CLI alone; it SHALL route prompts through an agent-agnostic `AgentInferenceRouter` that supports configurable or auto-detected CLI harnesses (`claude`, `gemini`, `codex`, `opencode`, `agy`, `ollama`, or `HTML_REPORT_AI_CMD`) as well as direct HTTP LLM APIs (`HTML_REPORT_AI_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`).

#### Scenario: Routing inference via an available non-agy provider
- **WHEN** `agy` is not installed on the host machine, but another supported CLI harness (such as `claude`, `gemini`, `codex`, or `opencode`), custom `HTML_REPORT_AI_CMD`, or HTTP API key is configured
- **THEN** `/api/agent/prompt` dispatches the prompt through the detected provider and returns HTTP `200` with `provider` metadata identifying the active backend.

### Requirement: Honest Inference Failure Semantics (No Unflagged Synthetic Analysis)
When no AI inference provider is available or the active provider fails or times out, `/api/agent/prompt` MUST return HTTP `503 Service Unavailable` with a structured JSON error payload (`{ status: "error", code: "inference_unavailable", error, reason, preflight }`) and MUST NOT fabricate analytical findings (such as hardcoded `"14.2%"` improvements) or queue synthetic pending metric actions unless `payload.heuristic === true` is explicitly requested by the caller.

#### Scenario: Live prompt fails when no AI provider is available
- **WHEN** a client sends `POST /api/agent/prompt` without `heuristic: true` and no supported CLI or HTTP AI provider is available or execution fails
- **THEN** the server responds with HTTP `503` and `{ status: "error", code: "inference_unavailable" }`, without generating synthetic analytical claims or storing pending actions.

#### Scenario: Explicit heuristic test mode remains supported
- **WHEN** a client or test harness sends `POST /api/agent/prompt` with `{ "prompt": "...", "heuristic": true }`
- **THEN** the server returns HTTP `200` with a clearly labeled heuristic demo response (`mode: "heuristic"`).

### Requirement: AI & Environment Preflight Endpoint & Separated 3-Channel Status Indicators
The report server SHALL expose `GET /api/agent/preflight` (and include `preflight` details on `GET /api/agent/health`) reporting independent fields for `uiConfigured`, `bridgeReachable`, `providerAvailable`, `activeProvider`, `checkedProviders`, `streamConnected`, and `modelConfigured`, and the client runtime (`report-runtime.js`) SHALL display distinct status labels for Stream (`SSE`), Bridge (`HTTP`), and AI Inference rather than a single hardcoded `"Online • Datastar SSE"` string.

#### Scenario: Preflight inspection on a host without any configured AI provider
- **WHEN** a client requests `GET /api/agent/preflight` on a host where the server is running on port `3031` but no AI CLI or API key is available
- **THEN** the response returns HTTP `200` with `bridgeReachable: true`, `providerAvailable: false`, `activeProvider: null`, and `checkedProviders` listing all probed backends so the UI dock accurately labels AI inference as unavailable while keeping SSE/board features online.

### Requirement: Turnkey `/events` Datastar SSE & `/api/board/state` Starter Contract
The report server (`serve-report.mjs`) SHALL provide a built-in `/events` Server-Sent Events endpoint (with 15-second heartbeat comments and Datastar `datastar-merge-fragments` support) paired with `GET /api/board/state` and `POST /api/board/state` (with JSON payload validation and same-origin protection) so `live-report` and `dashboard` projects work without custom server wrappers.

#### Scenario: Saving board state broadcasts a Datastar fragment update over `/events`
- **WHEN** a client subscribes to `GET /events` and submits a valid JSON payload to `POST /api/board/state` from the same origin
- **THEN** the server persists the state, returns HTTP `200`, and broadcasts a `datastar-merge-fragments` SSE event updating `#live-board-status` on connected clients.

#### Scenario: Cross-origin POST to `/api/board/state` is rejected
- **WHEN** a request to `POST /api/board/state` carries an `Origin` header that does not match the server's host
- **THEN** the server rejects the request with HTTP `403 Forbidden`.

### Requirement: Public Runtime Context Provider, Transport Adapter & `HTMLReportBoard` Helper
The client runtime (`report-runtime.js`) SHALL expose `window.HTMLReportAgent.registerContextProvider(fn)`, `window.HTMLReportAgent.setTransportAdapter(fn)`, and `window.HTMLReportBoard` (with `saveState`, `loadState`, and `file://`-safe `connectStream`) so report authors can attach custom board state to outgoing AI prompts and persist board state without overwriting internal runtime methods.

#### Scenario: Custom board registers a context provider
- **WHEN** a report calls `window.HTMLReportAgent.registerContextProvider(() => ({ selectedItems: ["geodude", "onix"] }))` and submits a prompt from the AI dock
- **THEN** the outgoing request payload to `/api/agent/prompt` includes the custom context merged under `context.customState`.
