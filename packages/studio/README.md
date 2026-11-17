# `@html-report/studio` — Creation Studio, Live Dev Server, Scaffolding & AI Bridge

`@html-report/studio` provides the interactive tooling, scaffolding CLI, live-reload dev server, Two-Way AI Agent Bridge, Datastar SSE telemetry, and MCP server on top of `@html-report/core`.

> **Package Boundary Rule:** `@html-report/studio` imports core primitives exclusively through declared `@html-report/core/*` subpath exports in [package.json](package.json) — never via deep relative `../core/...` filesystem imports (enforced by [tests/package-boundary.test.mjs](tests/package-boundary.test.mjs)).

---

## Script & Route Map (`<= 650` Lines Each)

### 1. Live Dev Server (`scripts/server.mjs` + `scripts/lib/server/` + `scripts/routes/`)
- [scripts/server.mjs](scripts/server.mjs) — `startServer()` HTTP/SSE lifecycle, local security guardrails, inference status resolution, heartbeat, and route dispatch.
- **Server Support Sub-Modules (`scripts/lib/server/`):**
  - [scripts/lib/server/persona-and-session.mjs](scripts/lib/server/persona-and-session.mjs) — `MIME_TYPES`, `PersonaRegistry`, `SessionStateStore`, `parseArgs()`, `openBrowser()`, `detectReportMode()`, and `buildLocalBridgeReply()`.
  - [scripts/lib/server/workspace-scanner.mjs](scripts/lib/server/workspace-scanner.mjs) — `findWorkspaceRoot()`, `findActiveChangeDir()`, `isPathInside()`, `isLoopbackAddress()`, `extractProjectMetadata()`, and `scanWorkspaceProjects()`.
  - [scripts/lib/server/surgical-patcher.mjs](scripts/lib/server/surgical-patcher.mjs) — `resolveEditTarget()`, `applyStyleToStandaloneHtml()`, `extractFragmentContext()`, `parseSurgicalPatchPayload()`, and `applySurgicalFragmentPatches()`.
  - [scripts/lib/server/live-reload-client.mjs](scripts/lib/server/live-reload-client.mjs) — `injectLiveReload()` Idiomorph `<main>` hot-swap and MCP SSE browser listener.
  - [scripts/lib/server/mcp-context.mjs](scripts/lib/server/mcp-context.mjs) — `createMcpRuntime()` exposing `inspectServedReport()` and the MCP execution context (`broadcastFragment`, `setTheme`, `appendAlert`, `buildReport`, `exportPdf`).
  - [scripts/lib/server/file-watcher.mjs](scripts/lib/server/file-watcher.mjs) — `createProjectFileWatcher()` watching reports, `projects/*/fragment.html` auto-rebuilds, and active feature changes.
  - [scripts/lib/server/supervisor.mjs](scripts/lib/server/supervisor.mjs) — `runSupervisedServer()` auto-restarting the dev server when server scripts change or `/api/server/restart` is called.
- **HTTP Route Handlers (`scripts/routes/`):**
  - [scripts/routes/sse.mjs](scripts/routes/sse.mjs) — `/__live_reload__` and `/__datastar_stream__` SSE streams.
  - [scripts/routes/publish.mjs](scripts/routes/publish.mjs) — `/__publish__` and live export endpoints.
  - [scripts/routes/mcp.mjs](scripts/routes/mcp.mjs) — `/mcp` Streamable HTTP/SSE JSON-RPC transport and `/api/mcp/call-tool` gateway.
  - [scripts/routes/agent-bridge.mjs](scripts/routes/agent-bridge.mjs) — CSRF token, `/api/agent/preflight`, `/api/agent/personas`, `/api/agent/prompt`, `/api/agent/confirm-action`, delegating edit & co-pilot routes:
    - [scripts/routes/agent-edit.mjs](scripts/routes/agent-edit.mjs) — `/__agent_edit__` (Tier 1 surgical patch + Tier 2 CLI fallback) & `/__agent_style__`.
    - [scripts/routes/agent-copilot.mjs](scripts/routes/agent-copilot.mjs) — `/__agent_action__`, `/api/agent`, `/api/agent-query`, `/api/agent-roast`, `/__agent_status__`.
  - [scripts/routes/projects.mjs](scripts/routes/projects.mjs) — `/api/create/config`, `/api/server/restart`, `/api/create/scaffold`, `/api/create/synthesize`, `/api/projects`, `/api/projects/delete`, `/__boards__`, delegating uploads/file scan:
    - [scripts/routes/studio-files.mjs](scripts/routes/studio-files.mjs) — `/api/create/upload` and `/api/create/workspace-files`.
  - [scripts/routes/static.mjs](scripts/routes/static.mjs) — Static file server, `/create` Studio routing, `/create-studio/*.js` modular asset serving, PWA manifest/SW routes, and OpenSpec `.md` viewer routes.

### 2. Project Scaffolding & CLI Interview
- [scripts/scaffold-project.mjs](scripts/scaffold-project.mjs) — `scaffoldProject()` creating `projects/<slug>/{fragment.html,index.html,report.manifest.json,AGENTS.md,package.json}` + CLI entrypoint.
  - [scripts/lib/scaffold/data-introspector.mjs](scripts/lib/scaffold/data-introspector.mjs) — `slugifyProject()`, `resolveUniqueSlug()`, `stageReferenceFiles()`, CSV/TSV/JSON bounded introspection.
  - [scripts/lib/scaffold/widget-templates.mjs](scripts/lib/scaffold/widget-templates.mjs) — KPI, Chart.js, Grid.js, Mermaid, Timeline, and Reveal starter fragment generators + per-project `AGENTS.md`/`package.json` templates.
- [scripts/domain-model.mjs](scripts/domain-model.mjs) — Barrel re-exporting studio domain & DDD helpers:
  - [scripts/lib/domain/studio-config.mjs](scripts/lib/domain/studio-config.mjs) — `DAISYUI_THEMES`, `TARGET_DEFINITIONS`, `ADDON_CATALOG`, `WIDGET_PRESETS`, `normalizeDomainConfig()`, `generateCliCommand()`, `generateDeterministicPrompt()`.
  - [scripts/lib/domain/ddd-glossary.mjs](scripts/lib/domain/ddd-glossary.mjs) — `BOUNDED_CONTEXTS`, `UBIQUITOUS_GLOSSARY`, `SERVING_MODES`, `BEHAVIORAL_MODES`, `evaluateFeatureAlignment()`.
- [scripts/html-grill.mjs](scripts/html-grill.mjs) — Interactive CLI interview (`html-grill`) for project configuration.
- [scripts/open-create.mjs](scripts/open-create.mjs) & [scripts/install-pwa.mjs](scripts/install-pwa.mjs) — Studio launcher and standalone PWA installer.

### 3. Preflight, MCP, Datastar SSE & Agent Telemetry
- [scripts/preflight.mjs](scripts/preflight.mjs) — Port probing, Chrome detection, `runPreflight()`, plus router re-exports from:
  - [scripts/lib/preflight/inference-router.mjs](scripts/lib/preflight/inference-router.mjs) — `SUPPORTED_CLI_PROVIDERS`, `sanitizeCliError()`, `AgentInferenceRouter`.
- [scripts/mcp-server.mjs](scripts/mcp-server.mjs) — JSON-RPC 2.0 `handleMCPRequest()`, `handleMCPHttpPayload()`, `handleGatewayCallTool()`, paired with:
  - [scripts/lib/mcp/security-and-schemas.mjs](scripts/lib/mcp/security-and-schemas.mjs) — `NATIVE_MCP_TOOLS`, `CSRFManager`, `AllowlistManager`.
- [scripts/datastar-sse.mjs](scripts/datastar-sse.mjs) — Barrel for live hypermedia & anomaly telemetry under `scripts/lib/datastar/`:
  - [scripts/lib/datastar/sse-primitives.mjs](scripts/lib/datastar/sse-primitives.mjs), [session-state.mjs](scripts/lib/datastar/session-state.mjs), [datastar-bridge.mjs](scripts/lib/datastar/datastar-bridge.mjs), [telemetry-adapters.mjs](scripts/lib/datastar/telemetry-adapters.mjs), [reactor-engine.mjs](scripts/lib/datastar/reactor-engine.mjs).
- [scripts/agent-tracker.mjs](scripts/agent-tracker.mjs) — CLI + barrel for multi-agent transcript observation under `scripts/lib/tracker/`:
  - [scripts/lib/tracker/canonical-schema.mjs](scripts/lib/tracker/canonical-schema.mjs), [telemetry-strategies.mjs](scripts/lib/tracker/telemetry-strategies.mjs), [observer-renderer.mjs](scripts/lib/tracker/observer-renderer.mjs), [facade.mjs](scripts/lib/tracker/facade.mjs), [transcript-daemon.mjs](scripts/lib/tracker/transcript-daemon.mjs).
- [scripts/telemetry-streamer.mjs](scripts/telemetry-streamer.mjs) — Synthetic & live SSE stream CLI feeder.
- [scripts/authoring-plugin.mjs](scripts/authoring-plugin.mjs) — Server-side helper loading the modular authoring bundle into built reports.

---

## Browser Assets (`assets/` & `public/`)

- **Creation Studio (`assets/create.html` + `assets/create-studio/*.js`):**
  1. [assets/create-studio/01-files-and-dropzone.js](assets/create-studio/01-files-and-dropzone.js) — File picker, drag/drop upload, workspace reference file staging.
  2. [assets/create-studio/02-theme-and-wizard.js](assets/create-studio/02-theme-and-wizard.js) — Two-axis wizard controls, theme studio, OKLCH custom colors, live mockup sync.
  3. [assets/create-studio/03-prompt-and-preview.js](assets/create-studio/03-prompt-and-preview.js) — Turnkey AI bridge prompts, copy/save actions, command synthesis.
  4. [assets/create-studio/04-scaffold-and-bridge.js](assets/create-studio/04-scaffold-and-bridge.js) — Project scaffold submission and Part 1/Part 2 handshake lock.
  5. [assets/create-studio/05-projects-directory.js](assets/create-studio/05-projects-directory.js) — Workspace projects grid, search/filter, delete modal.
  6. [assets/create-studio/06-quill-and-bootstrap.js](assets/create-studio/06-quill-and-bootstrap.js) — Rich goals Quill editor, PWA install/SW registration, initial bootstrap.
- **In-Browser Authoring Plugin ([assets/authoring-plugin.js](assets/authoring-plugin.js) + `assets/authoring/*.js` + [assets/edit-dock.html](assets/edit-dock.html)):**
  - `assets/authoring/01-agent-bridge-client.js` through `07-manifest-and-bootstrap.js` implement `HTMLReportAgent`, `HTMLReportEdit`, `HTMLReportSettings`, and `HTMLReportPublisher` inside the `getBundledAuthoringSource()` IIFE.
- **PWA Shell ([public/sw.js](public/sw.js)):** Precaches `/create` and `./create-studio/01..06.js` while bypassing `/api/*`, `/__agent_*`, `/mcp`, and SSE endpoints.
