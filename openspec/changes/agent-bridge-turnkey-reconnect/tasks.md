# Tasks: Turnkey AI Agent Reconnection Prompt & Auto-Recovery

## 1. Client Runtime & Reconnection Engine

- [x] 1.1 Implement `HTMLReportAgent.getReconnectPrompt(options)` in `skills/html-report/assets/report-runtime.js`
- [x] 1.2 Implement connection state tracking (`_connectionState`), state change listeners, and `checkConnection()`
- [x] 1.3 Implement background heartbeat auto-recovery with exponential backoff
- [x] 1.4 Implement `HTMLReportAgent.copyReconnectPrompt(btnEl)` with clipboard API and visual confirmation

## 2. Shell UI & Component Integration

- [x] 2.1 Add connection status indicator badge (`#agent-bridge-status-badge`) in `skills/html-report/assets/template-shell.html` navbar
- [x] 2.2 Add turnkey agent reconnection modal (`#agent-reconnect-modal`) with prompt display, copy button, and retry action
- [x] 2.3 Wire co-pilot failure hooks to open the reconnection modal on broken bridge attempts

## 3. Verification & OpenSpec Journey

- [x] 3.1 Build companion `index.html` report and sync with `implementation-progress.html` on `http://localhost:3000`
- [x] 3.2 Add automated unit and BDD tests in `tests/agent-reconnect.test.mjs` verifying prompt synthesis and state transitions
- [x] 3.3 Run full test suite and push to main
