# Tasks: Publication-Grade Live Agent Tracker (`agent-tracker`)

## 1. Simple Core Observer & Agent-Agnostic Facade (Phase 1 Target)

- [x] 1.1 Implement `AgentTrackerFacade` and `AgentTelemetryStrategy` interface supporting Antigravity, Claude Code, and Codex
- [x] 1.2 Build Active Action & Latest Thought component displaying current tool execution and active reasoning intent
- [x] 1.3 Build Chronological Recent Activity Feed showing the last 5-10 tool calls with duration badges and exit statuses
- [x] 1.4 Wire minimal live streaming event payload to dev server `/__datastar_stream__` and verify real-time browser reactivity
- [x] 1.5 Automated test suite & multi-model verification in `tests/agent-tracker.test.mjs` and `current-feature.html`

## 2. Tool Inspection & Human Attention (The Middle Layer)

- [x] 2.1 Add expandable command output drawer (`mockup-code`) for executed terminal commands (stdout/stderr)
- [x] 2.2 Add code modification preview showing target vs replacement snippets for `edit_file` and `write_file`
- [x] 2.3 Implement prominent Human Attention banner and audio alert when agent enters `Waiting on User` or `Error` state
- [x] 2.4 Create automated integration tests in `tests/agent-tracker.test.mjs` verifying core observer and strategy normalization

## 3. Advanced Swarms, Daemon & System Telemetry (Hard Layer)

- [x] 3.1 Implement multi-agent swarm hierarchy tracking orchestrator and child subagents (`invoke_subagent`) in swimlanes
- [x] 3.2 Build background byte-offset JSONL transcript tailing daemon (`agent-tracker.mjs`) for external process watching
- [x] 3.3 Add context window saturation gauges and token velocity telemetry (tokens/sec and buffer limits)
- [x] 3.4 Multi-breakpoint mobile and desktop verification across DaisyUI 32 themes
