# Tasks: Page Edit Queue & Deterministic Prompt Editor

## 1. Core model & prompt

- [x] 1.1 Implement task store (CRUD, priority, order, done, localStorage per `pageKey`) in `report-runtime.js`
- [x] 1.2 Implement pure `buildEditPrompt(tasks, page)` + unit tests for ordering, done-exclusion, byte-stable output
- [x] 1.3 Emit `<meta name="html-report-source">` from `build-report.mjs`

## 2. Dock UI

- [x] 2.1 Add `#edit-dock` markup/styles in `template-shell.html`; Edit section registered into the gear panel
- [x] 2.2 Compose tab, Queue tab (priority chips, reorder, done, delete), prompt preview + copy
- [x] 2.3 ResizeObserver body padding; keyboard shortcuts; `print:hidden`

## 3. Scroll-following

- [x] 3.1 IntersectionObserver current-section chip and default anchor
- [x] 3.2 Highlight anchored tasks in view; click-to-scroll with flash outline

## 4. Agent hand-off

- [x] 4.1 Add `POST /__agent_edit__` to `serve-report.mjs` (localhost only, scoped to served file, status stream)
- [x] 4.2 Wire three send states incl. turnkey reconnect with edit prompt
- [x] 4.3 Document endpoint in `references/two-way-agent-bridge.md`

## 5. Verification

- [x] 5.1 BDD/Playwright tests: add, prioritize, persist, generate, offline state
- [x] 5.2 Rebuild examples, run full suite, sync `index.html` + `implementation-progress.html`

## 6. Edit Dock & Queue UX Enhancements

- [x] 6.1 Task & toolbar visibility in darkmode (#edit-dock contrast, top border accent, upward shadow, task card styling)
- [x] 6.2 Priority and anchor badge text visibility in narrow/small mode
- [x] 6.3 Auto-priority toggle in Queue tab adding agent prompt instruction
- [x] 6.4 Reset generated prompt when new tasks enter or queue changes
- [x] 6.5 Disable copy prompt button when prompt is stale/not generated, with tooltip

