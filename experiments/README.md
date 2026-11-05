# Experiments & Proof-of-Concept Vault

This directory houses standalone experiments, exploratory test spikes, and historical research prototypes before features graduate to core skill capabilities.

## Active Experiments

### 1. Two-Way AI Agent Bridge Spike (PokéLive Pokédex)
- **Files**:
  - `pokemon-fragment.html`: DaisyUI Pokédex content fragment featuring live PokéAPI polling, custom sprites, stats, and live roast commentary triggers.
  - `pokemon-live-report.html`: Assembled standalone report with live Datastar and Alpine reactivity.
  - `fastify-agent-bridge.mjs`: Fastify-based prototype server bridging browser fetch requests with the local `agy` CLI session.
- **Outcome**: Successfully proved zero-API-key local Antigravity AI inference directly from the browser report. This logic has now officially graduated into the core skill via `skills/html-report/scripts/serve-report.mjs` (`/__agent_action__`) and `skills/html-report/assets/report-runtime.js` (`HTMLReportAgent`).
