# Tasks

## 1. Queue-to-Compose Task Re-Editing

- [x] 1.1 Update [skills/html-report/assets/template-shell.html](../../../skills/html-report/assets/template-shell.html) inside `#edit-pane-compose` to add a `#edit-cancel-edit-btn` (`Cancel`, initially `hidden`) beside `#edit-add-btn` (`Add` / `Save`) and ensure `#edit-dock-body` tab bar uses a `flex items-center justify-between gap-2` layout.
- [x] 1.2 Implement task re-editing in [skills/html-report/assets/report-runtime.js](../../../skills/html-report/assets/report-runtime.js) (`HTMLReportEdit`): add `_editingTaskId`, `editTaskInCompose(id)`, `cancelEdit()`, update `addFromForm()` to call `updateTask()` when `_editingTaskId` is active (preserving `id`, `order`, `done`, `anchor`, resetting `_generatedPrompt`, and switching back to `queue`), reset edit mode on `+ Task` / `Cancel` / `removeTask()`, and add an explicit `✎` Edit button + row-click-to-edit + clickable section-anchor jump badge in `renderQueue()`.

## 2. Styling Button & Live OKLCH Style Editor

- [x] 2.1 Add `#edit-tab-styling` (`Styling` button) and `#edit-dock-reset-btn` (`Reset` button) together on the opposite (right) side of the `Compose` / `Queue` tablist and add `#edit-pane-styling` inside `#edit-dock-body` in [skills/html-report/assets/template-shell.html](../../../skills/html-report/assets/template-shell.html) with Document Default selector + `"Set as Default"` button, and the compact OKLCH Style Editor controls (theme name, `extends` base theme, color pickers + hex inputs for `primary`, `secondary`, `accent`, `neutral`, `base-100`, geometry tokens, and `Save` / `Copy CSS` actions).
- [x] 2.2 Wire `Styling` tab switching, `resetAll()` (confirmation-guarded full reset of tasks, Compose draft/edit session, target selection, auto-priority, custom themes, and default theme back to `light`), and live Style Editor state in [skills/html-report/assets/report-runtime.js](../../../skills/html-report/assets/report-runtime.js) using existing `compileTheme()`, `registerCustomTheme()`, `setReportTheme()`, and `tailwindConfigSnippet()` (updating DOM, Chart.js, and Mermaid live without page reload, and persisting custom themes in `html_report_custom_themes`).

## 3. Document Default Persistence & Verification

- [x] 3.1 Implement `POST /__agent_style__` in [skills/html-report/scripts/serve-report.mjs](../../../skills/html-report/scripts/serve-report.mjs) with `enforceLocalBridgeSecurity` + `resolveEditTarget()` to persist `theme` and `customTheme` to `report.manifest.json` + `rebuildProjectFromFragment()` (and standalone workspace `.html` files when no manifest exists), plus client-side server sync and static/offline fallback in [skills/html-report/assets/report-runtime.js](../../../skills/html-report/assets/report-runtime.js).
- [x] 3.2 Add unit, DOM, and HTTP integration tests in [tests/settings-authoring.test.mjs](../../../tests/settings-authoring.test.mjs) covering Queue-to-Compose re-editing (`editTaskInCompose`, `Save`, `Cancel`, delete-while-editing), opposite-side `Styling` + `Reset` button layout, `resetAll()` full state reset, live OKLCH Style Editor compilation, and `POST /__agent_style__` persistence; run `node --test tests/settings-authoring.test.mjs` and `node skills/html-report/scripts/harness.mjs --fast`.

## Workflow follow-up

- Update [openspec/changes/edit-mode-queue-edit-and-styling/index.html](index.html) and [implementation-progress.html](../../../implementation-progress.html) as tasks complete on `http://localhost:3031`.
- Archive the change with `/openspec-archive-change` once implementation and verification are complete.
