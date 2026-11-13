# Proposal: Experience Review Remediations — Reactive Assembly, Symlink-Safe Verification, Dedicated Ports & Agent-Agnostic Turnkey AI Bridge

## Why

A real-world agentic implementation review (*Stone / Form — Generation I Pokémon design inspiration*, 13 Nov 2026) uncovered seven reproducible integration defects and six deeper architectural friction points across `html-report`'s assembly, verification, scaffolding, workspace hygiene, port defaults, and live AI bridge layers. In addition to stripping reactive `<main>` attributes, silently exiting `0` when verifying via symlink, and colliding on port `3000`, the Turnkey AI Bridge was tightly coupled to `agy` CLI and fabricated `"14.2% across observed cohorts"` claims on CLI failure instead of routing across available LLM harnesses (`claude`, `gemini`, `codex`, `opencode`, `agy`, `ollama`, or HTTP endpoints) and reporting honest unavailability when no provider is configured.

## What Changes

- **Ephemeral `projects/` Workspace Hygiene (`.gitignore` & Git Cleanup)**:
  - Add `projects/` to [.gitignore](file:///home/eta/projects/html-report/.gitignore) and remove all tracked files under `projects/` from the git index and working tree so generated reports are treated purely as local output artifacts and never pollute git history.
- **Dedicated Default Ports (`3031` / `3032`) & Pre-Authoring Environment Preflight CLI (`scripts/preflight.mjs`)**:
  - Change the default Turnkey AI Bridge and project server port from `3000` (which collides with standard web dev servers) to dedicated ports `3031` (primary report/AI bridge server) and `3032` (secondary/telemetry fallback), with automatic free-port probing (`3031..3039`).
  - Add `skills/html-report/scripts/preflight.mjs` (and `--preflight` support in `scaffold-project.mjs`) to verify canonical skill path resolution, port `3031`/`3032` availability, Playwright/System Chrome browser binary resolution, and available AI inference providers in `<500ms` before authoring starts.
- **Preserve `<main>` Reactive Attributes, Conditional AI Chrome & Installation-Aware Scaffolding (`build-report.mjs`, `template-shell.html`, `scaffold-project.mjs`)**:
  - Update `extractMainElement()` to preserve attributes authored on `<main>` (`id`, `x-data`, `x-init`, `x-*`, `@*`, `data-*`, `aria-*`, and merged custom classes) onto `<main id="report-main">` in the assembled shell.
  - Omit `#agent-dock-container` and `#agent-reconnect-modal` markup from the assembled HTML when `ai === false` to reduce default DOM footprint.
  - Resolve the active skill installation directory dynamically relative to `import.meta.url` and `workspaceRoot`, and generate lightweight project-local `package.json` runner scripts (`build`, `serve`, `verify`, `preflight`) in `projects/<slug>/`.
- **Symlink-Safe CLI Execution, System Chrome Fallback & Manifest-Aware Verification (`verify-report.mjs`, `runner.mjs`, `structure.mjs`, `theme-switcher.mjs`)**:
  - Canonicalize `process.argv[1]` and `fileURLToPath(import.meta.url)` via `fs.realpathSync()` across all CLI entrypoints (`verify-report.mjs`, `build-report.mjs`, `scaffold-project.mjs`, `serve-report.mjs`, `preflight.mjs`).
  - Automatically fall back to system Google Chrome/Chromium (`channel: "chrome"` or detected binary path) in `runner.mjs` when Playwright's bundled Chromium revision is missing.
  - Read the expected startup theme from `#agent-manifest` (`theme`) or `--expected-theme` in `core:structure`, inspect a composite chart palette signature (`borderColor`, scalar/array `backgroundColor`, scale colors) in `core:theme-switcher`, and support `--url <http://...>` verification for live server-backed reports.
- **Agent-Agnostic Turnkey AI Bridge & Honest HTTP `503` Unavailability (`serve-report.mjs`)**:
  - **BREAKING (Error Contract & Provider Routing)**: Replace the hardcoded `execFile("agy", ...)` dependency with an agent-agnostic `AgentInferenceRouter` supporting auto-detected or configured CLI harnesses (`claude`, `gemini`, `codex`, `opencode`, `agy`, `ollama`, custom `HTML_REPORT_AI_CMD`) and direct HTTP LLM providers (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `HTML_REPORT_AI_URL`).
  - When no AI provider is available or execution fails (and `payload.heuristic !== true`), return HTTP `503 Service Unavailable` with `{ status: "error", code: "inference_unavailable", error, reason, preflight }` instead of fabricating `"14.2%"` telemetry claims or fake pending actions.
  - Add `GET /api/agent/preflight` (and enrich `GET /api/agent/health`) to report independent status flags for `uiConfigured`, `bridgeReachable`, `providerAvailable`, `activeProvider`, `checkedProviders`, `streamConnected`, and `modelConfigured`.
- **Turnkey `/events` Datastar SSE, `/api/board/state`, Client Board SDK & Vertical-Slice Workflow (`serve-report.mjs`, `report-runtime.js`, `SKILL.md`)**:
  - Add built-in `GET /events` (Datastar SSE with 15s heartbeat) and `GET`/`POST /api/board/state` (with JSON validation, `403` cross-origin protection, and `#live-board-status` fragment broadcast) to `serve-report.mjs`.
  - Separate the UI dock status (`#agent-dock-status`) into independent indicators for Stream (`SSE`), Bridge (`HTTP`), and AI Inference (`Provider`), add a `file://` protocol guard for SSE, and expose `window.HTMLReportAgent.registerContextProvider(fn)`, `window.HTMLReportAgent.setTransportAdapter(fn)`, and `window.HTMLReportBoard` in `report-runtime.js`.
  - Document the 7-Step Vertical-Slice Authoring Workflow, Datastar `@get`/`@post` syntax, and `<canvas>` `min-w-0` responsive rules in [SKILL.md](file:///home/eta/projects/html-report/skills/html-report/SKILL.md) and [agent-authoring-guide.md](file:///home/eta/projects/html-report/skills/html-report/references/agent-authoring-guide.md).

## Capabilities

### New Capabilities
*(None — all changes extend existing core capabilities below.)*

### Modified Capabilities
- `skill-packaging`: Gitignore `projects/` and remove tracked `projects/` files, add the `scripts/preflight.mjs` environment preflight CLI, default project/AI ports to `3031`/`3032`, and codify the 7-step vertical-slice workflow in `SKILL.md` and `agent-authoring-guide.md`.
- `deterministic-assembly`: Preserve `<main>` reactive/application attributes during fragment assembly, conditionally omit AI dock markup when `--ai` is disabled, and emit installation-aware CLI paths plus project-local `package.json` runner scripts in `scaffold-project.mjs`.
- `lean-verification`: Resolve symlinks in CLI entrypoints, automatically fall back to system Chrome when Playwright's bundled Chromium is missing, honor manifest-configured startup themes in `core:structure`, check composite chart palettes in `core:theme-switcher`, and support `--url <http://...>` live HTTP verification.
- `reactive-data-copilot`: Route Turnkey AI Bridge inference across agent-agnostic CLI/HTTP providers (`claude`, `gemini`, `codex`, `opencode`, `agy`, `ollama`, HTTP APIs), return structured HTTP `503` unavailability instead of synthetic analytical claims on failure, expose `/api/agent/preflight` and turnkey `/events` + `/api/board/state` routes, and provide `registerContextProvider` / `HTMLReportBoard` client hooks.

## Impact

- **Workspace & Git Hygiene**: [.gitignore](file:///home/eta/projects/html-report/.gitignore), removal of tracked `projects/*` files
- **Assembly, Scaffolding & Preflight**: [build-report.mjs](file:///home/eta/projects/html-report/skills/html-report/scripts/build-report.mjs), [scaffold-project.mjs](file:///home/eta/projects/html-report/skills/html-report/scripts/scaffold-project.mjs), `skills/html-report/scripts/preflight.mjs`, [domain-model.mjs](file:///home/eta/projects/html-report/skills/html-report/scripts/domain-model.mjs), [template-shell.html](file:///home/eta/projects/html-report/skills/html-report/assets/template-shell.html)
- **Playwright Verifier**: [verify-report.mjs](file:///home/eta/projects/html-report/skills/html-report/playwright/verify-report.mjs), [runner.mjs](file:///home/eta/projects/html-report/skills/html-report/playwright/harness/runner.mjs), [structure.mjs](file:///home/eta/projects/html-report/skills/html-report/playwright/harness/checks/core/structure.mjs), [theme-switcher.mjs](file:///home/eta/projects/html-report/skills/html-report/playwright/harness/checks/core/theme-switcher.mjs)
- **Live Server, Agent-Agnostic AI Bridge & Runtime**: [serve-report.mjs](file:///home/eta/projects/html-report/skills/html-report/scripts/serve-report.mjs), [report-runtime.js](file:///home/eta/projects/html-report/skills/html-report/assets/report-runtime.js), [SKILL.md](file:///home/eta/projects/html-report/skills/html-report/SKILL.md), [agent-authoring-guide.md](file:///home/eta/projects/html-report/skills/html-report/references/agent-authoring-guide.md)
- **Companion Journey Report & Artifacts**:
  - [index.html](file:///home/eta/projects/html-report/openspec/changes/experience-review-remediations/index.html)
  - [design.md](file:///home/eta/projects/html-report/openspec/changes/experience-review-remediations/design.md)
  - [tasks.md](file:///home/eta/projects/html-report/openspec/changes/experience-review-remediations/tasks.md)
  - [specs/skill-packaging/spec.md](file:///home/eta/projects/html-report/openspec/changes/experience-review-remediations/specs/skill-packaging/spec.md)
  - [specs/deterministic-assembly/spec.md](file:///home/eta/projects/html-report/openspec/changes/experience-review-remediations/specs/deterministic-assembly/spec.md)
  - [specs/lean-verification/spec.md](file:///home/eta/projects/html-report/openspec/changes/experience-review-remediations/specs/lean-verification/spec.md)
  - [specs/reactive-data-copilot/spec.md](file:///home/eta/projects/html-report/openspec/changes/experience-review-remediations/specs/reactive-data-copilot/spec.md)
