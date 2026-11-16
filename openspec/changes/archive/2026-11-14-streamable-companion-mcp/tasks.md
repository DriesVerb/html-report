# Tasks

## 1. Streamable HTTP `/mcp` Transport & Localhost Security

- [x] 1.1 Add Streamable HTTP handling in `skills/html-report/scripts/mcp-server.mjs` (batch + notification detection where `id === undefined` yields HTTP `202 Accepted` without breaking direct `handleMCPRequest()` unit callers) and wire `POST /mcp` (plus `OPTIONS`/`405`) in `skills/html-report/scripts/serve-report.mjs` with loopback, `CSRFManager.validateHost()`, and local-`Origin` enforcement (allowing absent `Origin` for native MCP clients while rejecting cross-origin browser requests with `403`); verify via BDD tests in `tests/mcp-bridge.bdd.test.mjs`.
- [x] 1.2 Surface additive `mcpEndpoint: "/mcp"` metadata on `GET /__agent_status__` and `GET /api/agent/preflight` in `skills/html-report/scripts/serve-report.mjs` while keeping legacy `/mcp/sse` + `/mcp/messages` functional; verify existing and new status/handshake tests pass in `tests/mcp-bridge.bdd.test.mjs`.

## 2. Live Report State & Universal DOM/Theme Propagation

- [x] 2.1 Upgrade `mcpContext` (`getTitle`, `getTheme`, `getClientCount`, `getActiveCards` / report metadata) in `skills/html-report/scripts/serve-report.mjs` to inspect the live served `Output Deliverable` (title, `data-report-mode`, sibling `Semantic Fragment` path, extracted `<section>`/`<h1..h3>` `Target Element` IDs) and report combined `liveReloadClients` + `datastarClients`; verify via unit and BDD tests on `report_get_state`.
- [x] 2.2 Extend `injectLiveReload()` (`/__live_reload__`) and `mcpContext` mutators (`broadcastFragment`, `setTheme`, `appendAlert`) in `skills/html-report/scripts/serve-report.mjs` to emit `mcp-fragment` (Idiomorph in-place morph + `reinitReportContent()`), `mcp-theme` (`setReportTheme()`), and `mcp-alert` (dismissible DaisyUI alert inside `#report-main` / `#agent-reaction-bubble`) to both `sseClients` and `datastarClients`; verify via BDD tests asserting SSE payloads and live DOM propagation.

## 3. Single-Call `report_build` Tool & Domain Alignment

- [x] 3.1 Add `report_build` to `NATIVE_MCP_TOOLS` in `skills/html-report/scripts/mcp-server.mjs` and `skills/html-report/assets/mcp_allowlist.json` using canonical domain terminology (`Semantic Fragment`, `Output Deliverable`, `Target Element`), and implement its handler in `serve-report.mjs` with workspace-root path containment, `lintFragment()`, `<100ms` `buildReport()`, atomic write, and `broadcastReload()`; verify via unit tests in `tests/mcp-bridge.test.mjs` (updating tool count to 6 + testing traversal rejection), `tests/mcp-bridge.bdd.test.mjs`, and `tests/domain-code-alignment.test.mjs`.
- [x] 3.2 Document the optional `http://localhost:3031/mcp` Streamable HTTP endpoint concisely in `skills/html-report/references/two-way-agent-bridge.md` (keeping `SKILL.md` `<5KB`) and run `node --test tests/mcp-bridge.test.mjs tests/mcp-bridge.bdd.test.mjs tests/domain-code-alignment.test.mjs` plus `openspec validate streamable-companion-mcp` to confirm all checks pass.

## Workflow follow-up

- Update `openspec/changes/streamable-companion-mcp/index.html` and `implementation-progress.html` after each completed task group so `http://localhost:3031` reflects live journey progress.
- Run `/openspec-archive-change` once implementation and verification are complete.
