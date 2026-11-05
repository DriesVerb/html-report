# Spec Delta: Reactive Agent Data & Multimodal Co-Pilot

## Purpose

Enables real-time, vendor-neutral coupling between live heterogeneous data and media streams (visual images like Pokémon sprites, weather API feeds, and financial charts) and autonomous AI agent commentary over Datastar hypermedia Server-Sent Events (SSE).

## ADDED Requirements

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
