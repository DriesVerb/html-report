# Proposal: LLM-Digestible Codebase Refactoring (`@html-report/core` & `@html-report/studio`)

> **Change:** `2026-11-16-llm-digestible-codebase-refactor` | **Journey Companion:** [index.html](index.html) | **Design:** [design.md](design.md) | **Tasks:** [tasks.md](tasks.md) | **Delta Specs:** [skill-packaging](specs/skill-packaging/spec.md) · [deterministic-assembly](specs/deterministic-assembly/spec.md)

## Why

After separating the repository into two cleanly bounded npm workspaces (`@html-report/core` in `packages/core/` and `@html-report/studio` in `packages/studio/`), 16 source and asset files still range between **638 and 4,435 lines**:

| File | Current Lines | Primary Pain Point for LLMs |
| :--- | ---: | :--- |
| `packages/studio/assets/create.html` | 4,435 | 1,538 lines of HTML/CSS + 2,897 lines of inline JS mixed together |
| `packages/core/assets/report-runtime.js` | 3,560 | 12 distinct browser runtime concerns in one file |
| `packages/studio/assets/authoring-plugin.js` | 2,913 | AI bridge, chat dock, settings modal, element picker, queue, style editor |
| `packages/core/scripts/build-report.mjs` | 1,657 | Registry, sanitization, manifest stamping, assembly, and CLI mixed |
| `packages/core/scripts/harness.mjs` | 1,426 | Linter, auto-fixer, error parser, server policy, FSM, and CLI mixed |
| `packages/studio/scripts/agent-tracker.mjs` | 1,360 | Canonical schema, 4 provider strategies, HTML renderer, tail daemon, facade |
| `packages/studio/scripts/datastar-sse.mjs` | 1,293 | SSE primitives, session state, bridge, 2 adapters, anomaly reactor |
| `packages/studio/scripts/scaffold-project.mjs` | 1,289 | Data introspector, 5 widget templates, project generator, CLI |
| `packages/studio/scripts/server-utils.mjs` | 1,255 | Personas, session store, surgical patcher, project scanner, live-reload |
| `packages/studio/scripts/server.mjs` | 1,119 | HTTP bootstrap, MCP context, file watchers, supervisor |
| `packages/studio/scripts/routes/agent-bridge.mjs` | 1,000 | CSRF/preflight/personas, `/api/agent/prompt`, `/__agent_edit__`, `/__agent_style__`, co-pilot |
| `packages/studio/scripts/domain-model.mjs` | 830 | Studio config/CLI generator + DDD bounded-context glossary/rubric |
| `packages/core/scripts/publish-report.mjs` | 825 | CRC32/ZIP writer, asset discovery, CDN inlining, browser recovery snippet, CLI |
| `packages/studio/scripts/routes/projects.mjs` | 716 | Config/scaffold/delete routes + file upload + workspace file scanner |
| `packages/studio/scripts/preflight.mjs` | 710 | Port probing + 6-provider `AgentInferenceRouter` |
| `packages/studio/scripts/mcp-server.mjs` | 638 | Tool schemas, CSRF/Allowlist security classes, JSON-RPC handler |

When an LLM agent needs to modify one behavior (for instance, Mermaid zoom controls, Creation Studio file dropzone, or surgical fragment patching), it must read thousands of unrelated lines—wasting context budget and increasing edit errors.

## What Changes

1. **Maintain Exact Two-Package Boundary & Public API**: Keep `@html-report/core` and `@html-report/studio`, all `package.json` `exports`/`bin` entries, and all `skills/html-report/scripts/*` shims 100% backward-compatible.
2. **Modularize Browser Assets into Ordered Chunks**:
   - Split `packages/core/assets/report-runtime.js` into 8 focused files under `packages/core/assets/runtime/` with a slim CommonJS loader/assembler preserving ESM named exports and `buildReport()` inlining.
   - Split `packages/studio/assets/authoring-plugin.js` into 7 focused files under `packages/studio/assets/authoring/` with a slim CommonJS loader/assembler.
   - Extract inline JS from `packages/studio/assets/create.html` into 5 browser modules under `packages/studio/assets/create-studio/` and serve `/create-studio/*` from `packages/studio/scripts/routes/static.mjs`.
3. **Decompose Monolithic Core & Studio Node Scripts into `scripts/lib/`**:
   - Extract focused, single-purpose modules (`<= 650` lines each) under `packages/core/scripts/lib/` and `packages/studio/scripts/lib/` plus dedicated route handlers under `packages/studio/scripts/routes/`, turning top-level entrypoints into thin orchestrators or clean barrels.
4. **Add LLM Navigation Maps & Automated Size-Budget Guard**:
   - Update [AGENTS.md](../../../AGENTS.md) with a two-package Codebase Architecture & Navigation Map, create [packages/core/README.md](../../../packages/core/README.md), [packages/studio/README.md](../../../packages/studio/README.md), and [docs/codebase-map.md](../../../docs/codebase-map.md), and enforce a `<= 650`-line source module budget via `packages/core/tests/codebase-digestibility.test.mjs`.

## Impact

- **Context Footprint per Task**: Typical file reads drop from `1,000–4,435` lines to `120–500` lines (~75–85% reduction).
- **Zero Breaking Changes**: Existing imports (`@html-report/core/*`, `@html-report/studio/*`, `skills/html-report/scripts/*`, and direct asset imports) remain untouched.
