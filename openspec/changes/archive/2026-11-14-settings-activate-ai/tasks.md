# Tasks: Activate AI from Settings + Turnkey per Board

## 1. Capability & state

- [x] 1.1 Implement `HTMLReportAgent.isAiCapable()` + `setAiActive()` with localStorage per `pageKey`; start/stop check and heartbeat on toggle
- [x] 1.2 Add `--ai` flag emitting `html-report-ai` meta in `build-report.mjs`

## 2. Settings UI

- [x] 2.1 Register AI section in gear panel: toggle, status line, turnkey card, copy, retry
- [x] 2.2 Extend `getReconnectPrompt` with per-board source path

## 3. Integration

- [x] 3.1 Editor send-state resolution uses `isAiCapable()`
- [x] 3.2 Optional: `GET /__boards__` + per-board turnkey list in `serve-report.mjs`

## 4. Verification

- [x] 4.1 Tests: capability resolution matrix, toggle persistence, turnkey prompt contents, `file://` disconnected state
- [x] 4.2 Docs update, full suite, sync `index.html` + `implementation-progress.html`
