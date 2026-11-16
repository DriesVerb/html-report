# Tasks

## 1. Workspace-Aware Edit Prompt & Manifest Source Fix

- [x] 1.1 Update `getPageInfo()`, `buildEditPrompt()`, and `handleSend()` in `skills/html-report/assets/report-runtime.js` to read `#agent-manifest` (`files.fragment`, `files.entry`, `project`, `mode`, `theme`, `activeAddons`, `aiConfig.model`), emit workspace-relative `Semantic Fragment` / `Output Deliverable` / `report.manifest.json` paths, skip manual `build-report.mjs` instructions when a live-watched fragment is configured, and preserve byte-identical deterministic output; verify via unit tests covering project and standalone reports.
- [x] 1.2 Fix `rebuildProjectFromFragment()` in `skills/html-report/scripts/serve-report.mjs` to preserve `projects/<slug>/index.html` as `source` (instead of bare `"index.html"`) and verify `meta[name="html-report-source"]` and `#agent-manifest` stay consistent after auto-rebuild via automated test.

## 2. Multi-Project `/__agent_edit__` Routing & Deduplicated Dispatch

- [x] 2.1 Update `POST /__agent_edit__` in `skills/html-report/scripts/serve-report.mjs` to resolve requested report paths safely inside `workspaceRoot` (supporting both root-served reports and `/projects/<slug>/index.html` while rejecting traversal with HTTP 403) and resolve sibling `fragment.html` + `report.manifest.json`; verify via HTTP integration tests.
- [x] 2.2 Eliminate duplicate prompt wrapping in `POST /__agent_edit__` and add an equality guard in `AgentInferenceRouter.dispatch()` (`skills/html-report/scripts/preflight.mjs`) so `systemPrompt === prompt` is never concatenated twice, while forwarding fast-model routing (`payload.model || aiConfig.model`); verify with unit tests asserting the dispatched CLI/HTTP payload.

## 3. Surgical Fragment Fast-Patch & Hot-Swap Preservation

- [x] 3.1 Implement fragment section/`Target Element` slicing and the Tier 1 Surgical Patch fast-path in `skills/html-report/scripts/serve-report.mjs` (request structured JSON `{ patches: [{ find, replace }] }`, verify unique matches, validate with `lintFragment()` + `buildReport()`, write `fragment.html` atomically, and fall back seamlessly to Tier 2 CLI when invalid or inapplicable); verify via mock-provider tests covering both fast-patch success and CLI fallback.
- [x] 3.2 Update `injectLiveReload()` in `skills/html-report/scripts/serve-report.mjs` to separate `<head>`/runtime script signatures from `<main>` widget inline scripts so `fragment.html` edits preserve Idiomorph `<main>` hot-swap (re-evaluating changed `<main>` scripts safely inside a try/catch with `fullReload()` fallback); verify via Playwright or DOM harness test.
- [x] 3.3 Document the Edit Mode fast-patch and fragment-scoped prompt workflow concisely in `skills/html-report/references/two-way-agent-bridge.md` and run `node skills/html-report/scripts/harness.mjs` `--fast` plus the Edit Mode test suite to confirm all checks pass.

## Workflow follow-up

- Update `openspec/changes/speed-up-edit-mode/index.html` and `implementation-progress.html` to reflect each completed phase on `http://localhost:3031`.
- Archive the change with `/openspec-archive-change` once implementation and verification are complete.
