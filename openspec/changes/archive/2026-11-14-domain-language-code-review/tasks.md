# Tasks: Domain-Language Code Review & Cross-Codebase Alignment

## 1. Core Review: Assembly, Pipeline, & Lifecycle Boundaries
- [x] 1.1 Audit `skills/html-report/scripts/build-report.mjs` and `harness.mjs` to ensure pure Assembly (<100ms join) is cleanly separated from Pipeline FSM orchestration, and normalize deprecated terminology in comments/CLI help.
- [x] 1.2 Audit `skills/html-report/assets/template-shell.html` and `report-runtime.js` to ensure Edit Mode (`#edit-dock`, `TargetElement`) vs. Published Document (`stripAuthoringMarkup()`) boundaries and comments are consistent.
- [x] 1.3 Audit `skills/html-report/scripts/serve-report.mjs` and `datastar-sse.mjs` to verify Two-Axis decoupling (Static File client-side `fetch()` works without server errors; Datastar SSE scoped to Server-Connected mode).

## 2. User-Facing vs. Agent-Facing Surface Alignment
- [x] 2.1 Audit `create.html` and `skills/html-report/assets/create.html` (User-Facing Studio) and add Beneficiary (`User-Facing` vs `Agent-Facing`) and Two-Axis (`Serving Mode` vs `Behavioral Mode`) selectors to the Create Mode wizard.
- [x] 2.2 Audit CLI entrypoints (`html-grill.mjs`, `build-report.mjs`, `skill-router.mjs`) to verify Agent-Facing headless determinism, `--json` output consistency, and canonical terminology.

## 3. Extended Domain Alignment (PWA, Skills, MCP, Docs)
- [x] 3.1 Clarify PWA as an Offline Packaging Modifier across `domain-model.mjs`, `pwa-builder.mjs`, and `skills/html-pwa/SKILL.md`.
- [x] 3.2 Align `skills/*/SKILL.md` headers and `skill-router.mjs` metadata with Beneficiary, Serving Mode, and Behavioral Mode tags (keeping <5KB facade limits).
- [x] 3.3 Align `mcp-server.mjs` (`NATIVE_MCP_TOOLS` schemas & descriptions) with canonical terms (`SemanticFragment`, `OutputDeliverable`, `PublishedDocument`).
- [x] 3.4 Align `README.md` and `docs/*.md` (`architecture-fsm.md`, `api-and-cli-reference.md`, `live-telemetry.md`) with the unified Ubiquitous Language.

## 4. Verification & Companion Sync
- [x] 4.1 Add automated domain-lint assertions verifying zero deprecated synonyms in core CLI help strings and MCP tool descriptions.
- [x] 4.2 Run full test suite (`npm test`) and Playwright verification (`verify-report.mjs --quick`) confirming zero regressions.
- [x] 4.3 Update companion `index.html` and sync to `implementation-progress.html` on `localhost:3000`.
