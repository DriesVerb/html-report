# Design: LLM-Digestible Codebase Refactoring

> **Change:** `2026-11-16-llm-digestible-codebase-refactor` | **Proposal:** [proposal.md](proposal.md) | **Tasks:** [tasks.md](tasks.md) | **Journey:** [index.html](index.html)

## Target Directory Architecture

```text
html-report/
├── AGENTS.md                        # OpenSpec rules + Two-Package LLM Codebase Map
├── docs/
│   └── codebase-map.md              # Detailed module index & dependency rules
├── packages/
│   ├── core/
│   │   ├── README.md                # @html-report/core guide & internal map
│   │   ├── assets/
│   │   │   ├── template-shell.html
│   │   │   ├── report-runtime.js    # Slim loader/concatenator (~100 lines) with static ESM exports
│   │   │   └── runtime/             # 01-theme-engine.js .. 08-publisher-and-board.js
│   │   └── scripts/
│   │       ├── build-report.mjs     # Orchestrator (~430 lines)
│   │       ├── harness.mjs          # FSM orchestrator (~480 lines)
│   │       ├── publish-report.mjs   # Publisher CLI (~230 lines)
│   │       └── lib/
│   │           ├── build/           # addon-registry, fragment-sanitizer, agent-manifest, cli
│   │           ├── harness/         # fragment-linter, diagnostics, server-policy, cli
│   │           └── publish/         # zip-writer, asset-discovery, asset-resilience
│   └── studio/
│       ├── README.md                # @html-report/studio guide & internal map
│       ├── assets/
│       │   ├── create.html          # Markup & styles (~1,545 lines)
│       │   ├── create-studio/       # 01-files-and-dropzone.js .. 05-quill-and-projects.js
│       │   ├── authoring-plugin.js  # Slim loader/concatenator (~75 lines) with static ESM exports
│       │   └── authoring/           # 01-agent-bridge-client.js .. 07-manifest-and-bootstrap.js
│       └── scripts/
│           ├── agent-tracker.mjs    # Facade + CLI (~280 lines)
│           ├── datastar-sse.mjs     # Barrel (~65 lines)
│           ├── domain-model.mjs     # Barrel (~55 lines)
│           ├── mcp-server.mjs       # JSON-RPC handlers (~395 lines)
│           ├── preflight.mjs        # Port probing + CLI (~190 lines)
│           ├── scaffold-project.mjs # Scaffolder + CLI (~430 lines)
│           ├── server-utils.mjs     # Barrel (~65 lines)
│           ├── server.mjs           # Server lifecycle (~440 lines)
│           ├── routes/              # static, projects, studio-files, agent-bridge, agent-edit, agent-copilot, mcp, sse, publish
│           └── lib/
│               ├── tracker/         # canonical-schema, telemetry-strategies, observer-renderer, transcript-daemon
│               ├── datastar/        # sse-primitives, session-state, datastar-bridge, telemetry-adapters, reactor-engine
│               ├── domain/          # studio-config, ddd-glossary
│               ├── mcp/             # security-and-schemas
│               ├── preflight/       # inference-router
│               ├── scaffold/        # data-introspector, widget-templates
│               └── server/          # persona-and-session, surgical-patcher, workspace-scanner, live-reload-client, mcp-context, file-watcher, supervisor
```

## Key Technical Decisions

### 1. Ordered Chunk Concatenation for Inlined Browser Assets
`buildReport()` and `injectAuthoringPlugin()` inline `report-runtime.js` and `authoring-plugin.js` directly into standalone single-file HTML outputs (which must work over `file://` without extra network requests).
- Storing browser source in `packages/core/assets/runtime/*.js` and `packages/studio/assets/authoring/*.js` lets developers and LLMs edit 250–550 line focused files.
- `report-runtime.js` and `authoring-plugin.js` become tiny CommonJS assemblers:
  - Expose `getBundledRuntimeSource()` / `getBundledAuthoringSource()` by reading sorted `*.js` chunk files and joining them cleanly.
  - Evaluate the concatenated source once via `new Function(...)` in a shared module scope so cross-chunk helper calls work identically in Node tests.
  - Declare literal `module.exports = { Key: _mod.Key, ... }` so Node's `cjs-module-lexer` continues to support ESM named imports (`import { HTMLReportSettings } from "@html-report/core/assets/report-runtime.js"`).

### 2. Static Script Extraction for `create.html`
`create.html` already relies on browser rendering rather than `buildReport()` inlining, except it must work both via `file://.../packages/studio/assets/create.html` and via `serve-report` (even when tests copy `create.html` alone into a temp directory).
- Relative `<script src="./create-studio/01-files-and-dropzone.js"></script>` tags resolve naturally under `file://` and `packages/studio/assets/`.
- `packages/studio/scripts/routes/static.mjs` adds a `/create-studio/*.js` route falling back to `packages/studio/assets/create-studio/` so isolated temp-directory test servers serve all studio scripts cleanly.
- `packages/studio/public/sw.js` and `packages/core/scripts/pwa-builder.mjs` include `./create-studio/*.js` in precache lists for offline Studio PWAs.

### 3. Barrel & Thin Orchestrator Pattern for Node Scripts
Every top-level `.mjs` file in `packages/core/scripts/` and `packages/studio/scripts/` keeps its exact public named exports, default export, and CLI behavior while delegating implementation details to `scripts/lib/<domain>/*.mjs`.
