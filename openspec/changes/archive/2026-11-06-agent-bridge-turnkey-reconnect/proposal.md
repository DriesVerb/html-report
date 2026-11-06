# Proposal: Turnkey AI Agent Reconnection Prompt & Auto-Recovery for Shared Two-Way Reports

## Why

Reports generated with `html-report` frequently feature live **Two-Way Agent Co-Pilots** and **Datastar SSE hypermedia streaming**. When an author shares an interactive report file (`.html`) with a colleague, opens it on a separate workstation, or inspects it without an active development server running on `localhost:3000`, the two-way bridge connection is broken.

Currently, recipients encounter silent fallback heuristics or generic connection timeouts with no actionable guidance on how to restore live agent inference. Because modern software engineers and operators frequently have their own local AI agents running (e.g. Google Antigravity, Claude Code, Cursor, Codex, Gemini CLI), the report should empower them to restore live two-way connectivity in seconds by generating a **copy-paste turnkey agent instruction prompt**.

## What Changes

- **Automatic Disconnected Bridge Detection**:
  - The client runtime (`report-runtime.js`) actively probes `/__agent_status__` on load and listens for bridge request failures.
  - When disconnected, a prominent yet elegant DaisyUI indicator card or modal appears: `"Two-Way AI Agent Bridge Offline"`.
- **Turnkey Multi-Agent Reconnection Prompt**:
  - Generates an instant, context-aware prompt customized with the exact report filename, active personas, and shell commands (`node skills/html-report/scripts/serve-report.mjs <file> --port 3000`).
  - Includes a one-click `"Copy Turnkey Agent Prompt"` button with visual feedback.
  - The prompt is engineered to be pasted directly into *any* autonomous AI agent (Antigravity, Claude Code, Codex, Cursor), commanding the agent to start the local bridge in the background.
- **Heartbeat Auto-Recovery & Live Reconnection**:
  - Background polling probes `/__agent_status__` with exponential backoff (2s &rarr; 5s &rarr; 10s).
  - Manual `"Check Connection Now"` button.
  - When the bridge comes online, the UI seamlessly transitions to `LIVE CONNECTED` with an OKLCH pulsing indicator, without requiring a page reload.
- **Configurable Fallback & Modal Integration**:
  - Reports can embed connection badges in the navbar or inline co-pilot cards.

## Capabilities

### New Capabilities
- `two-way-agent-reconnect`: Standardizes detection of broken two-way agent bridge connections in shared reports, automated synthesis of turnkey agent reconnection prompts, and seamless live re-hydration upon bridge recovery.

### Modified Capabilities
- *(None)*

## Impact
- **Client Runtime**: Enhances `skills/html-report/assets/report-runtime.js` (`HTMLReportAgent`) with reconnection prompt synthesis, status polling, and clipboard utilities.
- **Template Shell**: Injects the turnkey reconnection modal / banner container into `skills/html-report/assets/template-shell.html`.
- **References & Skill**: Documents the reconnection prompt protocol in `skills/html-report/references/two-way-agent-bridge.md` and `SKILL.md`.
- **OpenSpec Compliance**: Companion [index.html](file:///home/eta/projects/html-report/openspec/changes/agent-bridge-turnkey-reconnect/index.html) and live dev server on `http://localhost:3000`.
