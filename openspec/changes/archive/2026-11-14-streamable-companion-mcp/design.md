# Design: Minimal Streamable Companion MCP

## Context

See [proposal.md](proposal.md) for motivation and [specs/companion-mcp/spec.md](specs/companion-mcp/spec.md) for the behavioral contract.

Three existing modules already carry most of the mechanics:
1. **`skills/html-report/scripts/mcp-server.mjs`**: Exports `NATIVE_MCP_TOOLS`, `CSRFManager`, `AllowlistManager`, `handleMCPRequest()`, and `handleGatewayCallTool()`.
2. **`skills/html-report/scripts/serve-report.mjs`**: Serves reports on `localhost:3031`, maintains two SSE client sets (`sseClients` on `/__live_reload__` with `Idiomorph`, and `datastarClients` on `/events` / `/__datastar_stream__`), enforces loopback + Host + Origin security via `enforceLocalBridgeSecurity()` / `isSameOriginOrLocalRequest()`, and mounts `/mcp/sse`, `/mcp/messages`, `/api/mcp/csrf-token`, and `/api/mcp/call-tool`.
3. **`skills/html-report/scripts/build-report.mjs` & `harness.mjs`**: Provide `buildReport()` (`<100ms` deterministic assembly) and `lintFragment()`.

Code inspection surfaced four concrete mismatches we resolve here:
- `/mcp/messages` currently accepts wildcard CORS (`Access-Control-Allow-Origin: *`) and lacks loopback/Host/Origin checks.
- `handleMCPRequest()` always returns a JSON-RPC result object even when `id === undefined` (notifications).
- `mcpContext` in `serve-report.mjs` returns hardcoded `["kpi-card", "chart-container", "gridjs-table"]` in `getActiveCards()`, and its `broadcastFragment` / `setTheme` / `appendAlert` callbacks only push to `datastarClients` targeting `#theme-runtime-hook` / `#agent-reaction-bubble` (neither exists in `template-shell.html`).
- `tests/mcp-bridge.test.mjs` asserts `res.result.tools.length === 5` on `tools/list`, and `skills/html-report/assets/mcp_allowlist.json` only lists the original 5 internal tools.

## Goals / Non-Goals

**Goals:**
- Expose a clean, spec-compliant Streamable HTTP `POST /mcp` endpoint on `serve-report.mjs` reusing `handleMCPRequest()` with zero new npm dependencies.
- Apply `enforceLocalBridgeSecurity`-style loopback + `Host` + `Origin` checks to `/mcp` while keeping non-browser MCP clients (`Origin` omitted) working seamlessly.
- Make `report_get_state`, `report_update_fragment`, `report_set_theme`, and `report_append_alert` work out of the box on *every* report served by `serve-report.mjs` (both `sseClients` via `/__live_reload__` and `datastarClients` via `/events`).
- Add a single `report_build` tool (`Semantic Fragment` → `Output Deliverable` via `lintFragment()` + `buildReport()`) strictly bounded to the workspace root.
- Preserve `Assembly` purity (`template-shell.html` untouched), `Published Document` (`--published`) static independence, and `HTMLReportAgent` / Turnkey reconnect compatibility.

**Non-Goals:**
- Adding a separate `stdio` MCP binary or wrapping every CLI script (`scaffold`, `theme-compiler`, `html-grill`, `verify-report`) as MCP tools.
- Modifying `create.html`, `template-shell.html`, `report-runtime.js` `HTMLReportAgent`, or `SKILL.md` (`SKILL.md` remains <5KB and CLI-first).
- Replacing or breaking legacy `/mcp/sse`, `/mcp/messages`, or `/api/mcp/call-tool` (including existing mock external adapters in `mcp-server.mjs`).

## Decisions

### 1. Host Streamable HTTP `/mcp` Inside `serve-report.mjs` (No Separate `stdio` Daemon)
- **Choice:** Add `POST /mcp` (plus `OPTIONS /mcp` and `405 Method Not Allowed` for unsupported verbs like `GET /mcp` unless SSE is later needed) directly on `serve-report.mjs`, delegating to `handleMCPRequest()` in `mcp-server.mjs`.
- **Alternative Considered:** Creating a standalone `mcp-stdio.mjs` launcher registered in `package.json` `bin` that proxies to `localhost:3031` or spawns its own server.
- **Rationale:** `serve-report.mjs` is already kept running on `localhost:3031` during active feature and dashboard work. Adding `/mcp` in-process avoids port contention, orphaned IDE subprocesses, per-client `bin` config friction, and always-on token bloat for non-report tasks.

### 2. Loopback + Host + Origin Security on `/mcp` (No Wildcard CORS)
- **Choice:** Gate `/mcp` with loopback remote-address verification, `CSRFManager.validateHost(req.headers.host)`, and local-origin validation when `req.headers.origin !== undefined` (`isValidLocalOrigin`), returning `403` on non-local origins and applying `applyLocalCorsHeaders(req, ...)` instead of `Access-Control-Allow-Origin: *`. Leave `/mcp/sse` + `/mcp/messages` untouched so existing BDD tests stay backward-compatible.
- **Alternative Considered:** Requiring `X-CSRF-Token` on `/mcp`.
- **Rationale:** Native MCP clients (CLI/IDE harnesses) connect directly over HTTP without a browser Origin or CSRF cookie; rejecting untrusted browser `Origin` headers and non-loopback `Host` headers blocks CSRF/DNS-rebinding from web tabs without breaking native MCP clients.

### 3. JSON-RPC Notification & Batch Handling in `mcp-server.mjs`
- **Choice:** Keep `handleMCPRequest()` backward-compatible for direct unit callers, and add a helper `handleMCPPayload(rawPayload, context)` (or check `id === undefined` at the `/mcp` HTTP layer) so JSON-RPC notifications (`id === undefined`, e.g., `notifications/initialized`) return HTTP `202 Accepted` with empty body, and JSON arrays of requests return an array of responses (filtering out notification responses).
- **Alternative Considered:** Changing `handleMCPRequest()` return shape for `notifications/initialized` directly.
- **Rationale:** `tests/mcp-bridge.test.mjs` explicitly tests `handleMCPRequest({ jsonrpc: "2.0", id: 3, method: "notifications/initialized" })` expecting `{ result: { ok: true } }`. Checking `msg.id === undefined` for HTTP `202` preserves unit test compatibility while conforming to Streamable HTTP.

### 4. Universal Live Propagation Across `sseClients` (`/__live_reload__`) and `datastarClients` (`/events`)
- **Choice:** Extend `injectLiveReload()` in `serve-report.mjs` to listen for three lightweight custom SSE events on `/__live_reload__` alongside `reload`:
  - `mcp-fragment`: `{ selector, html, merge }` — morphs or updates the matched DOM element in place using the `Idiomorph` library already loaded by `injectLiveReload()`, then calls `window.reinitReportContent()` if defined.
  - `mcp-theme`: `{ theme }` — calls `window.setReportTheme(theme)` if defined, or updates `data-theme` and `localStorage.html_report_active_theme`.
  - `mcp-alert`: `{ id, message, type }` — injects a dismissible DaisyUI alert banner at the top of `<main id="report-main">` (or `#agent-reaction-bubble` if present).
  Simultaneously keep `broadcastDatastarFragment()` firing on `datastarClients` so Datastar-only tabs continue receiving updates.
- **Alternative Considered:** Injecting a new `<div id="theme-runtime-hook">` into `template-shell.html` and forcing every report to connect to `/events`.
- **Rationale:** Keeping `template-shell.html` untouched preserves `Assembly` separation and `Published Document` cleanliness (`--published`), while leveraging `/__live_reload__` + `Idiomorph` makes MCP live mutations work immediately on `implementation-progress.html` and every `projects/<slug>/index.html`.

### 5. Real Report State Inspection & Workspace-Bounded `report_build`
- **Choice:**
  - Upgrade `mcpContext` to derive real metadata from `resolvedPath` (and sibling `fragment.html` / `report.manifest.json` if present): `<title>`, `data-report-mode`, `activeReportTheme` (seeded from `<html data-theme="...">` on startup), extracted `<section id>` / `<h1..h3 id>` `Target Element` IDs, and combined `liveReloadClients` + `datastarClients` listener counts.
  - Add `report_build` to `NATIVE_MCP_TOOLS` (bringing total from 5 to 6) and `mcp_allowlist.json` (`report-internal`, `local-dev`). Given `{ fragmentHtml, title, outputPath, mode, theme, published }`, validate `outputPath` with workspace-root containment (defaulting to `resolvedPath`), run `lintFragment()` + `buildReport()` in `<100ms`, optionally persist sibling `fragment.html` if `saveFragment` is explicitly requested or when updating a project, write the `Output Deliverable` atomically, call `broadcastReload()`, and return `{ ok, outputPath, mode, theme, detectedAddons, warnings, lintErrors }`.
- **Alternative Considered:** Omitting `report_build` entirely (5 tools) or adding separate `report_lint`, `report_verify`, `report_scaffold`, `report_compile_theme` tools (10+ tools).
- **Rationale:** One combined `report_build` tool eliminates temp-file + shell-quoting turns in the common build loop while keeping the entire MCP tool list to just 6 lean tools.

### 6. Optional Additive Metadata on `/__agent_status__` & `/api/agent/preflight`
- **Choice:** Add `mcpEndpoint: "/mcp"` to `GET /__agent_status__` and `GET /api/agent/preflight` JSON responses without altering `HTMLReportAgent` (`report-runtime.js`) or `getReconnectPrompt()`.
- **Alternative Considered:** Rewriting `getReconnectPrompt()` to advertise MCP setup instructions.
- **Rationale:** Keeps the Turnkey prompt short and deterministic while letting any bridge-aware client discover `/mcp` automatically.

## Risks / Trade-offs

- **[Risk] Adding `report_build` changes `NATIVE_MCP_TOOLS.length` from 5 to 6** → **Mitigation:** Update `tests/mcp-bridge.test.mjs` (`tools.length === 6`), `skills/html-report/assets/mcp_allowlist.json`, and verify `tests/domain-code-alignment.test.mjs` passes with zero deprecated `UBIQUITOUS_GLOSSARY` terms (`snippet`, `partial`, `bundler`, `artifact file`, etc.).
- **[Risk] `report_build` could write arbitrary HTML paths if `outputPath` is unvalidated** → **Mitigation:** Enforce workspace-root path containment (reusing `isPathInside(workspaceRoot, candidate)`) and `.html` extension check, rejecting traversal with a structured MCP tool error.
- **[Risk] `mcp-fragment` SSE events with `<script>` tags or malformed selectors in `injectLiveReload()`** → **Mitigation:** Guard `document.querySelector(selector)` in `try/catch`, sanitize/escape `mcp-alert` messages server-side with `escapeHtml()`, and reuse Idiomorph's safe `beforeNodeMorphed` callback for `mcp-fragment`.
- **[Risk] Port `3031` is only active when `serve-report.mjs` is running** → **Mitigation:** Documented as an explicit non-goal; CLI scripts and `SKILL.md` remain the zero-config baseline for static/offline workflows.
