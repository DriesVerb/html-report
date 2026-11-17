# Tasks: LLM-Digestible Codebase Refactoring

> **Companion Dashboard:** [index.html](index.html) | **Proposal:** [proposal.md](proposal.md) | **Design:** [design.md](design.md) | **Delta Specs:** [skill-packaging](specs/skill-packaging/spec.md) · [deterministic-assembly](specs/deterministic-assembly/spec.md)

## Phase 1: OpenSpec Artifacts & Live Journey Dashboard

- [x] 1.1 Create OpenSpec change artifacts ([proposal.md](proposal.md), [design.md](design.md), [tasks.md](tasks.md), delta specs, and `fragment.html`).
- [x] 1.2 Compile companion `index.html`, sync `implementation-progress.html`, and verify live dashboard on `http://localhost:3031`.

## Phase 2: Decompose `@html-report/core` Client Runtime

- [x] 2.1 Split `packages/core/assets/report-runtime.js` (3,560 lines) into focused chunks under `packages/core/assets/runtime/` (`01-theme-engine.js` through `08-publisher-and-board.js`).
- [x] 2.2 Replace `packages/core/assets/report-runtime.js` with a slim CommonJS loader preserving static ESM named exports, `escapeHtml` source contract, and `getBundledRuntimeSource()`.
- [x] 2.3 Wire `build-report.mjs` to bundle `runtime/*.js` seamlessly when loading the default runtime script.

## Phase 3: Decompose `@html-report/core` Node Scripts

- [x] 3.1 Split `packages/core/scripts/build-report.mjs` (1,657 lines) using `scripts/lib/build/{addon-registry,fragment-sanitizer,agent-manifest,cli}.mjs`.
- [x] 3.2 Split `packages/core/scripts/harness.mjs` (1,426 lines) using `scripts/lib/harness/{fragment-linter,diagnostics,server-policy,cli}.mjs`.
- [x] 3.3 Split `packages/core/scripts/publish-report.mjs` (825 lines) using `scripts/lib/publish/{zip-writer,asset-discovery,asset-resilience}.mjs`.

## Phase 4: Decompose `@html-report/studio` Browser Assets

- [x] 4.1 Split `packages/studio/assets/authoring-plugin.js` (2,913 lines) into `packages/studio/assets/authoring/` (`01-agent-bridge-client.js` through `07-manifest-and-bootstrap.js`) with a slim CommonJS loader + update `authoring-plugin.mjs` & `build-report.mjs`.
- [x] 4.2 Extract inline JavaScript from `packages/studio/assets/create.html` (4,435 lines) into `packages/studio/assets/create-studio/` (`01-files-and-dropzone.js` through `06-quill-and-bootstrap.js`), serve `/create-studio/*` in `routes/static.mjs`, and register in `sw.js` / `pwa-builder.mjs`.

## Phase 5: Decompose `@html-report/studio` Node Scripts & Routes

- [x] 5.1 Split `agent-tracker.mjs` (1,360 lines) into `lib/tracker/{canonical-schema,telemetry-strategies,observer-renderer,transcript-daemon}.mjs`.
- [x] 5.2 Split `datastar-sse.mjs` (1,293 lines) into `lib/datastar/{sse-primitives,session-state,datastar-bridge,telemetry-adapters,reactor-engine}.mjs`.
- [x] 5.3 Split `scaffold-project.mjs` (1,289 lines) into `lib/scaffold/{data-introspector,widget-templates}.mjs`.
- [x] 5.4 Split `server-utils.mjs` (1,255 lines) into `lib/server/{persona-and-session,surgical-patcher,workspace-scanner,live-reload-client}.mjs`.
- [x] 5.5 Split `server.mjs` (1,119 lines) into `lib/server/{mcp-context,file-watcher,supervisor}.mjs`.
- [x] 5.6 Split `routes/agent-bridge.mjs` (1,000 lines) & `routes/projects.mjs` (716 lines) by extracting `routes/{agent-edit,agent-copilot,studio-files}.mjs`.
- [x] 5.7 Split `domain-model.mjs` (830 lines), `preflight.mjs` (710 lines), and `mcp-server.mjs` (638 lines) into `lib/{domain,preflight,mcp}/*.mjs`.

## Phase 6: LLM Navigation Maps & Digestibility Guard

- [x] 6.1 Update `AGENTS.md` with the Codebase Architecture & LLM Navigation Map and add `packages/core/README.md`, `packages/studio/README.md`, and `docs/codebase-map.md`.
- [x] 6.2 Add `packages/core/tests/codebase-digestibility.test.mjs` enforcing `<= 650` lines per `.mjs`/`.js` module, `<= 1,600` lines for `create.html`, syntax validity (`node --check`), and navigation doc presence.

## Phase 7: Full Verification & OpenSpec Completion

- [x] 7.1 Run `npm run test:unit` and verify zero regressions across all core, studio, boundary, and integration suites.
- [x] 7.2 Run `npm run test:e2e` and verify browser E2E suites.
- [x] 7.3 Mark all tasks complete, update the Journey companion to `Shipped / Archived`, sync `implementation-progress.html`, and verify `http://localhost:3031`.
