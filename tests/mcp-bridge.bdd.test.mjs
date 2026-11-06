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

describe("Feature Spec: Spec Delta: Two-Way Communication with MCP Server", () => {
  let serverProcess = null;

  before(async () => {
    // 1. Prepare minimal valid HTML report file for dev server
    const dummyHtml = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <title>MCP Integration BDD Report</title>
</head>
<body>
  <div id="theme-runtime-hook"></div>
  <div id="agent-reaction-bubble"></div>
  <div id="kpi-metric" class="stat-value">$1,000,000</div>
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
    if (fs.existsSync(tempHtmlPath)) {
      try { fs.unlinkSync(tempHtmlPath); } catch (_) {}
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
});
