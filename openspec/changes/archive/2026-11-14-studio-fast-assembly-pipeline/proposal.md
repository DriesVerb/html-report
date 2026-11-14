# Proposal: Studio Fast Assembly & Smart Scaffolding Pipeline

## Beneficiary & Domain Classification
- **Primary Beneficiary:** `Hybrid` (Accelerates both the human Creation Studio experience and AI coding agent execution)
- **Two-Axis Alignment:** Preserves decoupled `Serving Mode` (`Static File` vs `Server-Connected`) and `Behavioral Mode` (`Interactive / Reactive` vs `Passive / Printable`) + `App Packaging` (`browser` | `live-app` | `offline-app`).
- **Assembly vs. Pipeline Invariant:** Keeps `buildReport()` mechanical Assembly under `<100ms` while upgrading the Pipeline (`create.html` -> `scaffold-project.mjs` -> `serve-report.mjs` -> `harness.mjs`) to eliminate redundant LLM round-trips and token waste.

## Why
Even with the deterministic `<100ms` Assembly harness, creating a new deliverable still incurs avoidable manual and LLM overhead:
1. **Setup round-trip:** Users copy a prompt from `create.html` and wait for an AI agent to run `scaffold-project.mjs` before any content work begins.
2. **Manual rebuild loop:** Editing `projects/<slug>/fragment.html` requires re-running `build-report.mjs` manually before `serve-report.mjs` live-reloads `index.html`.
3. **Cold-start widget boilerplate:** Agents repeatedly write identical DaisyUI KPI/Chart.js/Grid.js skeletons and re-inspect attached CSV/JSON schemas from scratch.
4. **Slow draft verification:** Running full headless Chromium checks on every minor fragment tweak slows iteration.
5. **Prompt copy/paste friction & domain drift:** `create.html` duplicates `domain-model.mjs` prompt logic (including a `"lemon"` vs `"lemonade"` theme mismatch) and has no direct bridge dispatch or independent project folder input.

## What Changes
1. **One-Click "Scaffold & Open" + Optional Project Folder Name (`#input-project-slug`)**:
   - Let users specify a short folder slug independent of the AI display title (`heroTitle`), or auto-generate one.
   - Add `POST /api/create/scaffold` in `serve-report.mjs` to run `scaffoldProject()`, stage `projects/_uploads/*` into `projects/<slug>/refs/`, and open the live board immediately.
2. **Auto-Rebuild `fragment.html` -> `index.html` on Save**:
   - Watch `fragment.html` alongside `index.html` in `serve-report.mjs` and invoke `buildReport()` in-process using `report.manifest.json`.
3. **Layout & Widget Presets (`--widgets`)**:
   - Define canonical `WIDGET_PRESETS` in `domain-model.mjs` and render theme-safe DaisyUI v4 starter blocks in `scaffold-project.mjs`.
4. **Data-Driven Starter Widgets (CSV/JSON Introspection)**:
   - Parse headers/keys of attached `.csv`/`.json` reference files during scaffolding to pre-wire a real **Grid.js** table and **Chart.js** canvas.
5. **Two-Speed Verification (`--fast` Static Gate vs. Playwright)**:
   - Expose a sub-second static lint gate in `harness.mjs` (`lintFragment()` + `autoFixFragment()` + `buildReport()`) for rapid drafts, reserving Playwright for final checks.
6. **Direct "Send to Bridge" Dispatch & `domain-model.mjs` Unification**:
   - Unify `create.html` prompt synthesis with `domain-model.mjs` (`/api/create/synthesize`) and add a **"Send to Agent"** action when `/api/agent/preflight` detects a connected bridge listener.

## Capabilities

### New Capabilities
- `studio-fast-assembly`: One-click project scaffolding, `fragment.html` auto-rebuild watcher, widget presets, CSV/JSON data-bound starters, fast static verification gate, and direct bridge dispatch.

## Impact
- **Modified:** `skills/html-report/scripts/domain-model.mjs`, `skills/html-report/scripts/scaffold-project.mjs`, `skills/html-report/scripts/serve-report.mjs`, `skills/html-report/scripts/harness.mjs`, `skills/html-report/assets/create.html`, `create.html`.
- **Tests:** New unit & Playwright integration tests covering `/api/create/scaffold`, `fragment.html` watch-rebuild, `--widgets`, CSV/JSON starter generation, and `--fast` lint gate.
