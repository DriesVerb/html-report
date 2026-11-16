# Proposal: Speed Up Edit Mode (Workspace-Aware Prompting & Surgical Fragment Fast-Path)

> **Domain:** `Edit Mode` & `Pipeline` | **Beneficiary:** `Hybrid` (Human + Agent Loop) | **Two-Axis Classification:** `Server-Connected` + `Interactive / Reactive` | **Journey Companion:** [index.html](index.html)

## Why

While `buildReport()` Assembly already completes in `<100ms` and `serve-report.mjs` already auto-rebuilds `fragment.html` with Idiomorph `<main>` hot-swapping, clicking **Send to agent** in **Edit Mode** (`#edit-dock` → `POST /__agent_edit__`) still incurs multi-turn cold-start latency and broken multi-project routing:
1. **Under-specified Edit Prompt:** `buildEditPrompt()` in `report-runtime.js` ignores `#agent-manifest` (`files.fragment`, `files.entry`, `project`, `theme`, `activeAddons`), omits the `Semantic Fragment` workspace path (`projects/<slug>/fragment.html`), tells the agent to consult `agent-authoring-guide.md` and run `build-report.mjs` manually (even when `serve-report.mjs` auto-rebuilds on save), and sends no target DOM slice.
2. **Broken Multi-Project Scoping in `/__agent_edit__`:** `serve-report.mjs` rejects edits whenever `path.basename(requested) !== targetFileName`—blocking edits on `/projects/<slug>/index.html` whenever the server was started on `create.html` or `implementation-progress.html`—and `rebuildProjectFromFragment()` overwrites `html-report-source` with bare `"index.html"`.
3. **Redundant & Unrouted Inference Dispatch:** `/__agent_edit__` passes the same `scoped` string as both `prompt` and `systemPrompt` to `AgentInferenceRouter.dispatch()` (duplicating the entire prompt), omits `model` routing, points the agent at the compiled 100–300 KB+ `Output Deliverable` instead of the compact `Semantic Fragment`, and lacks an in-process surgical patch fast-path.
4. **Preventable Full Page Reloads:** `injectLiveReload()` hashes all inline `<script>` elements across the whole document, forcing a full reload instead of an Idiomorph hot-swap whenever an edit updates an inline widget script inside `<main>`.

## What Changes

1. **Workspace-Aware Edit Prompt Enrichment (`report-runtime.js`)**
   - Upgrade `getPageInfo()` and `buildEditPrompt()` to read `#agent-manifest` alongside `meta[name="html-report-source"]` and emit canonical workspace-relative paths (`Semantic Fragment`, `Output Deliverable`, `report.manifest.json`), active `Delivery Archetype` / `theme` / `addons`, and auto-rebuild awareness (skipping redundant manual `build-report.mjs` / guide-reading instructions when `fragment.html` is live-watched).
   - Preserve strict determinism: identical tasks and page metadata produce byte-identical prompts, with optional bounded `Target Element` / section snippet context for `/__agent_edit__` dispatch.
2. **Multi-Project Path Resolution & Fragment-First `/__agent_edit__` (`serve-report.mjs`)**
   - Resolve `requested` file paths safely within `workspaceRoot` (supporting both root-served reports and `/projects/<slug>/index.html`), and fix `rebuildProjectFromFragment()` to preserve `projects/<slug>/index.html` as `source`.
   - Automatically resolve the sibling `Semantic Fragment` (`fragment.html`) and `report.manifest.json`, extract the matching `Target Element` / `<section>` slice from `fragment.html` for each queued task, eliminate the duplicate `systemPrompt`/`prompt` concatenation, and pass configurable fast-model routing (`model`).
3. **Surgical Fragment Fast-Patch Path with Safe Fallback (`serve-report.mjs` + `harness.mjs`)**
   - Introduce an optional fast-patch mode on `/__agent_edit__` (when targeting a `fragment.html` with bounded `<section>` / `#target.id` slices and an HTTP or fast CLI model): request a strict structured JSON patch (`search`/`replace` or element `outerHTML` replacement), validate the patched `fragment.html` with `lintFragment()` + `buildReport()` in `<100ms`, write atomically on pass, and fall back seamlessly to the full workspace-tool agent CLI if the patch is inapplicable or the task requires external files/scripts.
4. **Script-Aware `<main>` Hot-Swap (`serve-report.mjs` + `report-runtime.js`)**
   - Keep `<head>` asset signatures distinct from `<main>` widget inline scripts in `injectLiveReload()` so edits inside `fragment.html` continue to hot-swap `<main>` in place with `reinitReportContent()` instead of triggering full browser reloads unless `<head>` or runtime scripts change.

## Capabilities

### New Capabilities
<!-- None: all Edit Mode prompt, handoff, and hot-swap behavior belongs to the existing `page-edit-queue` bounded context. -->

### Modified Capabilities
- `page-edit-queue`: Enrich `buildEditPrompt()` with workspace-relative `#agent-manifest` paths and target context; support multi-project resolution, deduplicated/fast-model dispatch, surgical `fragment.html` fast-patching with `lintFragment()` validation and CLI fallback in `/__agent_edit__`; and preserve `<main>` Idiomorph hot-swap across fragment edits.

## Impact

- **Modified Runtime & Scripts:**
  - `skills/html-report/assets/report-runtime.js` (`getPageInfo()`, `buildEditPrompt()`, `handleSend()`)
  - `skills/html-report/scripts/serve-report.mjs` (`/__agent_edit__`, `rebuildProjectFromFragment()`, `injectLiveReload()`)
  - `skills/html-report/scripts/preflight.mjs` (`AgentInferenceRouter.dispatch()` deduplication guard / fast-patch helper if needed)
  - `skills/html-report/scripts/build-report.mjs` (ensure `source` / `agent-manifest` consistency)
- **Domain Alignment:** Keeps `Assembly` (`buildReport()` `<100ms`) strictly mechanical while upgrading the `Edit Mode` `Pipeline` in `domain-model.mjs` terminology (`Semantic Fragment`, `Output Deliverable`, `Target Element`, `Two-Way Agent Bridge`).
- **Tests:** Unit and integration tests covering workspace-enriched `buildEditPrompt()`, multi-project `/__agent_edit__` path resolution, deduplicated `AgentInferenceRouter` dispatch, surgical `fragment.html` fast-patch + fallback, and `rebuildProjectFromFragment()` source preservation.
