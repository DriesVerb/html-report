# Proposal: Minimal Streamable Companion MCP on `serve-report.mjs`

> **Domain:** `Pipeline` & `Two-Way Agent Bridge` | **Beneficiary:** `Agent-Facing` (with `Hybrid` live-loop UX) | **Two-Axis Classification:** `Server-Connected` + `Interactive / Reactive` | **Journey Companion:** [index.html](index.html)

## Why

[`serve-report.mjs`](../../skills/html-report/scripts/serve-report.mjs) already runs a persistent Node.js server (default `localhost:3031`) and imports [`mcp-server.mjs`](../../skills/html-report/scripts/mcp-server.mjs), yet three code-level gaps prevent it from serving as a clean, reliable companion MCP for modern AI coding agents:

1. **Legacy-only MCP transport:** `serve-report.mjs` only exposes the two-endpoint `2024-11-05` HTTP+SSE pair (`GET /mcp/sse` + `POST /mcp/messages`). Modern MCP clients expect a single **Streamable HTTP** endpoint (`POST /mcp`) when attaching to a running URL (`http://localhost:3031/mcp`), and `handleMCPRequest()` currently returns JSON-RPC response objects even for notifications lacking an `id`.
2. **Missing localhost security & universal live propagation:** `/mcp/messages` currently responds with `Access-Control-Allow-Origin: *` without loopback/`Host`/`Origin` enforcement, and `mcpContext` mutators (`report_update_fragment`, `report_set_theme`, `report_append_alert`) only write to `datastarClients` (`/events`) targeting `#theme-runtime-hook` / `#agent-reaction-bubble`—elements that do not exist in standard `template-shell.html` deliverables—leaving `sseClients` (`/__live_reload__` + Idiomorph, active on every served `Output Deliverable`) unreached and returning hardcoded `activeCards` in `report_get_state`.
3. **No 1-call `Semantic Fragment` assembly tool:** Agents connected over MCP have no structured tool to validate and compile a `Semantic Fragment` via `lintFragment()` + `buildReport()` in `<100ms` without writing temporary fragment files or shelling out.

At the same time, wrapping all CLI scripts into a separate `stdio` daemon with a dozen tools would add always-on token overhead and port conflicts. Keeping the companion MCP minimal and hosted directly inside the already-running `serve-report.mjs` process preserves the repo's zero-dependency, progressive-disclosure philosophy (`SKILL.md` `<5KB`, zero-config CLI) while upgrading `:3031` into a true live agent canvas.

## What Changes

1. **Streamable HTTP `/mcp` Route (`serve-report.mjs` & `mcp-server.mjs`)**
   - Add `POST /mcp` (plus `DELETE /mcp` / `OPTIONS /mcp` handling) dispatching single JSON-RPC requests, batched requests, and `202 Accepted` notifications via `handleMCPRequest()` while keeping legacy `/mcp/sse` + `/mcp/messages` intact.
   - Enforce loopback remote address, `CSRFManager.validateHost()`, and `Origin` guardrails on `/mcp` (rejecting untrusted browser origins with HTTP `403` while permitting native non-browser MCP clients that omit `Origin`).
2. **Real Report State & Universal Live-DOM Propagation (`serve-report.mjs`)**
   - Upgrade `mcpContext.getTitle` / `getTheme` / `getClientCount` / `getActiveCards` to inspect the served `Output Deliverable` (real `<title>`, `data-report-mode`, sibling `Semantic Fragment` path, and extracted `<section id>` / heading `Target Element` IDs) alongside live `datastarClients` + `sseClients` counts.
   - Extend `injectLiveReload()` (`/__live_reload__`) to handle `mcp-fragment`, `mcp-theme`, and `mcp-alert` SSE events using the already-loaded `Idiomorph` instance, `window.setReportTheme()`, and a dismissible DaisyUI alert toast inside `<main id="report-main">`, while still broadcasting to `datastarClients`.
3. **Lean 6-Tool Surface with `report_build` (`mcp-server.mjs` & `mcp_allowlist.json`)**
   - Retain the 5 canonical tools (`report_get_state`, `report_update_fragment`, `report_set_theme`, `report_append_alert`, `report_export_pdf`) and add `report_build` to validate (`lintFragment()`) and assemble (`buildReport()`) a `Semantic Fragment` inside the workspace root in `<100ms`, triggering live reload/hot-swap and returning structured diagnostics.
   - Keep `NATIVE_MCP_TOOLS` compliant with `UBIQUITOUS_GLOSSARY` canonical terms (`Semantic Fragment`, `Output Deliverable`, `Published Document`, `Target Element`) and add `report_build` to `mcp_allowlist.json`.
4. **Additive Compatibility with AI Bridge & Turnkey Reconnect**
   - Keep `HTMLReportAgent` (`report-runtime.js`), `getReconnectPrompt()`, `/__agent_action__`, and `/__agent_edit__` untouched; optionally surface `mcpEndpoint: "/mcp"` in `GET /__agent_status__` / `GET /api/agent/preflight` metadata.

## Capabilities

### New Capabilities
- `companion-mcp`: Minimal Streamable HTTP (`/mcp`) companion MCP server hosted inside `serve-report.mjs` with localhost security guardrails, real report state inspection, universal live-reload/Datastar DOM & theme propagation, and 1-call `report_build` assembly.

### Modified Capabilities
<!-- None: domain-code-alignment already governs canonical terminology in NATIVE_MCP_TOOLS; reactive-data-copilot and page-edit-queue remain unchanged. -->

## Impact

- **Server & Protocol:**
  - [`skills/html-report/scripts/mcp-server.mjs`](../../skills/html-report/scripts/mcp-server.mjs) (`report_build` tool schema + execution, notification handling, canonical descriptions)
  - [`skills/html-report/scripts/serve-report.mjs`](../../skills/html-report/scripts/serve-report.mjs) (`POST /mcp` Streamable HTTP dispatcher, loopback/Host/Origin security, real `mcpContext`, `sseClients` + `injectLiveReload()` MCP event handlers, `report_build` workspace-scoped handler)
  - [`skills/html-report/assets/mcp_allowlist.json`](../../skills/html-report/assets/mcp_allowlist.json) (`report_build` allowlist & policy)
- **Philosophy Invariants Preserved:**
  - `Assembly` (`buildReport()`) stays strictly mechanical (`<100ms`), `Published Document` (`--published`) remains zero-server/zero-MCP, and `SKILL.md` stays `<5KB` with zero mandatory MCP setup.
- **Tests:**
  - [`tests/mcp-bridge.test.mjs`](../../tests/mcp-bridge.test.mjs), [`tests/mcp-bridge.bdd.test.mjs`](../../tests/mcp-bridge.bdd.test.mjs), and [`tests/domain-code-alignment.test.mjs`](../../tests/domain-code-alignment.test.mjs).
