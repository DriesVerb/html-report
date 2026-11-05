import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { HTMLReportAgent } from "../skills/html-report/assets/report-runtime.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
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
    if (postData) {
      req.write(typeof postData === "string" ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

test("Universal Two-Way Agent Bridge Runtime & Server", async (t) => {
  await t.test("HTMLReportAgent module export and offline fallback", async () => {
    assert.ok(HTMLReportAgent, "HTMLReportAgent should be exported");
    assert.equal(typeof HTMLReportAgent.ask, "function", "HTMLReportAgent.ask should be a function");
    assert.equal(typeof HTMLReportAgent.isAvailable, "function", "HTMLReportAgent.isAvailable should be a function");

    // Test offline fallback on unreachable port
    const fallbackRes = await HTMLReportAgent.ask({
      endpoint: "http://127.0.0.1:59999/__unreachable__",
      prompt: "Test query",
      fallbackText: "Custom offline heuristic"
    });

    assert.equal(fallbackRes.ok, false);
    assert.equal(fallbackRes.fallback, true);
    assert.equal(fallbackRes.result, "Custom offline heuristic");
  });

  await t.test("GET /__agent_status__ returns server health and personas", async () => {
    const res = await makeRequest({
      hostname: "127.0.0.1",
      port: 3000,
      path: "/__agent_status__",
      method: "GET"
    });

    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert.equal(data.ok, true);
    assert.ok(data.bridge.includes("agy CLI"));
    assert.ok(Array.isArray(data.personas));
    assert.ok(data.personas.includes("analyst"));
    assert.ok(data.personas.includes("sarcastic"));
  });

  await t.test("POST /__agent_action__ with JSON format returns valid structured response", async () => {
    const res = await makeRequest({
      hostname: "127.0.0.1",
      port: 3000,
      path: "/__agent_action__",
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, {
      prompt: "Calculate 10 + 10",
      action: "query",
      model: "Gemini 3.8 Flash (Low)"
    });

    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert.equal(data.ok, true);
    assert.equal(data.action, "query");
    assert.ok(typeof data.result === "string");
    assert.ok(data.result.length > 0);
  });

  await t.test("POST /__agent_action__ with Datastar format returns SSE hypermedia fragment", async () => {
    const res = await makeRequest({
      hostname: "127.0.0.1",
      port: 3000,
      path: "/__agent_action__",
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, {
      prompt: "System latency is 500ms",
      format: "datastar",
      persona: "analyst",
      targetSelector: "#copilot-test-target"
    });

    assert.equal(res.statusCode, 200);
    assert.ok(res.headers["content-type"].includes("text/event-stream"));
    assert.ok(res.body.includes("event: datastar-merge-fragments"));
    assert.ok(res.body.includes('id="copilot-test-target"'));
  });

  await t.test("POST /api/agent-roast retains backward-compatibility for Pokémon testing", async () => {
    const res = await makeRequest({
      hostname: "127.0.0.1",
      port: 3000,
      path: "/api/agent-roast",
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, {
      name: "Magikarp",
      types: ["Water"],
      persona: "sarcastic"
    });

    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert.equal(data.ok, true);
    assert.ok(typeof data.result === "string" || typeof data.oneliner === "string");
  });

  await t.test("Static file routing falls back to dev/ and experiments/ directories", async () => {
    // 1. Check dev/ fallback
    const devRes = await makeRequest({
      hostname: "127.0.0.1",
      port: 3000,
      path: "/current-feature.html",
      method: "GET"
    });
    assert.equal(devRes.statusCode, 200);
    assert.ok(devRes.body.includes("Live Feature Verification"));

    // 2. Check experiments/ fallback
    const expRes = await makeRequest({
      hostname: "127.0.0.1",
      port: 3000,
      path: "/pokemon-live-report.html",
      method: "GET"
    });
    assert.equal(expRes.statusCode, 200);
    assert.ok(expRes.body.includes("PokéLive"));
  });

  await t.test("Persona Blueprint Registry & Dynamic Registration", async () => {
    // 1. Query registered personas list
    const listRes = await makeRequest({
      hostname: "127.0.0.1",
      port: 3000,
      path: "/api/agent/personas",
      method: "GET"
    });
    assert.equal(listRes.statusCode, 200);
    const listData = JSON.parse(listRes.body);
    assert.equal(listData.ok, true);
    assert.ok(listData.count >= 7);
    assert.ok(listData.personas.some((p) => p.id === "analyst"));
    assert.ok(listData.personas.some((p) => p.id === "debugger"));

    // 2. Dynamically register a new custom persona via Blueprint
    const regRes = await makeRequest({
      hostname: "127.0.0.1",
      port: 3000,
      path: "/api/agent/persona",
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, {
      id: "sre-commander",
      name: "SRE Incident Commander",
      description: "Triage production incidents and error budgets.",
      systemPrompt: "You are a Principal SRE Incident Commander. Formulate immediate containment actions.",
      badgeColor: "badge-warning",
      icon: "alert-triangle",
      formatting: "Return: 1) Triage Step, 2) Containment Directive."
    });

    assert.equal(regRes.statusCode, 200);
    const regData = JSON.parse(regRes.body);
    assert.equal(regData.ok, true);
    assert.equal(regData.registered, "sre-commander");
    assert.equal(regData.persona.badgeColor, "badge-warning");
    assert.equal(regData.persona.icon, "alert-triangle");

    // 3. Verify newly registered persona is returned in /api/agent/personas
    const updatedRes = await makeRequest({
      hostname: "127.0.0.1",
      port: 3000,
      path: "/api/agent/personas",
      method: "GET"
    });
    const updatedData = JSON.parse(updatedRes.body);
    assert.ok(updatedData.personas.some((p) => p.id === "sre-commander"));

    // 4. Test client runtime helper HTMLReportAgent persona methods
    assert.equal(typeof HTMLReportAgent.registerPersona, "function");
    assert.equal(typeof HTMLReportAgent.getPersonas, "function");
    const clientPersonas = await HTMLReportAgent.getPersonas();
    assert.ok(Array.isArray(clientPersonas));
    assert.ok(clientPersonas.length >= 7);
  });
});
