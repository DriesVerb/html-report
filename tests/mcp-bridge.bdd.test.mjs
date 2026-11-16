/**
 * @file mcp-bridge.bdd.test.mjs
 * BDD Acceptance Test Suite for Feature 2:
 * Two-Way Communication with Model Context Protocol (MCP) Server & Client Gateway
 */

import test, { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serveScriptPath = path.resolve(__dirname, "../skills/html-report/scripts/serve-report.mjs");
const tempHtmlPath = path.resolve(__dirname, "../dev/bdd-mcp-temp.html");
const tempBuiltHtmlPath = path.resolve(__dirname, "../dev/bdd-mcp-built.html");
const outsideHtmlPath = path.resolve(__dirname, "../../bdd-outside-traversal.html");
const TEST_PORT = 3986;

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(parsed, {
      method: options.method || "GET",
      headers: options.headers || {}
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function listenForSSEEvent(url, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(parsed, {
      method: "GET",
      headers: { Accept: "text/event-stream" }
    }, (res) => {
      let buffer = "";
      const timer = setTimeout(() => {
        req.destroy();
        resolve({ statusCode: res.statusCode, headers: res.headers, buffer });
      }, timeoutMs);

      res.on("data", (chunk) => {
        buffer += chunk.toString();
        if (buffer.includes("\n\n")) {
          clearTimeout(timer);
          req.destroy();
          resolve({ statusCode: res.statusCode, headers: res.headers, buffer });
        }
      });
    });
    req.on("error", (err) => {
      if (req.destroyed) return;
      reject(err);
    });
    req.end();
  });
}

function openSSEStream(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    let buffer = "";
    const req = http.request(parsed, {
      method: "GET",
      headers: { Accept: "text/event-stream" }
    }, (res) => {
      res.on("data", (chunk) => {
        buffer += chunk.toString();
      });
      resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        getBuffer: () => buffer,
        waitFor: async (regex, timeoutMs = 3000) => {
          const start = Date.now();
          while (Date.now() - start < timeoutMs) {
            if (regex.test(buffer)) return buffer;
            await new Promise((r) => setTimeout(r, 25));
          }
          throw new Error(`Timed out waiting for SSE pattern ${regex}. Buffer:\n${buffer}`);
        },
        close: () => {
          try { req.destroy(); } catch (_) {}
        }
      });
    });
    req.on("error", (err) => {
      if (req.destroyed) return;
      reject(err);
    });
    req.end();
  });
}

describe("Feature Spec: Spec Delta: Two-Way Communication with MCP Server", () => {
  let serverProcess = null;

  before(async () => {
    // 1. Prepare minimal valid HTML report file for dev server
    const dummyHtml = `<!DOCTYPE html>
<html lang="en" data-theme="light" data-report-mode="report">
<head>
  <meta charset="UTF-8">
  <title>MCP Integration BDD Report</title>
</head>
<body>
  <main id="report-main">
    <section id="overview-section">
      <h2 id="kpi-summary">KPI Summary</h2>
      <div id="theme-runtime-hook"></div>
      <div id="agent-reaction-bubble"></div>
      <div id="kpi-metric" class="stat-value">$1,000,000</div>
    </section>
  </main>
</body>
</html>`;
    fs.mkdirSync(path.dirname(tempHtmlPath), { recursive: true });
    fs.writeFileSync(tempHtmlPath, dummyHtml, "utf-8");

    // 2. Spawn live dev server
    serverProcess = spawn(process.execPath, [
      serveScriptPath,
      tempHtmlPath,
      "--port",
      String(TEST_PORT),
      "--no-open"
    ], {
      stdio: "pipe"
    });

    // 3. Wait for server to bind port
    let started = false;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await httpRequest(`http://localhost:${TEST_PORT}/`);
        if (res.statusCode === 200) {
          started = true;
          break;
        }
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(started, `Dev server failed to start on port ${TEST_PORT}`);
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
    }
    for (const f of [tempHtmlPath, tempBuiltHtmlPath, outsideHtmlPath]) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch (_) {}
      }
    }
  });

  describe("Requirement: MCP SSE Transport & Endpoint Handshake (GET /mcp/sse)", () => {
    it("Scenario: External agent connects to /mcp/sse and receives session endpoint URI", async () => {
      const sse = await listenForSSEEvent(`http://localhost:${TEST_PORT}/mcp/sse`, 3000);
      assert.equal(sse.statusCode, 200);
      assert.match(sse.headers["content-type"], /text\/event-stream/);
      assert.match(sse.buffer, /event: endpoint/);
      assert.match(sse.buffer, /data: \/mcp\/messages\?sessionId=/);
    });
  });

  describe("Requirement: MCP JSON-RPC 2.0 Message Dispatcher (POST /mcp/messages)", () => {
    it("Scenario: Sending initialize returns protocol version 2024-11-05 and server capabilities", async () => {
      const initReq = JSON.stringify({
        jsonrpc: "2.0",
        id: "msg-1",
        method: "initialize",
        params: {}
      });

      const res = await httpRequest(`http://localhost:${TEST_PORT}/mcp/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: initReq
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.jsonrpc, "2.0");
      assert.equal(data.id, "msg-1");
      assert.equal(data.result.protocolVersion, "2024-11-05");
      assert.equal(data.result.serverInfo.name, "html-report-mcp-server");
      assert.ok(data.result.capabilities.tools);
    });

    it("Scenario: Querying tools/list returns all registered report tools", async () => {
      const listReq = JSON.stringify({
        jsonrpc: "2.0",
        id: "msg-2",
        method: "tools/list",
        params: {}
      });

      const res = await httpRequest(`http://localhost:${TEST_PORT}/mcp/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: listReq
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.jsonrpc, "2.0");
      assert.equal(data.id, "msg-2");
      assert.ok(Array.isArray(data.result.tools));
      const names = data.result.tools.map((t) => t.name);
      assert.ok(names.includes("report_get_state"));
      assert.ok(names.includes("report_update_fragment"));
      assert.ok(names.includes("report_set_theme"));
      assert.ok(names.includes("report_append_alert"));
      assert.ok(names.includes("report_export_pdf"));
    });

    it("Scenario: Calling tools/call report_get_state inspects live report DOM state", async () => {
      const callReq = JSON.stringify({
        jsonrpc: "2.0",
        id: "msg-3",
        method: "tools/call",
        params: {
          name: "report_get_state",
          arguments: {}
        }
      });

      const res = await httpRequest(`http://localhost:${TEST_PORT}/mcp/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: callReq
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.result.isError, false);
      const parsedText = JSON.parse(data.result.content[0].text);
      assert.equal(parsedText.title, "MCP Integration BDD Report");
      assert.equal(parsedText.theme, "light");
    });

    it("Scenario: Calling tools/call report_set_theme synchronizes theme across clients", async () => {
      const themeReq = JSON.stringify({
        jsonrpc: "2.0",
        id: "msg-4",
        method: "tools/call",
        params: {
          name: "report_set_theme",
          arguments: { theme: "corporate" }
        }
      });

      const res = await httpRequest(`http://localhost:${TEST_PORT}/mcp/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: themeReq
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.result.isError, false);
      const parsedText = JSON.parse(data.result.content[0].text);
      assert.equal(parsedText.theme, "corporate");
    });
  });

  describe("Requirement: MCP Client Gateway Proxy with CSRF & Allowlist Guardrails", () => {
    let validCsrfToken = "";

    it("Scenario: Requesting CSRF token from /api/mcp/csrf-token succeeds on localhost", async () => {
      const res = await httpRequest(`http://localhost:${TEST_PORT}/api/mcp/csrf-token`, {
        headers: { Host: `localhost:${TEST_PORT}` }
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.ok, true);
      assert.ok(data.csrfToken);
      assert.ok(data.expiresAt > Date.now());
      validCsrfToken = data.csrfToken;
    });

    it("Scenario: Browser widget invokes authorized tool via POST /api/mcp/call-tool", async () => {
      const payload = JSON.stringify({
        server: "postgres-prod",
        tool: "execute_query",
        args: { sql: "SELECT * FROM metrics;" },
        csrfToken: validCsrfToken
      });

      const res = await httpRequest(`http://localhost:${TEST_PORT}/api/mcp/call-tool`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Host: `localhost:${TEST_PORT}`,
          Origin: `http://localhost:${TEST_PORT}`
        },
        body: payload
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.ok, true);
      assert.equal(data.server, "postgres-prod");
      assert.equal(data.tool, "execute_query");
      assert.ok(data.result.rowCount > 0);
    });

    it("Scenario: Missing or invalid CSRF token returns 401 Unauthorized", async () => {
      const payload = JSON.stringify({
        server: "postgres-prod",
        tool: "execute_query",
        args: {},
        csrfToken: "invalid-token-value"
      });

      const res = await httpRequest(`http://localhost:${TEST_PORT}/api/mcp/call-tool`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Host: `localhost:${TEST_PORT}`
        },
        body: payload
      });

      assert.equal(res.statusCode, 401);
      const data = JSON.parse(res.body);
      assert.equal(data.ok, false);
      assert.match(data.error, /CSRF/);
    });

    it("Scenario: Invoking a tool outside mcp_allowlist.json returns 403 Forbidden", async () => {
      const payload = JSON.stringify({
        server: "postgres-prod",
        tool: "unauthorized_admin_drop",
        args: {},
        csrfToken: validCsrfToken
      });

      const res = await httpRequest(`http://localhost:${TEST_PORT}/api/mcp/call-tool`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Host: `localhost:${TEST_PORT}`
        },
        body: payload
      });

      assert.equal(res.statusCode, 403);
      const data = JSON.parse(res.body);
      assert.equal(data.ok, false);
      assert.match(data.error, /mcp_allowlist\.json/);
    });
  });

  describe("Requirement: Streamable HTTP MCP Endpoint & Localhost Security (POST /mcp)", () => {
    it("Scenario: Modern MCP client initializes and lists 6 tools over POST /mcp without Origin header", async () => {
      const initRes = await httpRequest(`http://localhost:${TEST_PORT}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Host: `localhost:${TEST_PORT}`
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: "s-1", method: "initialize", params: {} })
      });
      assert.equal(initRes.statusCode, 200);
      assert.match(initRes.headers["content-type"], /application\/json/);
      assert.equal(initRes.headers["access-control-allow-origin"], undefined);
      const initData = JSON.parse(initRes.body);
      assert.equal(initData.result.protocolVersion, "2024-11-05");

      const listRes = await httpRequest(`http://localhost:${TEST_PORT}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Host: `[::1]:${TEST_PORT}`
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: "s-2", method: "tools/list", params: {} })
      });
      assert.equal(listRes.statusCode, 200);
      const listData = JSON.parse(listRes.body);
      assert.equal(listData.result.tools.length, 6);
      assert.ok(listData.result.tools.some((t) => t.name === "report_build"));
    });

    it("Scenario: JSON-RPC notification returns 202 Accepted with empty body and batch filters notifications", async () => {
      const notifRes = await httpRequest(`http://localhost:${TEST_PORT}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Host: `localhost:${TEST_PORT}`
        },
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })
      });
      assert.equal(notifRes.statusCode, 202);
      assert.equal(notifRes.body, "");

      const batchRes = await httpRequest(`http://localhost:${TEST_PORT}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Host: `127.0.0.1:${TEST_PORT}`
        },
        body: JSON.stringify([
          { jsonrpc: "2.0", id: "b-1", method: "ping" },
          { jsonrpc: "2.0", method: "notifications/initialized" }
        ])
      });
      assert.equal(batchRes.statusCode, 200);
      const batchData = JSON.parse(batchRes.body);
      assert.equal(batchData.length, 1);
      assert.equal(batchData[0].id, "b-1");

      const getRes = await httpRequest(`http://localhost:${TEST_PORT}/mcp`, {
        method: "GET",
        headers: { Host: `localhost:${TEST_PORT}` }
      });
      assert.equal(getRes.statusCode, 405);
    });

    it("Scenario: Untrusted cross-origin or non-loopback Host requests to /mcp are rejected with 403 Forbidden", async () => {
      const evilOriginRes = await httpRequest(`http://localhost:${TEST_PORT}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Host: `localhost:${TEST_PORT}`,
          Origin: "https://evil.example"
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: "x-1", method: "ping" })
      });
      assert.equal(evilOriginRes.statusCode, 403);

      const evilHostRes = await httpRequest(`http://localhost:${TEST_PORT}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Host: "evil.example:3986"
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: "x-2", method: "ping" })
      });
      assert.equal(evilHostRes.statusCode, 403);

      const localOptionsRes = await httpRequest(`http://localhost:${TEST_PORT}/mcp`, {
        method: "OPTIONS",
        headers: {
          Host: `localhost:${TEST_PORT}`,
          Origin: `http://localhost:${TEST_PORT}`
        }
      });
      assert.equal(localOptionsRes.statusCode, 204);
      assert.equal(localOptionsRes.headers["access-control-allow-origin"], `http://localhost:${TEST_PORT}`);
    });

    it("Scenario: Discovery metadata surfaces mcpEndpoint: '/mcp' on /__agent_status__ and /api/agent/preflight", async () => {
      const statusRes = await httpRequest(`http://localhost:${TEST_PORT}/__agent_status__`);
      assert.equal(statusRes.statusCode, 200);
      assert.equal(JSON.parse(statusRes.body).mcpEndpoint, "/mcp");

      const preflightRes = await httpRequest(`http://localhost:${TEST_PORT}/api/agent/preflight`);
      assert.equal(preflightRes.statusCode, 200);
      assert.equal(JSON.parse(preflightRes.body).mcpEndpoint, "/mcp");
    });
  });

  describe("Requirement: Live Report State Inspection & Universal DOM Propagation", () => {
    it("Scenario: report_get_state returns real Output Deliverable metadata and Target Element IDs", async () => {
      const res = await httpRequest(`http://localhost:${TEST_PORT}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Host: `localhost:${TEST_PORT}`
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "state-1",
          method: "tools/call",
          params: { name: "report_get_state", arguments: {} }
        })
      });
      assert.equal(res.statusCode, 200);
      const state = JSON.parse(JSON.parse(res.body).result.content[0].text);
      assert.equal(state.title, "MCP Integration BDD Report");
      assert.equal(state.mode, "report");
      assert.ok(Array.isArray(state.targetElements));
      assert.ok(state.targetElements.includes("overview-section"));
      assert.ok(state.targetElements.includes("kpi-summary"));
      assert.ok(state.activeCards.includes("overview-section"));
      assert.equal(typeof state.liveReloadClients, "number");
      assert.equal(typeof state.datastarClients, "number");
    });

    it("Scenario: Fragment, theme, and alert updates propagate over /__live_reload__ and served HTML includes handlers", async () => {
      const pageRes = await httpRequest(`http://localhost:${TEST_PORT}/`);
      assert.equal(pageRes.statusCode, 200);
      assert.match(pageRes.body, /es\.addEventListener\("mcp-fragment"/);
      assert.match(pageRes.body, /es\.addEventListener\("mcp-theme"/);
      assert.match(pageRes.body, /es\.addEventListener\("mcp-alert"/);

      const stream = await openSSEStream(`http://localhost:${TEST_PORT}/__live_reload__`);
      try {
        assert.equal(stream.statusCode, 200);
        await new Promise((r) => setTimeout(r, 50));

        await httpRequest(`http://localhost:${TEST_PORT}/mcp`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Host: `localhost:${TEST_PORT}` },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "mut-1",
            method: "tools/call",
            params: {
              name: "report_update_fragment",
              arguments: { selector: "#kpi-metric", html: '<div id="kpi-metric">$2,500,000</div>', mergeMode: "morph" }
            }
          })
        });
        await stream.waitFor(/event: mcp-fragment\ndata: .*kpi-metric/);

        await httpRequest(`http://localhost:${TEST_PORT}/mcp`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Host: `localhost:${TEST_PORT}` },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "mut-2",
            method: "tools/call",
            params: { name: "report_set_theme", arguments: { theme: "synthwave" } }
          })
        });
        await stream.waitFor(/event: mcp-theme\ndata: \{"theme":"synthwave"\}/);

        await httpRequest(`http://localhost:${TEST_PORT}/mcp`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Host: `localhost:${TEST_PORT}` },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "mut-3",
            method: "tools/call",
            params: {
              name: "report_append_alert",
              arguments: { message: "Stream <ok>", type: "success" }
            }
          })
        });
        const buf = await stream.waitFor(/event: mcp-alert\ndata: .*"type":"success"/);
        assert.match(buf, /Stream &lt;ok&gt;/);
      } finally {
        stream.close();
      }
    });
  });

  describe("Requirement: Single-Call Semantic Fragment Assembly Tool (report_build)", () => {
    it("Scenario: Building a valid Semantic Fragment compiles Output Deliverable inside workspace in <100ms", async () => {
      const buildRes = await httpRequest(`http://localhost:${TEST_PORT}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Host: `localhost:${TEST_PORT}`
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "build-1",
          method: "tools/call",
          params: {
            name: "report_build",
            arguments: {
              title: "MCP Built Report",
              outputPath: "dev/bdd-mcp-built.html",
              theme: "corporate",
              fragmentHtml: '<section id="built-sec"><h2 id="built-heading">Built Heading</h2><canvas id="c1"></canvas><script>new Chart(c1, {});</script></section>'
            }
          }
        })
      });
      assert.equal(buildRes.statusCode, 200);
      const rpc = JSON.parse(buildRes.body);
      assert.equal(rpc.result.isError, false);
      const payload = JSON.parse(rpc.result.content[0].text);
      assert.equal(payload.ok, true);
      assert.equal(payload.outputPath, "dev/bdd-mcp-built.html");
      assert.ok(Array.isArray(payload.detectedAddons));
      assert.ok(payload.detectedAddons.includes("charts"));
      assert.ok(Array.isArray(payload.warnings));
      assert.ok(payload.buildTimeMs < 100);
      assert.ok(fs.existsSync(tempBuiltHtmlPath));
      const builtContent = fs.readFileSync(tempBuiltHtmlPath, "utf-8");
      assert.match(builtContent, /<title>MCP Built Report<\/title>/);
      assert.match(builtContent, /data-theme="corporate"/);
    });

    it("Scenario: Rejecting outputPath traversal outside workspace root without writing to disk", async () => {
      const travRes = await httpRequest(`http://localhost:${TEST_PORT}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Host: `localhost:${TEST_PORT}`
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "build-2",
          method: "tools/call",
          params: {
            name: "report_build",
            arguments: {
              title: "Escape Attempt",
              outputPath: "../bdd-outside-traversal.html",
              fragmentHtml: '<section id="x"><h2 id="xh">X</h2></section>'
            }
          }
        })
      });
      assert.equal(travRes.statusCode, 200);
      const rpc = JSON.parse(travRes.body);
      assert.equal(rpc.result.isError, true);
      assert.match(rpc.result.content[0].text, /outside the workspace root/);
      assert.equal(fs.existsSync(outsideHtmlPath), false);
    });
  });
});
