# Proposal: Publication-Grade Live Agent Tracker (`agent-tracker`)

## Why
When autonomous AI coding agents (such as Google Antigravity, Claude Code, and Cursor) execute complex multi-step tasks, developers suffer from a lack of immediate, high-fidelity visibility into what the agent is doing in the moment.

Most tracking utilities try to tackle complex mechanics (background process hooks, distributed daemons, or sprawling logs) while failing to clearly present the **essential core observation**:
- *What is my agent doing right this second?* (Thinking? Running a tool? Waiting for my answer?)
- *How long has it been executing this step?*
- *What is its current intent or reasoning?*
- *What recent actions did it take, and did they succeed or fail?*

By adopting a **"Simple Core Observer First $\rightarrow$ Hard Later"** architectural philosophy, we first build and nail the foundational real-time observation loop. Once the core observer is delivering instant, clear visibility on `localhost:3000`, we progressively layer deeper inspection (terminal drawers and diffs) and advanced swarm telemetry (subagent hierarchies and file-tailing daemons).

## What Changes
1. **Phase 1: Simple Core Observer (The Essentials)**:
   - Real-time **Agent Heartbeat**: Visual status pill (`Thinking` in purple, `Running Tool` in blue, `Waiting on User` in amber, `Idle` in green, `Error` in red) with live stopwatch.
   - **Active Action Card**: Displays current tool name and input target with real-time running duration.
   - **Latest Thought / Intent Bubble**: Displays the agent's current high-level reasoning summary.
   - **Recent Tool Feed**: A compact chronological list of the last 5-10 tool calls with duration badges and exit statuses.
2. **Phase 2: Deep Tool Inspection & Human Attention (The Middle Layer)**:
   - Expandable terminal drawers (`mockup-code`) displaying bash stdout and stderr.
   - File modification previews showing target vs replacement snippets for `edit_file` and `write_file`.
   - Prominent **Human Attention Banner** and optional Web Audio chime when the agent requires user feedback (`ask_question`) or hits an error.
3. **Phase 3: Advanced Swarms & System Telemetry (The Hard Layer)**:
   - Multi-agent swarm hierarchy tracking orchestrator and child subagents (`invoke_subagent`).
   - Zero-dependency background byte-offset file-tailing daemon (`agent-tracker.mjs`).
   - Context window saturation gauges and token velocity analytics.

## Capabilities

### New Capabilities
- `agent-tracker`: Real-time agent activity monitoring, lightweight core observer, interactive tool execution inspector, subagent swarm hierarchy, and context telemetry dashboard.

### Modified Capabilities
- `live-llm-tracking`: Extend baseline LLM tracking to support minimal core heartbeat streams, subagent event routing, and rich code diff payload structures.

## Impact
- **Runtime Scripts**: Enhances `skills/html-report/scripts/serve-report.mjs` and adds lightweight core streamer utilities.
- **Reports & Dev Server**: Live dashboard embedded in companion reports (`index.html`) and workspace dev server (`implementation-progress.html` on `localhost:3000`).
- **Dependencies**: Zero new runtime dependencies; utilizes existing Node standard library, Datastar.js, and DaisyUI light/dark themes.
