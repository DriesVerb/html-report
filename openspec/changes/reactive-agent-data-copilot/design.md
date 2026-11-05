# Design: Reactive Agent Data & Multimodal Co-Pilot

## Context
See [proposal.md](file:///home/eta/projects/html-report/openspec/changes/reactive-agent-data-copilot/proposal.md) for motivation and requirements. While initial exploration focused on time-series stock graphs, the architectural pattern applies universally to **any data or media modality** rendered on an HTML report:
1. **Numerical / Financial Time-Series:** Chart.js stock tickers, CPU loads, latency curves.
2. **Environmental & Public APIs:** Weather feeds (Open-Meteo, storm alerts, air quality).
3. **Visual / Multimodal Imagery:** Pictures (e.g. Pokémon sprites, camera feeds, diagnostics, diagrams).

## Goals / Non-Goals

**Goals:**
- Provide a standardized, vendor-neutral `TelemetryReactorSchema` supporting structured metrics, REST JSON payloads, and visual image inputs.
- Support multimodal agent inference (vision + text) across Google AGY/Gemini, OpenAI GPT-4o, Anthropic Claude, and local vision LLMs (LLaVA/Ollama).
- Implement intelligent rate-limiting and noise filtering tailored to each modality (suppressing sub-threshold ticker jitter, debouncing continuous image hover).
- Deliver an interactive, tabbed showcase featuring Financial Ticker, Pokémon Visual Identification, and Weather API streams.

**Non-Goals:**
- Heavy client-side CV/ML processing inside the browser bundle; visual inference is delegated to the multimodal agent backend.
- Proprietary vendor-locked APIs; all data exchanges adhere to standard JSON payloads and Datastar SSE fragments.

## Decisions

### Decision 1: Discriminated Union Event Contract (`TelemetryReactorSchema`)
- **Choice:** Define event payloads with a `modality` discriminator:
  - `modality: "time-series"`: `{ metric, value, deltaPct, windowStats }`
  - `modality: "environmental-api"`: `{ endpoint, current, forecast, alerts }`
  - `modality: "visual-image"`: `{ imageUrl, imageBase64, mimeType, caption, metadata }`
- **Rationale:** Allows a single unified bus to route heterogeneous inputs to appropriate prompt constructors or vision pipelines.

### Decision 2: Multimodal Agent Adapter Contract (`MultimodalReactor`)
- **Choice:** Standardize an abstract reactor method:
  ```typescript
  interface MultimodalAgentReactor {
    react(event: TelemetryReactorEvent): AsyncIterable<string>;
  }
  ```
  For visual events, the adapter constructs multimodal user messages (e.g. Gemini `inlineData` or OpenAI `image_url`).
- **Rationale:** Keeps downstream UI code 100% agnostic to whether the model is inspecting a graph, reading temperature numbers, or looking at a Pokémon sprite.

### Decision 3: Datastar Hypermedia Morphing (`/__datastar_stream__`)
- **Choice:** Regardless of modality, agent reactions stream as Datastar SSE fragments morphing the co-pilot panel (`#agent-reaction-bubble`, `#sentiment-badge`, `#tactical-advisory`).
- **Rationale:** Zero client-side framework lock-in, ultra-fast streaming tokens, and automatic DaisyUI theme adaptation.

## Risks / Trade-offs

- **[Risk] Image payload bandwidth in SSE/events** &rarr; *Mitigation:* Prefer URL references or thumbnail scaling (e.g. max 512x512) for inline base64 transfers.
- **[Risk] Hallucination in specialized domains (e.g. Pokemon type matchups or storm paths)** &rarr; *Mitigation:* Ground prompts with known metadata (e.g., passing Pokémon base stats or weather alert codes alongside the raw media).
- **[Risk] Token cost on repeated visual queries** &rarr; *Mitigation:* Client-side deduplication and response caching for identical image/entity keys.
