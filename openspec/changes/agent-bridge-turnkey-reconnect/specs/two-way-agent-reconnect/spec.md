# Spec Delta: Turnkey AI Agent Reconnection Prompt & Auto-Recovery

## Purpose
Enables shared HTML reports featuring interactive Two-Way Agent Co-Pilots to detect broken or offline local bridge connections, generate turnkey, copy-paste AI agent instruction prompts, and automatically recover live status when the local dev server is activated.

## ADDED Requirements

### Requirement: Offline Bridge Detection and Disconnection State
The system MUST monitor the availability of the local Two-Way Agent Bridge (`/__agent_status__` / `/api/agent/status`) and reflect the active connection state (`connected`, `disconnected`, or `connecting`).

#### Scenario: Opening a shared report without a running dev server
- **GIVEN** a recipient opens a shared HTML report via `file://` or an unproxied static host
- **WHEN** `HTMLReportAgent` attempts to query the agent bridge status
- **THEN** the client marks the bridge state as `disconnected` without crashing or blocking report reading
- **AND** reveals an interactive disconnection affordance with reconnection options.

#### Scenario: Runtime failure of an active agent action
- **GIVEN** a previously connected or ambiguous report
- **WHEN** a user triggers an agent query or Datastar co-pilot post that encounters a network or HTTP error
- **THEN** the system triggers the reconnection affordance and displays the failure reason.

### Requirement: Turnkey AI Agent Reconnection Prompt Synthesis
The system MUST dynamically generate a clean, copy-ready AI instruction prompt tailored for any autonomous AI agent (Google Antigravity, Claude Code, Cursor, Codex, Gemini CLI).

#### Scenario: Formatting the turnkey reconnection prompt
- **WHEN** a user or client requests the reconnection prompt via `HTMLReportAgent.getReconnectPrompt()` or clicks "Copy Reconnect Prompt"
- **THEN** the returned prompt MUST specify the current document filename, port target (`3000`), the exact shell command to launch (`node skills/html-report/scripts/serve-report.mjs <filename> --port 3000`), and background execution instructions.

### Requirement: Clipboard Copy Affordance & User Feedback
The report UI MUST provide a prominent, accessible copy button allowing the user to copy the synthesized prompt with immediate visual confirmation.

#### Scenario: Copying the prompt to system clipboard
- **WHEN** a user clicks the "Copy Agent Prompt" button
- **THEN** the text is written to `navigator.clipboard`
- **AND** the button displays a transient confirmation badge (e.g. "Copied to Clipboard!") and checkmark icon.

### Requirement: Live Heartbeat Auto-Recovery & Zero-Reload Reconnection
The system MUST provide both automated polling and on-demand re-checking to seamlessly transition the report from `disconnected` to `connected` when the dev server starts.

#### Scenario: Background auto-recovery after agent starts dev server
- **GIVEN** a recipient has pasted the reconnection prompt into their agent and the agent has launched `serve-report.mjs`
- **WHEN** the periodic heartbeat probe or the user clicking "Check Connection Now" receives HTTP 200 from `/__agent_status__`
- **THEN** the bridge status updates to `connected` with a pulsing status badge
- **AND** the reconnection modal/banner automatically dismisses or collapses without requiring a page reload.
