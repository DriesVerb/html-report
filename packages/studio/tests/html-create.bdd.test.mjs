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
import { resolveInteractiveAddons, runInteractiveGrill } from "../../../skills/html-report/scripts/html-grill.mjs";
import { PassThrough } from "node:stream";

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
    it("Scenario: Visiting /studio, /html-studio, /create, and /html-create serves the standalone creation studio", async () => {
      for (const route of ["/studio", "/html-studio", "/create", "/html-create"]) {
        const res = await fetchUrl(`${baseUrl}${route}`);
        assert.equal(res.statusCode, 200, `Expected 200 for ${route}`);
        assert.match(res.headers["content-type"], /text\/html/);
        assert.match(res.body, /Setup Wizard/);
      }
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

    it("Scenario: html-grill.mjs normalizes addon aliases, --no-addons, --slug, and --custom-color", async () => {
      const { stdout } = await runCli([
        "--target", "report",
        "--title", "Platform Telemetry",
        "--slug", "platform-telemetry",
        "--custom-color", "#0ea5e9",
        "--addons", "charts,hljs,quill,reveal",
        "--non-interactive",
        "--json"
      ]);

      const data = JSON.parse(stdout);
      assert.equal(data.config.projectSlug, "platform-telemetry");
      assert.equal(data.config.customBrandColorHex, "#0ea5e9");
      assert.deepEqual(data.config.features.addons, ["charts", "highlightjs", "quill", "reveal"]);
      assert.ok(data.cli.buildFlags.includes("--hljs"));
      assert.ok(data.cli.buildFlags.includes("--quill"));
      assert.ok(data.cli.buildFlags.includes("--reveal"));

      const noAddonsRes = await runCli([
        "--target", "report",
        "--no-addons",
        "--non-interactive",
        "--json"
      ]);
      const noAddonsData = JSON.parse(noAddonsRes.stdout);
      assert.deepEqual(noAddonsData.config.features.addons, []);
    });

    it("Scenario: resolveInteractiveAddons supports defaults, none, modifiers, and indices", () => {
      const defaults = ["charts", "mermaid", "gridjs"];
      assert.deepEqual(resolveInteractiveAddons("", defaults), defaults);
      assert.deepEqual(resolveInteractiveAddons("none", defaults), []);
      assert.deepEqual(resolveInteractiveAddons("+quill,-gridjs,+hljs", defaults), ["charts", "mermaid", "quill", "highlightjs"]);
      assert.deepEqual(resolveInteractiveAddons("1,8", defaults), ["charts", "quill"]);
    });

    it("Scenario: Interactive grill prompts reflect Reveal.js v5.1, Datastar SSE, DaisyUI v4.12, and CDN addons", async () => {
      const input = new PassThrough();
      const output = new PassThrough();
      let captured = "";
      const answers = [
        "4",          // Step 1: Presentation (Reveal.js)
        "1",          // Step 2: Static
        "1",          // Step 3: Browser page
        "1",          // Step 4: light theme
        "",           // Step 4b: skip custom brand color
        "2026 Deck",  // Step 5a: title
        "+quill"      // Step 5b: add Quill addon
      ];
      let answerIdx = 0;

      output.on("data", (chunk) => {
        const text = chunk.toString();
        captured += text;
        if (answerIdx < answers.length && text.includes(": ")) {
          const next = answers[answerIdx++];
          setImmediate(() => input.write(next + "\n"));
        }
      });

      const result = await runInteractiveGrill({ input, output, args: [], skipClipboard: true });
      input.end();

      assert.match(captured, /Reveal\.js v5\.1/);
      assert.doesNotMatch(captured, /Interactive 3D Slide Presentation/);
      assert.match(captured, /DaisyUI v4\.12\.14/);
      assert.match(captured, /Datastar v1\.0-beta\.9/);
      assert.match(captured, /Highlight\.js v11\.10/);
      assert.equal(result.config.target, "presentation");
      assert.deepEqual(result.config.features.addons, ["mermaid", "quill"]);
    });
  });

  describe("Requirement: Modular Skill Router Intent Handoff", () => {
    it("Scenario: Slash commands /html-studio and legacy /html-create route to html-studio skill", () => {
      for (const cmd of ["/html-studio", "/html-studio:cli", "/html-create", "/html-create:cli"]) {
        const match = routeSkill(cmd);
        assert.equal(match.skill, "html-studio", `Expected ${cmd} to route to html-studio`);
      }
    });

    it("Scenario: Natural language creation wizard questions route to html-studio skill", () => {
      const match = routeSkill("help me decide what kind of report to build for my team");
      assert.equal(match.skill, "html-studio");
    });
  });
});
