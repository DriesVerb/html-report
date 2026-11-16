/**
 * @file html-create.bdd.test.mjs
 * BDD Specification Suite for Feature 4 & 4.1:
 * Interactive Creation Studio (/html-create) & Terminal Grill Service (/html-create:cli)
 */

import test, { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { routeSkill } from "../../../skills/html-report/scripts/skill-router.mjs";
import { startServer } from "../../../skills/html-report/scripts/serve-report.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fetchUrl(url, options = {}) {
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

function runCli(args = []) {
  return new Promise((resolve, reject) => {
    const script = path.resolve(__dirname, "../../../skills/html-report/scripts/html-grill.mjs");
    execFile(process.execPath, [script, ...args], (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout, stderr });
    });
  });
}

describe("Feature Spec: Feature 4 & 4.1 - Interactive html-create Studio & Terminal Grill", () => {
  let tmpRoot = null;
  let serverHandle = null;
  let baseUrl = "";

  before(async () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "html-create-bdd-"));
    const targetFile = path.join(tmpRoot, "stub.html");
    fs.writeFileSync(targetFile, "<html><body><h1>Stub</h1></body></html>", "utf8");
    serverHandle = await startServer(targetFile, 0, false);
    baseUrl = `http://127.0.0.1:${serverHandle.serverPort}`;
  });

  after(async () => {
    if (serverHandle) await serverHandle.close();
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  describe("Requirement: Live Dev Server Creation Studio Endpoints", () => {
    it("Scenario: Visiting /create and /html-create serves the standalone creation studio", async () => {
      const resCreate = await fetchUrl(`${baseUrl}/create`);
      assert.equal(resCreate.statusCode, 200);
      assert.match(resCreate.headers["content-type"], /text\/html/);
      assert.match(resCreate.body, /Setup Wizard/);

      const resHtmlCreate = await fetchUrl(`${baseUrl}/html-create`);
      assert.equal(resHtmlCreate.statusCode, 200);
      assert.match(resHtmlCreate.headers["content-type"], /text\/html/);
      assert.match(resHtmlCreate.body, /Setup Wizard/);
    });

    it("Scenario: Querying /api/create/config returns canonical themes and target metadata", async () => {
      const res = await fetchUrl(`${baseUrl}/api/create/config`);
      assert.equal(res.statusCode, 200);
      assert.match(res.headers["content-type"], /application\/json/);

      const data = JSON.parse(res.body);
      assert.equal(data.ok, true);
      assert.equal(data.themes.length, 32);
      assert.equal(data.themes[0], "light");
      assert.ok(data.targets.report);
      assert.ok(data.targets.print);
      assert.ok(data.targets.dashboard);
      assert.ok(data.targets.presentation);
    });

    it("Scenario: Submitting configuration to /api/create/synthesize computes prompt and CLI flags", async () => {
      const payload = JSON.stringify({
        target: "print",
        title: "Annual Regulatory Audit",
        theme: "corporate",
        features: {
          addons: ["charts", "gridjs"]
        }
      });

      const res = await fetchUrl(`${baseUrl}/api/create/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.ok, true);
      assert.equal(data.sibling.skillTag, "@html-print");
      assert.equal(data.config.operationalMode, "static");
      assert.ok(data.cli.buildFlags.includes("--mode print"));
      assert.match(data.prompt, /Routing to Specialized Facade: @html-print/);
      assert.match(data.prompt, /Purpose & Format: PRINTABLE DOCUMENT/);
    });
  });

  describe("Requirement: Terminal Interview CLI Service (html-grill.mjs)", () => {
    it("Scenario: Invoking html-grill.mjs with --non-interactive emits deterministic prompt", async () => {
      const { stdout } = await runCli([
        "--target", "dashboard",
        "--title", "Kubernetes Fleet Monitor",
        "--mode", "live",
        "--theme", "synthwave",
        "--non-interactive"
      ]);

      assert.match(stdout, /Routing to Specialized Facade: @html-dashboard/);
      assert.match(stdout, /Purpose & Format: REAL-TIME TELEMETRY DASHBOARD/);
      assert.match(stdout, /Operational Mode: LIVE_CONNECTED/);
      assert.match(stdout, /Startup Theme: "synthwave"/);
      assert.match(stdout, /node skills\/html-report\/scripts\/build-report\.mjs/);
      assert.match(stdout, /--mode dashboard/);
      assert.match(stdout, /--dashboard/);
      assert.match(stdout, /--live/);
    });

    it("Scenario: Invoking html-grill.mjs with --json outputs structured metadata", async () => {
      const { stdout } = await runCli([
        "--target", "presentation",
        "--title", "Q1 Product Keynote",
        "--theme", "luxury",
        "--non-interactive",
        "--json"
      ]);

      const data = JSON.parse(stdout);
      assert.equal(data.sibling.skillTag, "@html-presentation");
      assert.equal(data.config.target, "presentation");
      assert.ok(data.cli.buildFlags.includes("--mode presentation"));
      assert.ok(data.cli.buildFlags.includes("--presentation"));
      assert.match(data.prompt, /Q1 Product Keynote/);
    });
  });

  describe("Requirement: Modular Skill Router Intent Handoff", () => {
    it("Scenario: Slash command /html-create routes to html-create skill", () => {
      const match1 = routeSkill("/html-create");
      assert.equal(match1.skill, "html-create");

      const match2 = routeSkill("/html-create:cli");
      assert.equal(match2.skill, "html-create");
    });

    it("Scenario: Natural language creation wizard questions route to html-create skill", () => {
      const match = routeSkill("help me decide what kind of report to build for my team");
      assert.equal(match.skill, "html-create");
    });
  });
});
