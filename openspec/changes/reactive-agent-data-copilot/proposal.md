# Proposal: Reactive Agent Data & Multimodal Co-Pilot

## Why
Static and telemetry dashboards present charts, images, and public API data (e.g. stock tickers, weather feeds, sensor grids, camera snapshots, or game assets) but force human users to manually interpret what they see and deduce the implications. While `html-report` already supports live Datastar SSE telemetry and declarative public feeds (`data-public-feed`), it lacks a unified, multimodal **reactive co-pilot pattern** where arbitrary report elements (whether a changing financial graph, a live weather API feed, or a picture of a Pokémon) trigger real-time, context-aware agent commentary and guidance.

## What Changes
- **Universal Multimodal Telemetry Contract (`TelemetryReactorSchema`)**: Generalizes event payloads beyond numerical time-series to support **Visual/Image Modalities** (image URLs, base64 data, canvas snapshots, e.g. Pokémon sprites/photos), **Environmental & Public API Modalities** (e.g. weather feeds, temperature spikes, pressure drops), and **Numerical Streams** (e.g. financial tickers, server CPU/memory).
- **Modality-Specific Trigger & Anomaly Policies**:
  - *Time-series:* Volatility spikes and standard deviation thresholds (e.g. >2σ).
  - *Weather/Environmental:* Rapid delta triggers (e.g. temperature drop >5°C in 30 min, severe weather alert flags).
  - *Visual/Multimodal:* Selection, upload, or image frame changes triggering vision-capable model evaluations.
- **Vendor-Neutral Multimodal Agent Reactor Interface (`AgentReactorInterface`)**: Provides clean streaming adapters for multimodal engines (Google Gemini / AGY, OpenAI GPT-4o, Anthropic Claude 3.5 Sonnet, and local multimodal models like Ollama LLaVA).
- **Interactive Multimodal Showcase Component**: A publication-grade DaisyUI component offering interactive tabs across **Financial Tickers**, **Pokémon Visual Identification**, and **Weather API Feeds**, each dynamically paired with a live streaming Datastar reaction panel.
- **Hypermedia Morphing via Datastar SSE**: Live agent reactions, sentiment badges, tactical cards, and warnings are streamed and morphed directly into the DOM via `/__datastar_stream__`.

## Capabilities

### New Capabilities
- `reactive-data-copilot`: Standardizes the reactive coupling between live heterogeneous data/media feeds (visual images, weather APIs, financial tickers) and autonomous, vendor-neutral agent feedback loops rendered via Datastar SSE hypermedia fragments.

### Modified Capabilities
- `live-dashboards`: Extends `DatastarBridge` and `SessionState` to support multimodal event triggers, agent commentary channels, and side-by-side telemetry-reactor components.

## Impact
- **Runtime & Scripts**: Enhances `skills/html-report/scripts/datastar-sse.mjs` with multimodal payload schemas and vision adapter abstractions.
- **Builder**: `skills/html-report/scripts/build-report.mjs` automatically detects `<div data-reactive-copilot>` components and ensures both Chart.js and Datastar addons are enabled.
- **Backlinks & Journey**: Supported by companion [index.html](file:///home/eta/projects/html-report/openspec/changes/reactive-agent-data-copilot/index.html) and live dev server on `http://localhost:3000`.
