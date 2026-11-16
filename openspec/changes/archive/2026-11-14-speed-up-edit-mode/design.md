# Design: Speed Up Edit Mode

## Context

See [proposal.md](proposal.md) for motivation and [specs/page-edit-queue/spec.md](specs/page-edit-queue/spec.md) for behavioral requirements.

Currently, Edit Mode spans three layers:
1. **Browser Dock (`skills/html-report/assets/report-runtime.js`):** `getPageInfo()`, `buildEditPrompt()`, and `handleSend()` in `HTMLReportEditQueue`.
2. **Dev Server & Live Reload (`skills/html-report/scripts/serve-report.mjs`):** `POST /__agent_edit__`, `rebuildProjectFromFragment()`, and `injectLiveReload()`.
3. **Inference & Validation (`skills/html-report/scripts/preflight.mjs`, `build-report.mjs`, `harness.mjs`):** `AgentInferenceRouter.dispatch()`, `buildReport()`, and `lintFragment()`.

Two existing bugs compound latency and block project workflows:
- `POST /__agent_edit__` restricts edits to `path.basename(requested) === targetFileName`, returning HTTP 403 when users open `/projects/<slug>/index.html` while `serve-report.mjs` is rooted on `create.html` or `implementation-progress.html`.
- `POST /__agent_edit__` passes `scoped` as both `prompt` and `systemPrompt` to `AgentInferenceRouter.dispatch()`, which concatenates `${systemPrompt}\n\n${prompt}` and doubles the prompt payload.

## Goals / Non-Goals

**Goals:**
- Supply agents with exact workspace-relative `Semantic Fragment` (`fragment.html`), `Output Deliverable` (`index.html`), and `report.manifest.json` paths directly from `#agent-manifest`.
- Support `/projects/<slug>/index.html` and root-served reports uniformly in `/__agent_edit__` with strict workspace-root containment.
- Eliminate duplicate prompt payloads and pass fast-model routing to `AgentInferenceRouter.dispatch()`.
- Enable a `<100ms`-validated **Surgical Fragment Fast-Patch** path that edits `fragment.html` in-process without spinning up a multi-turn CLI session, with automatic fallback to full CLI execution.
- Preserve Idiomorph `<main>` hot-swap across `fragment.html` edits (including chart/widget script updates inside `<main>` when safe).

**Non-Goals:**
- Modifying `Create Mode` (`create.html`, `/api/create/scaffold`) or `Published Document` (`--published`) pruning rules.
- Replacing `AgentInferenceRouter` provider discovery or adding vendor-specific SDK dependencies.
- Allowing patches to modify files outside the resolved report directory / workspace root.

## Decisions

### 1. Enrich `getPageInfo()` and `buildEditPrompt()` via `#agent-manifest`
- **Choice:** `getPageInfo()` reads `#agent-manifest` (`project`, `files.entry`, `files.fragment`, `mode`, `theme`, `activeAddons`, `aiConfig.model`) and falls back to `meta[name="html-report-source"]` when `#agent-manifest` is absent. `buildEditPrompt()` emits `Semantic Fragment`, `Output Deliverable`, and `Manifest` paths when `files.fragment` is present, and replaces `"Rebuild with build-report.mjs"` / `"refer to agent-authoring-guide.md"` with a concise note that `serve-report.mjs` auto-rebuilds `fragment.html` on save.
- **Alternative Considered:** Embedding full `outerHTML` snapshots inside the human-visible prompt box in `#edit-dock`.
- **Rationale:** Keeping full DOM slices out of the clipboard prompt preserves readability and determinism; the server can extract authoritative slices directly from `fragment.html` on disk during `/__agent_edit__`.

### 2. Workspace-Root Path Resolution & `rebuildProjectFromFragment()` Source Fix
- **Choice:** In `/__agent_edit__`, resolve `payload.file` relative to `workspaceRoot` (handling `/projects/<slug>/index.html`, `projects/<slug>/index.html`, or `/` → `resolvedPath`), enforce `isPathInside(workspaceRoot, candidate)` + `.html` extension check, and resolve sibling `fragment.html` + `report.manifest.json` in `path.dirname(targetHtmlPath)`. In `rebuildProjectFromFragment()`, compute `source` as `manifest.project ? "projects/" + manifest.project + "/index.html" : (manifest.files?.entry || "index.html")`.
- **Alternative Considered:** Requiring users to start a separate `serve-report.mjs` process per project.
- **Rationale:** `create.html` and the navbar Projects Hub already link directly to `/projects/<slug>/index.html` on port 3031; `/__agent_edit__` must work seamlessly on those served pages.

### 3. Deduplicated Dispatch & Fast-Model Selection
- **Choice:** Pass a concise role-scoped `systemPrompt` and the task `prompt` separately in `/__agent_edit__`, and guard `AgentInferenceRouter.dispatch()` so if `systemPrompt === prompt`, it does not duplicate the text. Resolve `model` from `payload.model || manifest?.aiConfig?.model || "Gemini 3.8 Flash (Low)"` (or configured override).
- **Alternative Considered:** Always using the CLI's default heavyweight model.
- **Rationale:** Most Edit Mode tasks are localized HTML/DaisyUI/copy adjustments where a Flash-class model responds 3–10× faster.

### 4. Two-Tier Edit Execution: Surgical Patch Fast-Path → CLI Fallback
- **Choice:** When a sibling `fragment.html` exists and `payload.mode !== "cli"`:
  1. **Context Slicing:** Extract bounded HTML slices from `fragment.html` for each task's `target.id` (`#id` / `data-agent-id`) or `anchor.id` (`<section id="...">`), plus a compact outline of section IDs if any task lacks an anchor.
  2. **Tier 1 (Fast Patch):** Request a strict JSON response `{ "patches": [{ "find": "...", "replace": "..." }] }` from `AgentInferenceRouter.dispatch()`. Verify every `find` matches uniquely in `fragment.html`, apply replacements in memory, validate with `lintFragment()` + `buildReport()` (`<100ms`), and write `fragment.html` atomically if valid (letting `scheduleFragmentRebuild()` update `index.html` and broadcast reload).
  3. **Tier 2 (Full CLI Fallback):** If Tier 1 fails to parse, fails unique match, fails `lintFragment()`/`buildReport()`, or the task explicitly requests external workspace files/datasets/scripts, dispatch a fragment-scoped prompt (including the exact `fragment.html` path and pre-sliced context) with `timeoutMs: 300000` so the full CLI agent edits `fragment.html` directly.
- **Alternative Considered:** Always invoking the full CLI agent (`agy -p` / `claude -p`) with `timeoutMs: 300000`.
- **Rationale:** A single-turn surgical patch avoids CLI process spin-up, file-discovery turns, and full-file rewrites, reducing typical edits from tens of seconds to a few seconds while keeping full fallback fidelity.

### 5. Fragment-Scoped Idiomorph Hot-Swap
- **Choice:** In `injectLiveReload()`, hash `<head>` assets + non-`<main>` scripts separately from `<main>` inline scripts. When only `<main>` content or `<main>` widget inline scripts change, morph `<main>` with Idiomorph, re-execute changed `<main>` `<script>` nodes cleanly inside a try/catch (falling back to `fullReload()` on error), and invoke `window.reinitReportContent()`.
- **Alternative Considered:** Triggering `fullReload()` whenever any `<script>` inside `<main>` changes.
- **Rationale:** Keeps theme, scroll position, and unaffected widgets intact during chart/table config edits.

## Risks / Trade-offs

- **[Risk] Fast-patch model emits invalid HTML or non-unique `find` strings** → **Mitigation:** Require exact unique substring match on `fragment.html`, run `lintFragment()` + `buildReport()` before writing to disk, and fall back automatically to Tier 2 CLI on any mismatch or lint error.
- **[Risk] Re-executing `<main>` inline `<script>` during hot-swap collides with `const`/`let` top-level bindings or existing Chart.js instances** → **Mitigation:** `report-runtime.js` (`reinitReportContent()`) already tears down/re-renders standard widgets; wrap any changed `<main>` script re-evaluation in an IIFE or fall back immediately to `fullReload()` if an execution error occurs.
- **[Risk] Multi-project `/__agent_edit__` widens writable scope beyond `resolvedPath`** → **Mitigation:** Enforce `isPathInside(workspaceRoot, candidatePath)`, restrict targets to `.html` report deliverables (and their sibling `fragment.html`), and retain loopback + Origin + CSRF token validation (`enforceLocalBridgeSecurity`).
