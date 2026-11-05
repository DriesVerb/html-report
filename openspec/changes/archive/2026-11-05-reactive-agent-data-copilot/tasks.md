# Tasks: Reactive Agent Data & Multimodal Co-Pilot

## 1. Schema & Trigger Engine

- [x] 1.1 Implement `TelemetryReactorSchema` in `skills/html-report/scripts/datastar-sse.mjs` supporting `time-series`, `environmental-api`, and `visual-image` modalities
- [x] 1.2 Implement sliding window anomaly and threshold filter (`AnomalyTriggerEngine`) to suppress sub-threshold noise
- [x] 1.3 Add unit tests in `test/` verifying event normalization and threshold activation logic

## 2. Multimodal Agent Reactor Bridge & Adapters

- [x] 2.1 Implement `AgentReactorBridge` with generic `react()` streaming interface in `skills/html-report/scripts/datastar-sse.mjs`
- [x] 2.2 Add streaming adapters for AGY/Gemini, OpenAI GPT-4o, and generic OpenAI-compatible streaming endpoints (Ollama/vLLM)
- [x] 2.3 Verify visual image payload forwarding (URL and base64) to multimodal adapters without buffer overflow

## 3. UI Component & Multimodal Showcase

- [x] 3.1 Design DaisyUI tabbed component featuring Financial Tickers, Pokémon Visual Identification, and Weather API streams
- [x] 3.2 Add Lucide sentiment icons, creature stat badges, and environmental advisory markers
- [x] 3.3 Verify interactive demo in `index.html` on `http://localhost:3000` with live simulated ticker ticks, weather transitions, and creature reactions

## 4. Universal Two-Way Agent Bridge Graduation & Reorganization

- [x] 4.1 Migrate experimental Pokémon test spike into `experiments/` with dedicated README
- [x] 4.2 Archive historical feature HTML files to `dev/` with automatic dev server fallback routing
- [x] 4.3 Implement Universal Two-Way Agent Bridge in `serve-report.mjs` (`/__agent_action__`, `/__agent_status__`, `/api/agent`) supporting Datastar SSE morphing and zero-API-key `agy` CLI execution
- [x] 4.4 Expose global client runtime helper `window.HTMLReportAgent` in `report-runtime.js` with graceful offline fallback
- [x] 4.5 Document two-way co-pilot architecture in `skills/html-report/references/two-way-agent-bridge.md` and `SKILL.md`
- [x] 4.6 Implement Persona Blueprint specification, `PersonaRegistry` in `serve-report.mjs`, and dynamic registration endpoints
- [x] 4.7 Document Persona Blueprint guide in `skills/html-report/references/persona-blueprint.md`
- [x] 4.8 Verify suite with unit and integration tests in `tests/agent-bridge.test.mjs`
