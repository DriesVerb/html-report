# Tasks: Edit Mode Element Selection

## 1. Edit Dock UI & Template Integration

- [x] 1.1 Add `[⌖ Select]` toggle button next to `+ Task` in `skills/html-report/assets/template-shell.html` and verify element presence in shell
- [x] 1.2 Add `#edit-selected-target` dismissible badge container in `#edit-pane-compose` of `skills/html-report/assets/template-shell.html` and verify initial hidden state

## 2. Selection Mode Runtime & Invert Hover

- [x] 2.1 Implement `HTMLReportEdit.toggleSelectMode(enable)` with cursor styling, safe boundaries, and escape key handling in `skills/html-report/assets/report-runtime.js`
- [x] 2.2 Implement zero-reflow `.report-select-hover` GPU inversion filter and pointer tracking in `skills/html-report/assets/report-runtime.js`
- [x] 2.3 Implement just-in-time semantic ID generation and click event interception (`e.preventDefault()`, `e.stopPropagation()`) in `skills/html-report/assets/report-runtime.js`

## 3. Compose Target Badge & Task Data Integration

- [x] 3.1 Wire element selection to open compose pane and render target badge with clear button without autofilling inputs in `skills/html-report/assets/report-runtime.js`
- [x] 3.2 Update `HTMLReportEdit.addTask()` and task data schema to persist `target: { id, tag }` in localStorage
- [x] 3.3 Update `HTMLReportEdit.buildEditPrompt()` to format target element selector and tag in generated prompt output

## 4. Automated Testing & Verification

- [x] 4.1 Add automated unit / BDD tests for selection mode, semantic ID generation, task target persistence, and prompt formatting in `tests/`
- [x] 4.2 Run test suite via `npm test` and verify all tests pass
