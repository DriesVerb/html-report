# HTML Report — Repository & LLM Navigation Map

This document gives AI coding agents and maintainers a fast top-down map of the repository so any subsystem can be located, read, modified, and verified with minimal context consumption.

---

## Package Topology

```
html-report/
├── AGENTS.md (symlinked as CLAUDE.md, GEMINI.md)  <- Mandatory OpenSpec & repo conventions
├── docs/codebase-map.md                           <- This overview map
├── packages/
│   ├── core/       (@html-report/core)            <- Zero-dependency HTML builder, harness, theme compiler, runtime
│   │   └── README.md
│   └── studio/     (@html-report/studio)          <- Creation Studio UI, HTTP/SSE dev server, scaffolding, AI bridge, MCP
│       └── README.md
├── skills/
│   ├── html-report/scripts/*                      <- Public CLI & programmatic shims forwarding to workspace packages
│   ├── html-studio/ SKILL.md
│   ├── html-dashboard/ SKILL.md
│   ├── html-presentation/ SKILL.md
│   ├── html-print/ SKILL.md
│   └── html-pwa/ SKILL.md
├── tests/
│   ├── integration/                               <- Cross-package assembly, publish bundle & zero-key bridge tests
│   └── e2e/                                       <- Playwright browser tests (themes, Reveal.js, CSP, fast assembly)
└── openspec/                                      <- OpenSpec change specs, tasks & localhost:3031 journey reports
```

---

## Where to Look by Task

| Need | Start Here | Implementation Sub-Modules |
| :--- | :--- | :--- |
| Assemble HTML deliverable from fragment | [packages/core/scripts/build-report.mjs](../packages/core/scripts/build-report.mjs) | [packages/core/scripts/lib/build/](../packages/core/scripts/lib/build/) |
| Lint fragment or run verification gate | [packages/core/scripts/harness.mjs](../packages/core/scripts/harness.mjs) | [packages/core/scripts/lib/harness/](../packages/core/scripts/lib/harness/) |
| Change navbar, theme switcher, Mermaid, or Reveal runtime | [packages/core/assets/report-runtime.js](../packages/core/assets/report-runtime.js) | [packages/core/assets/runtime/](../packages/core/assets/runtime/) |
| Adjust DaisyUI custom OKLCH theme compilation | [packages/core/scripts/theme-compiler.mjs](../packages/core/scripts/theme-compiler.mjs) | — |
| Package offline deliverable / ZIP archive | [packages/core/scripts/publish-report.mjs](../packages/core/scripts/publish-report.mjs) | [packages/core/scripts/lib/publish/](../packages/core/scripts/lib/publish/) |
| Modify Creation Studio wizard UI or client logic | [packages/studio/assets/create.html](../packages/studio/assets/create.html) | [packages/studio/assets/create-studio/](../packages/studio/assets/create-studio/) |
| Change HTTP dev server, file watcher, or live reload | [packages/studio/scripts/server.mjs](../packages/studio/scripts/server.mjs) | [packages/studio/scripts/lib/server/](../packages/studio/scripts/lib/server/), [packages/studio/scripts/routes/](../packages/studio/scripts/routes/) |
| Update project scaffolding (`projects/<slug>/`) | [packages/studio/scripts/scaffold-project.mjs](../packages/studio/scripts/scaffold-project.mjs) | [packages/studio/scripts/lib/scaffold/](../packages/studio/scripts/lib/scaffold/) |
| Edit Two-Way Agent Bridge / Edit Dock / Style persistence | [packages/studio/assets/authoring-plugin.js](../packages/studio/assets/authoring-plugin.js) | [packages/studio/assets/authoring/](../packages/studio/assets/authoring/), [packages/studio/scripts/routes/agent-bridge.mjs](../packages/studio/scripts/routes/agent-bridge.mjs) |
| Update MCP server tools, CSRF, or gateway allowlist | [packages/studio/scripts/mcp-server.mjs](../packages/studio/scripts/mcp-server.mjs) | [packages/studio/scripts/lib/mcp/security-and-schemas.mjs](../packages/studio/scripts/lib/mcp/security-and-schemas.mjs), [packages/studio/scripts/routes/mcp.mjs](../packages/studio/scripts/routes/mcp.mjs) |
| Change AI CLI/HTTP provider detection & dispatch | [packages/studio/scripts/preflight.mjs](../packages/studio/scripts/preflight.mjs) | [packages/studio/scripts/lib/preflight/inference-router.mjs](../packages/studio/scripts/lib/preflight/inference-router.mjs) |
| Modify domain archetypes, addons, widgets, or glossary | [packages/studio/scripts/domain-model.mjs](../packages/studio/scripts/domain-model.mjs) | [packages/studio/scripts/lib/domain/](../packages/studio/scripts/lib/domain/) |
| Update Datastar SSE bridge or Agent Tracker | [packages/studio/scripts/datastar-sse.mjs](../packages/studio/scripts/datastar-sse.mjs), [packages/studio/scripts/agent-tracker.mjs](../packages/studio/scripts/agent-tracker.mjs) | [packages/studio/scripts/lib/datastar/](../packages/studio/scripts/lib/datastar/), [packages/studio/scripts/lib/tracker/](../packages/studio/scripts/lib/tracker/) |

---

## Core Architectural Invariants

1. **Module Size Budget (LLM Digestibility Guard):**
   - Every `.mjs`/`.js` module inside `packages/core/{scripts,assets}` and `packages/studio/{scripts,assets}` must remain `<= 650` lines (`create.html <= 1,600` lines).
   - Verified automatically by [packages/core/tests/codebase-digestibility.test.mjs](../packages/core/tests/codebase-digestibility.test.mjs).
2. **Strict Two-Package Boundary:**
   - `@html-report/core` has zero imports or references to studio internals.
   - `@html-report/studio` imports core only via `@html-report/core/*` subpath exports defined in [packages/core/package.json](../packages/core/package.json).
   - Verified automatically by [packages/studio/tests/package-boundary.test.mjs](../packages/studio/tests/package-boundary.test.mjs).
3. **CommonJS ESM Named Export Rule:**
   - [packages/core/assets/report-runtime.js](../packages/core/assets/report-runtime.js) and [packages/studio/assets/authoring-plugin.js](../packages/studio/assets/authoring-plugin.js) are dual CommonJS/ESM-compatible loaders: symbols must be assigned to local identifiers and exported via shorthand object property syntax (`module.exports = { Foo, Bar }`) so Node's `cjs-module-lexer` detects every named ESM import.
4. **Domain Language & Skill Facades:**
   - CLI `--help` output and `NATIVE_MCP_TOOLS` must avoid deprecated synonyms defined in `UBIQUITOUS_GLOSSARY` (enforced by [packages/studio/tests/domain-code-alignment.test.mjs](../packages/studio/tests/domain-code-alignment.test.mjs)).

See [packages/core/README.md](../packages/core/README.md) and [packages/studio/README.md](../packages/studio/README.md) for module-by-module references.
