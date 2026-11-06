/**
 * @file mcp-bridge.test.mjs
 * Unit Test Suite for Feature 2: Two-Way Communication with MCP Server
 */

import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_INFO,
  NATIVE_MCP_TOOLS,
  JSON_RPC_ERRORS,
  CSRFManager,
  AllowlistManager,
  handleMCPRequest,
  handleGatewayCallTool,
  formatJsonRpcResult,
  formatJsonRpcError
} from "../skills/html-report/scripts/mcp-server.mjs";

describe("MCP Protocol Handler & Specification Compliance", () => {
  it("should conform to MCP 2024-11-05 protocol version on initialize", async () => {
    const req = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {}
    };

    const res = await handleMCPRequest(req);
    assert.equal(res.jsonrpc, "2.0");
    assert.equal(res.id, 1);
    assert.equal(res.result.protocolVersion, "2024-11-05");
    assert.equal(res.result.serverInfo.name, "html-report-mcp-server");
    assert.ok(res.result.capabilities.tools);
  });

  it("should respond to ping and initialized notifications", async () => {
    const pingRes = await handleMCPRequest({ jsonrpc: "2.0", id: 2, method: "ping" });
    assert.equal(pingRes.jsonrpc, "2.0");
    assert.equal(pingRes.id, 2);
    assert.deepEqual(pingRes.result, {});

    const initNotifRes = await handleMCPRequest({ jsonrpc: "2.0", id: 3, method: "notifications/initialized" });
    assert.equal(initNotifRes.jsonrpc, "2.0");
    assert.equal(initNotifRes.result.ok, true);
  });

  it("should expose all five native MCP tools in tools/list", async () => {
    const req = {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/list",
      params: {}
    };

    const res = await handleMCPRequest(req);
    assert.equal(res.jsonrpc, "2.0");
    assert.equal(res.id, 4);
    assert.equal(res.result.tools.length, 5);

    const toolNames = res.result.tools.map((t) => t.name);
    assert.ok(toolNames.includes("report_get_state"));
    assert.ok(toolNames.includes("report_update_fragment"));
    assert.ok(toolNames.includes("report_set_theme"));
    assert.ok(toolNames.includes("report_append_alert"));
    assert.ok(toolNames.includes("report_export_pdf"));
  });

  it("should return JSON-RPC -32601 for unknown methods", async () => {
    const req = {
      jsonrpc: "2.0",
      id: 99,
      method: "unknown/capability",
      params: {}
    };

    const res = await handleMCPRequest(req);
    assert.equal(res.jsonrpc, "2.0");
    assert.equal(res.id, 99);
    assert.equal(res.error.code, JSON_RPC_ERRORS.METHOD_NOT_FOUND);
    assert.match(res.error.message, /Method not supported/);
  });

  it("should return JSON-RPC -32600 for malformed requests", async () => {
    const res1 = await handleMCPRequest(null);
    assert.equal(res1.error.code, JSON_RPC_ERRORS.INVALID_REQUEST);

    const res2 = await handleMCPRequest({ jsonrpc: "1.0", id: 1, method: "ping" });
    assert.equal(res2.error.code, JSON_RPC_ERRORS.INVALID_REQUEST);
  });
});

describe("Native MCP Tools Execution in Report Context", () => {
  it("should execute report_get_state and return live report summary", async () => {
    const mockContext = {
      getTitle: () => "Q4 Enterprise BI Report",
      getTheme: () => "corporate",
      getClientCount: () => 3,
      getActiveCards: () => ["kpi-sales", "chart-revenue"]
    };

    const req = {
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: {
        name: "report_get_state",
        arguments: {}
      }
    };

    const res = await handleMCPRequest(req, mockContext);
    assert.equal(res.result.isError, false);
    const parsed = JSON.parse(res.result.content[0].text);
    assert.equal(parsed.title, "Q4 Enterprise BI Report");
    assert.equal(parsed.theme, "corporate");
    assert.equal(parsed.tabCount, 3);
    assert.deepEqual(parsed.activeCards, ["kpi-sales", "chart-revenue"]);
  });

  it("should execute report_update_fragment and broadcast Datastar morph", async () => {
    let broadcastPayload = null;
    const mockContext = {
      getClientCount: () => 2,
      broadcastFragment: (frag) => { broadcastPayload = frag; }
    };

    const req = {
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: {
        name: "report_update_fragment",
        arguments: {
          selector: "#kpi-card-arr",
          html: '<div id="kpi-card-arr" class="stat-value text-success">$42.5M</div>',
          mergeMode: "morph"
        }
      }
    };

    const res = await handleMCPRequest(req, mockContext);
    assert.equal(res.result.isError, false);
    assert.deepEqual(broadcastPayload, {
      selector: "#kpi-card-arr",
      html: '<div id="kpi-card-arr" class="stat-value text-success">$42.5M</div>',
      merge: "morph"
    });
    const parsed = JSON.parse(res.result.content[0].text);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.selector, "#kpi-card-arr");
  });

  it("should execute report_set_theme and synchronize across tabs", async () => {
    let activeTheme = "light";
    const mockContext = {
      getClientCount: () => 5,
      setTheme: (t) => { activeTheme = t; }
    };

    const req = {
      jsonrpc: "2.0",
      id: 12,
      method: "tools/call",
      params: {
        name: "report_set_theme",
        arguments: {
          theme: "synthwave"
        }
      }
    };

    const res = await handleMCPRequest(req, mockContext);
    assert.equal(res.result.isError, false);
    assert.equal(activeTheme, "synthwave");
    const parsed = JSON.parse(res.result.content[0].text);
    assert.equal(parsed.theme, "synthwave");
    assert.equal(parsed.synchronizedClients, 5);
  });

  it("should execute report_append_alert and inject banner into report view", async () => {
    let alertData = null;
    const mockContext = {
      appendAlert: (a) => { alertData = a; }
    };

    const req = {
      jsonrpc: "2.0",
      id: 13,
      method: "tools/call",
      params: {
        name: "report_append_alert",
        arguments: {
          message: "Database failover complete. Telemetry normal.",
          type: "success"
        }
      }
    };

    const res = await handleMCPRequest(req, mockContext);
    assert.equal(res.result.isError, false);
    assert.equal(alertData.message, "Database failover complete. Telemetry normal.");
    assert.equal(alertData.type, "success");
  });

  it("should reject invalid arguments with JSON-RPC -32602", async () => {
    const req = {
      jsonrpc: "2.0",
      id: 14,
      method: "tools/call",
      params: {
        name: "report_update_fragment",
        arguments: { selector: "#missing-html" } // missing html
      }
    };

    const res = await handleMCPRequest(req);
    assert.equal(res.error.code, JSON_RPC_ERRORS.INVALID_PARAMS);
    assert.match(res.error.message, /requires 'selector' and 'html'/);
  });
});

describe("Security Boundaries: CSRF, Host & Allowlist Validation", () => {
  it("should generate and validate ephemeral CSRF tokens with TTL", () => {
    const csrf = new CSRFManager(1000); // 1-second TTL
    const { csrfToken, expiresAt } = csrf.generateToken();

    assert.ok(csrfToken.length >= 32);
    assert.ok(expiresAt > Date.now());
    assert.equal(csrf.validateToken(csrfToken), true);
    assert.equal(csrf.validateToken("forged-token-value"), false);
    assert.equal(csrf.validateToken(null), false);
  });

  it("should enforce Host and Origin validation for localhost only", () => {
    assert.equal(CSRFManager.validateHost("localhost:3000"), true);
    assert.equal(CSRFManager.validateHost("127.0.0.1:8080"), true);
    assert.equal(CSRFManager.validateHost("malicious-site.com"), false);
    assert.equal(CSRFManager.validateHost("evil.internal.corp"), false);

    assert.equal(CSRFManager.validateOrigin("http://localhost:3000"), true);
    assert.equal(CSRFManager.validateOrigin("http://127.0.0.1:3000"), true);
    assert.equal(CSRFManager.validateOrigin("null"), true); // file:/// origins
    assert.equal(CSRFManager.validateOrigin(null), true);
    assert.equal(CSRFManager.validateOrigin("https://evil-attacker.com"), false);
  });

  it("should enforce mcp_allowlist.json tool and server gating", () => {
    const allowlist = new AllowlistManager();
    assert.equal(allowlist.isToolAllowed("postgres-prod", "execute_query"), true);
    assert.equal(allowlist.isToolAllowed("local-dev", "report_update_fragment"), true);
    assert.equal(allowlist.isToolAllowed("untrusted-server", "execute_query"), false);
    assert.equal(allowlist.isToolAllowed("postgres-prod", "delete_database"), false);
  });
});

describe("Client Gateway Proxy Execution (handleGatewayCallTool)", () => {
  it("should execute authorized tool call through the gateway proxy", async () => {
    const csrf = new CSRFManager();
    const { csrfToken } = csrf.generateToken();
    const allowlist = new AllowlistManager();

    const payload = {
      server: "postgres-prod",
      tool: "execute_query",
      args: { sql: "SELECT count(*) FROM users;" },
      csrfToken
    };

    const res = await handleGatewayCallTool(payload, {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      csrfManager: csrf,
      allowlistManager: allowlist
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.server, "postgres-prod");
    assert.ok(res.body.result.rows.length > 0);
  });

  it("should reject tool calls with 401 when CSRF token is invalid", async () => {
    const csrf = new CSRFManager();
    const allowlist = new AllowlistManager();

    const payload = {
      server: "postgres-prod",
      tool: "execute_query",
      args: {},
      csrfToken: "bad-csrf-token"
    };

    const res = await handleGatewayCallTool(payload, {
      host: "localhost:3000",
      csrfManager: csrf,
      allowlistManager: allowlist
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.ok, false);
    assert.match(res.body.error, /CSRF/);
  });

  it("should reject tool calls with 403 when tool is not on allowlist", async () => {
    const csrf = new CSRFManager();
    const { csrfToken } = csrf.generateToken();
    const allowlist = new AllowlistManager();

    const payload = {
      server: "postgres-prod",
      tool: "drop_all_tables",
      args: {},
      csrfToken
    };

    const res = await handleGatewayCallTool(payload, {
      host: "localhost:3000",
      csrfManager: csrf,
      allowlistManager: allowlist
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.ok, false);
    assert.match(res.body.error, /mcp_allowlist\.json/);
  });

  it("should reject tool calls with 403 when host header is external", async () => {
    const csrf = new CSRFManager();
    const { csrfToken } = csrf.generateToken();
    const allowlist = new AllowlistManager();

    const payload = {
      server: "postgres-prod",
      tool: "execute_query",
      args: {},
      csrfToken
    };

    const res = await handleGatewayCallTool(payload, {
      host: "evil-domain.com",
      csrfManager: csrf,
      allowlistManager: allowlist
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.ok, false);
    assert.match(res.body.error, /Host must be localhost/);
  });
});
