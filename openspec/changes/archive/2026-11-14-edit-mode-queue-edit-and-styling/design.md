# Design: Edit Mode Queue Task Re-Editing & Document Style Editor

## Context

See [proposal.md](proposal.md) for motivation and [specs/page-edit-queue/spec.md](specs/page-edit-queue/spec.md) for behavioral requirements.

Edit Mode (`#edit-dock`) currently spans:
- **Dock Markup ([template-shell.html](../../../skills/html-report/assets/template-shell.html)):** `#edit-dock` wrapped in `<!-- html-report:authoring:start edit-dock --> ... <!-- html-report:authoring:end edit-dock -->` (automatically pruned on `--published`).
- **Browser Runtime ([report-runtime.js](../../../skills/html-report/assets/report-runtime.js)):** `HTMLReportEdit` manages `localStorage`-backed tasks (`addTask`, `updateTask`, `removeTask`, `moveTask`), `renderQueue()`, `initDock()`, and prompt synthesis (`buildEditPrompt()`). Additionally, `report-runtime.js` already bundles the zero-dependency OKLCH compiler (`compileTheme()`, `rgbToOklch()`, `registerCustomTheme()`, `scanAndRegisterExistingCustomThemes()`, `tailwindConfigSnippet()`, and `setReportTheme()` which dynamically re-colors Chart.js and Mermaid).
- **Local Dev Server ([serve-report.mjs](../../../skills/html-report/scripts/serve-report.mjs)):** `POST /__agent_edit__` already uses `enforceLocalBridgeSecurity()` and `resolveEditTarget()` to resolve project `report.manifest.json` + `fragment.html` + `index.html` safely within `workspaceRoot`, and `rebuildProjectFromFragment()` rebuilds `index.html` using `manifest.theme` and `manifest.customTheme`.

## Goals / Non-Goals

**Goals:**
- Let users re-open any queued task from `#edit-queue-list` into the `Compose` pane, edit all fields (`title`, `content`, `priority`, `target`), and save in place or cancel cleanly.
- Preserve section-anchor scrolling via a dedicated clickable anchor badge/button on anchored queue rows so re-editing and anchor jumping never conflict.
- Add a `Styling` button on the right side of the `Compose | Queue` header row inside `#edit-dock-body`.
- Allow selecting any standard or custom theme as the **Document Default** (persisted via `POST /__agent_style__` when served by `serve-report.mjs`, with clean `localStorage` + CSS/HTML download fallback when static).
- Provide a compact, live **OKLCH Style Editor** inside `#edit-pane-styling` reusing `report-runtime.js`'s existing `compileTheme` / `registerCustomTheme` / `setReportTheme` engine (no duplicated OKLCH math).

**Non-Goals:**
- Changing the `--published` pruning contract (`#edit-dock` remains authoring-only and pruned in Published Documents).
- Adding external CSS/color picker libraries or breaking offline/single-file portability.
- Allowing `POST /__agent_style__` to modify files outside `workspaceRoot` or non-report files.

## Decisions

### 1. Queue Row Interaction: Edit vs. Section Anchor Jump
- **Choice:** In `renderQueue()`, each `<li>` displays: `[checkbox] [P1/P2/P3] [#target?] [anchor-chip?] [title] [✎ Edit] [↑] [↓] [🗑]`. Clicking the `✎` Edit button—or clicking the task row/title itself—calls `editTaskInCompose(t.id)`. Clicking the dedicated `anchor-chip` button calls `scrollToAnchor(t)` (with `e.stopPropagation()`).
- **Alternative Considered:** Keeping `li` click strictly for `scrollToAnchor(t)` and only triggering edit via `✎`.
- **Rationale:** The user specifically asked *"When I click it I want to see the task in 'compose again'"*. Making both the task row/title and the explicit `✎` button load Compose satisfies that expectation directly, while promoting the section anchor to a crisp clickable badge (`§ <anchor.label>`) preserves one-click anchor jumping from `page-edit-queue`.

### 2. Compose Edit State (`_editingTaskId`)
- **Choice:** Store `HTMLReportEdit._editingTaskId` (string or `null`).
  - `editTaskInCompose(id)` finds the task in `getTasks()`, sets `_editingTaskId = id`, switches tab to `"compose"`, expands dock, populates `#edit-task-title`, `#edit-task-content` (triggering auto-height resize), `#edit-task-priority`, calls `setSelectedTarget(t.target || null)`, displays the task's preserved anchor in `#edit-task-anchor`, changes `#edit-add-btn` text to `"Save"`, reveals `#edit-cancel-edit-btn`, and focuses `#edit-task-title`.
  - Submitting (`addFromForm`) checks `_editingTaskId`: if set, calls `updateTask(_editingTaskId, { title, content, priority, target })`, clears `_editingTaskId`, resets form & buttons back to `"Add"`, and switches to `"queue"`.
  - Clicking `#edit-cancel-edit-btn`, clicking `#edit-dock-add` (`+ Task`), or deleting `_editingTaskId` via `removeTask()` calls `cancelEdit()` to restore clean `"Add"` mode.
- **Rationale:** Explicit state (`_editingTaskId`) prevents accidental duplicate task creation when pressing `Ctrl/Cmd+Enter` or clicking Save, and ensures `updateTask()` continues to invalidate `_generatedPrompt`.

### 3. Dock Tab Bar Layout: `Compose | Queue` + Opposite `Styling` & `Reset` Buttons
- **Choice:** Wrap the `#edit-dock-body` header controls in a `flex items-center justify-between gap-2` row:
  ```
  [ Compose | Queue ]                    [ 🎨 Styling ] [ ↺ Reset ]
  ```
  `#edit-tab-styling` uses the same `setTab("styling")` controller, toggling `#edit-pane-styling` while deselecting `Compose` and `Queue` tabs (or toggling back to the previous tab if clicked again). Immediately next to it on the right is `#edit-dock-reset-btn` (`Reset`), which invokes `resetAll()` (guarded by confirmation so accidental clicks don't wipe queued work).
- **Reset Everything Scope (`resetAll()`):**
  1. Clears page task queue (`saveTasks([])`), auto-priority (`setAutoPriority(false)`), generated prompt (`resetGeneratedPrompt()`), active edit session (`cancelEdit()`), selected `Target Element` (`setSelectedTarget(null)`), and exits selection mode (`toggleSelectMode(false)`).
  2. Clears browser `localStorage` theme keys (`html_report_active_theme`, `html_report_custom_themes`), resets Style Editor controls to baseline defaults, removes runtime custom `<style id="daisyui-custom-themes">` overrides (or reverts to `light`), calls `setReportTheme("light")`, and if server-connected calls `POST /__agent_style__` with `{ theme: "light", customTheme: null }` so the document default also resets cleanly.
- **Alternative Considered:** Opening a full-screen modal for styling, or making Reset only clear the Style Editor form.
- **Rationale:** Keeping `#edit-pane-styling` inside the bottom-docked panel (`max-h-[min(38vh,320px)] overflow-y-auto`) keeps the report canvas unobstructed above the dock so users see typography, surface, Chart.js, and Mermaid color updates in real time; having `Reset` next to `Styling` reset both queued tasks/compose state and styling overrides gives authors a single reliable "start fresh" button.

### 4. Document Default Theme & Style Editor Architecture
- **Choice:** Reuse `report-runtime.js`'s existing `DAISYUI_THEMES`, `compileTheme()`, `registerCustomTheme()`, `tailwindConfigSnippet()`, and `setReportTheme()`:
  - **Document Default Bar:** Reads initial default from `#agent-manifest` (`manifest.theme`) or initial `<html data-theme>` snapshot (`_documentDefaultTheme`), renders a theme selector (`#edit-style-theme-select`) synced with active preview, a badge indicating `Default: <name>`, and a **"Set as Default"** button (`#edit-style-set-default-btn`).
  - **Collapsible/Compact Style Editor Grid:** Theme name (`#edit-style-name`, default `"custom"`), base inheritance selector (`#edit-style-extends`, e.g., `light`, `dark`, `corporate`, `none`), 5 paired `<input type="color">` + hex `<input type="text">` controls (`primary`, `secondary`, `accent`, `neutral`, `base-100`), plus geometry selectors (`--rounded-box`, `--rounded-btn`).
  - **Live Preview & Actions:** Any input change compiles via `compileTheme({ [name]: { extends, ...colors, ...geometry } })`, registers via `registerCustomTheme(name, css)`, and calls `setReportTheme(name)` so DOM + Chart.js + Mermaid update immediately. Action buttons: **Save Custom Theme** (persists to `html_report_custom_themes`), **Set as Document Default** (persists to server or local fallback), **Copy CSS** (copies `[data-theme="..."] { ... }`), and **Reset**.

### 5. Server Persistence Endpoint (`POST /__agent_style__`)
- **Choice:** Add `POST /__agent_style__` in [serve-report.mjs](../../../skills/html-report/scripts/serve-report.mjs) guarded by `enforceLocalBridgeSecurity(req, res, { requireCsrf: true })` and `resolveEditTarget(payload.file, resolvedPath, rootDir)`:
  - Payload: `{ file, theme, customTheme? }` where `customTheme` is either `null` or `{ name, definition / css }`.
  - **Project report (`report.manifest.json` + `fragment.html`):** Update `manifest.theme` and `manifest.customTheme` (storing the compiled CSS or structured theme object accepted by `buildReport()`), write `report.manifest.json` atomically, and call `rebuildProjectFromFragment(target.targetDir)` so `index.html` (`<html data-theme="...">`, `<style id="daisyui-custom-themes">`, `#agent-manifest`) rebuilds in `<100ms` and live-reloads connected clients.
  - **Standalone `.html` report (no manifest):** Safely update `data-theme="..."` on `<html>`, `#active-theme-label` / `#modal-active-theme-label`, `#agent-manifest` JSON `theme` if present, and inject/update `<style id="daisyui-custom-themes">` in `<head>`, then write atomically.
  - **Offline / Static Fallback:** When `fetch("/__agent_style__")` fails or the page is opened via `file://`, `HTMLReportEdit` saves to `localStorage`, updates the active DOM, and shows an inline status message offering `Copy CSS` or `Download HTML` (via `HTMLReportPublisher` if available).

## Risks / Trade-offs

- **[Risk] `max-h-[min(38vh,320px)]` dock height feels cramped for 5 color pickers + geometry + theme picker** → **Mitigation:** Use a dense responsive 2–3 column Tailwind grid inside `overflow-y-auto` with compact `input-xs`/`w-6 h-6` swatches, and group Geometry/CSS export under a compact `<details>` toggle so the default view fits cleanly within 320px.
- **[Risk] Custom theme CSS injected by user contains malformed characters or breaks `<style>` tag** → **Mitigation:** Validate/sanitize theme names to `[a-z0-9_-]+`, compile strictly through `compileTheme()` (validating color strings & escaping `</style`), and reject unsafe payloads with HTTP 400 on `/__agent_style__`.
- **[Risk] `tests/settings-authoring.test.mjs` checks specific IDs and ordering in `template-shell.html`** → **Mitigation:** Preserve all existing IDs (`#edit-dock-select` before `#edit-dock-add`, `#edit-tab-compose`, `#edit-tab-queue`, `#edit-add-btn`, etc.) and place `#edit-tab-styling` and `#edit-pane-styling` cleanly inside the `edit-dock` authoring block.
