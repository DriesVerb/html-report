# Delta Specification: MCP (Model Context Protocol) Server & Client Bridge

**Capability**: `mcp-server-bridge`  
**Parent Change**: `pipeline-four-core-features`  
**Stage**: `Planning`  

---

## 1. Requirement & User Stories

### User Story 2.1: Dev Server as MCP Server
As an autonomous AI agent (e.g. Claude Desktop, Cursor, Antigravity Agent), I want to connect to `serve-report.mjs` via standard Model Context Protocol (MCP) over SSE, so that I can discover the report as a live display target and invoke tools to read DOM state, update cards, and trigger re-renders.

### User Story 2.2: Dev Server as MCP Client Gateway
As a developer designing a report dashboard, I want dashboard widgets to execute configured local MCP tools (e.g. query Postgres MCP, check GitHub MCP issues) through a secure dev server proxy, so that my dashboard displays live enterprise data.

### User Story 2.3: Origin & CSRF Protection
As a security-conscious developer, I want all MCP proxy and server endpoints on `localhost` to enforce strict Host, Origin, and CSRF token validation, preventing malicious external web pages from accessing local system tools.

---

## 2. Technical Contracts

### 2.1 MCP Server Primitives (JSON-RPC 2.0 over SSE)
- Transport: `GET /mcp/sse` (establishes stream and returns message endpoint), `POST /mcp/messages` (transports JSON-RPC 2.0).
- **Tools Exposed**:
  1. `report_get_state`: `params: {}` &rarr; returns `{ theme, activeCards, errors, tabCount }`
  2. `report_update_fragment`: `params: { selector: string, html: string, mergeMode?: string }` &rarr; broadcasts Datastar fragment
  3. `report_set_theme`: `params: { theme: string }` &rarr; syncs theme across all connected clients
  4. `report_export_pdf`: `params: { outputPath?: string }` &rarr; triggers Playwright PDF export

### 2.2 MCP Client Proxy Contract (`POST /api/mcp/call-tool`)
```typescript
interface MCPProxyRequest {
  server: string;
  tool: string;
  args: Record<string, any>;
  csrfToken: string;
}
```

---

## 3. Acceptance Criteria

- [ ] Dev server initiates compliant MCP SSE handshake conforming to the 2024-11-05 MCP specification.
- [ ] External MCP clients can list and execute `report_update_fragment` to morph live DOM elements.
- [ ] Requests missing a valid `csrfToken` or failing Origin checks return HTTP 403 Forbidden.
- [ ] MCP child processes run within a 15-second bounded execution timeout.
