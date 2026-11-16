import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { createRequire } from "node:module";
import { AgentInferenceRouter, sanitizeCliError } from "../skills/html-report/scripts/preflight.mjs";
import { serveReport } from "../skills/html-report/scripts/serve-report.mjs";
import { buildReport } from "../skills/html-report/scripts/build-report.mjs";
import { scaffoldProject } from "../skills/html-report/scripts/scaffold-project.mjs";
import { HTMLReportAgent } from "../skills/html-report/assets/report-runtime.js";

const require = createRequire(import.meta.url);
const { chromium } = require("../skills/html-report/playwright/node_modules/playwright");

async function getCsrf(baseUrl) {
  const res = await fetch(`${baseUrl}/api/agent/csrf-token`);
  const data = await res.json();
  return data.csrfToken;
}

describe("Zero-API-Key Agent Bridge, Error Sanitization & Dynamic Persona Sync", () => {
  let tmpDir;
  const savedEnv = {};

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "zero-key-bridge-"));
    for (const key of [
      "HTML_REPORT_AI_CMD",
      "HTML_REPORT_AI_MODE",
      "HTML_REPORT_AI_PROVIDER",
      "HTML_REPORT_DISABLE_AI_CLIS",
      "GEMINI_API_KEY",
      "OPENAI_API_KEY",
      "ANTHROPIC_API_KEY",
      "REPORT_PORT"
    ]) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("Task 1.1 & 1.2: Gemini auth gating & CLI error sanitization", () => {
    it("does not treat bare ~/.gemini directory as authenticated for gemini CLI", () => {
      const bareHome = path.join(tmpDir, "bare-home");
      fs.mkdirSync(path.join(bareHome, ".gemini"), { recursive: true });
      fs.mkdirSync(path.join(bareHome, ".config", "gcloud"), { recursive: true });

      assert.equal(
        AgentInferenceRouter._checkProviderAuthenticated("gemini", { HOME: bareHome }),
        false,
        "Bare ~/.gemini directory without settings auth or API key must return false"
      );

      // Adding explicit settings.json auth turns authentication on
      fs.writeFileSync(
        path.join(bareHome, ".gemini", "settings.json"),
        JSON.stringify({ security: { auth: { selectedType: "oauth-personal" } } }),
        "utf-8"
      );
      assert.equal(
        AgentInferenceRouter._checkProviderAuthenticated("gemini", { HOME: bareHome }),
        true,
        "Explicit ~/.gemini/settings.json auth selection must authenticate gemini"
      );

      // Env var auth also works without settings.json
      const emptyHome = path.join(tmpDir, "empty-home");
      fs.mkdirSync(emptyHome, { recursive: true });
      assert.equal(
        AgentInferenceRouter._checkProviderAuthenticated("gemini", { HOME: emptyHome, GEMINI_API_KEY: "test-key" }),
        true
      );
      assert.equal(
        AgentInferenceRouter._checkProviderAuthenticated("gemini", { HOME: emptyHome, GOOGLE_GENAI_USE_VERTEXAI: "true" }),
        true
      );
    });

    it("refuses to spawn unauthenticated gemini CLI in AgentInferenceRouter.dispatch()", async () => {
      const fakeBinDir = path.join(tmpDir, "bin");
      const bareHome = path.join(tmpDir, "unauth-home");
      const markerFile = path.join(tmpDir, "gemini-was-spawned.txt");
      fs.mkdirSync(fakeBinDir, { recursive: true });
      fs.mkdirSync(path.join(bareHome, ".gemini"), { recursive: true });

      const fakeGemini = path.join(fakeBinDir, "gemini");
      fs.writeFileSync(
        fakeGemini,
        `#!/bin/sh\ntouch "${markerFile}"\necho "EROFS: read-only file system" >&2\nexit 1\n`,
        "utf-8"
      );
      fs.chmodSync(fakeGemini, 0o755);

      const res = await AgentInferenceRouter.dispatch({
        prompt: "Hello",
        provider: "gemini",
        envPath: fakeBinDir,
        env: { HOME: bareHome, PATH: fakeBinDir }
      });

      assert.equal(res.ok, false);
      assert.equal(res.code, "inference_unavailable");
      assert.equal(fs.existsSync(markerFile), false, "Unauthenticated gemini CLI must NOT be spawned");
      assert.match(res.error, /not authenticated/i);
    });

    it("sanitizeCliError strips raw stack traces and maps EROFS / auth / timeout errors concisely", () => {
      const erofsMsg = sanitizeCliError(
        "Error: EROFS: read-only file system, open '/home/eta/.gemini/projects.json.123.tmp'\n    at Object.openSync (node:fs:562:18)\n    at writeTmp (file:///usr/lib/gemini.js:12:4)",
        new Error("Command failed: gemini -p test"),
        "gemini"
      );
      assert.match(erofsMsg, /read-only filesystem \/ EROFS/i);
      assert.match(erofsMsg, /--ai-local/);
      assert.doesNotMatch(erofsMsg, /at Object\.openSync/);

      const authMsg = sanitizeCliError("Please set an Auth method in your ~/.gemini/settings.json", null, "gemini");
      assert.match(authMsg, /not authenticated/i);

      const timeoutMsg = sanitizeCliError("", { message: "timed out", killed: true }, "agy");
      assert.match(timeoutMsg, /timed out/i);
    });

    it("dispatch() returns sanitized EROFS message when custom CLI fails with stack trace", async () => {
      const badCmd = `${process.execPath} -e "console.error('Error: EROFS: read-only file system\\n    at Object.<anonymous> (/tmp/x.js:1:1)'); process.exit(1)"`;
      const res = await AgentInferenceRouter.dispatch({
        prompt: "Test",
        aiCmd: badCmd
      });
      assert.equal(res.ok, false);
      assert.equal(res.code, "inference_unavailable");
      assert.match(res.error, /read-only filesystem \/ EROFS/i);
      assert.doesNotMatch(res.error, /at Object\.<anonymous>/);
      assert.doesNotMatch(res.reason, /at Object\.<anonymous>/);
    });
  });

  describe("Task 1.3: Single-pass prompt assembly (no 3x duplication)", () => {
    it("sends current turn prompt once and keeps prior history distinct", async () => {
      const logFile = path.join(tmpDir, "dispatched-prompts.json");
      const echoScript = path.join(tmpDir, "echo-ai.mjs");
      fs.writeFileSync(
        echoScript,
        `import fs from "node:fs";
const arg = process.argv.slice(2).join(" ");
const logPath = ${JSON.stringify(logFile)};
const existing = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, "utf-8")) : [];
existing.push(arg);
fs.writeFileSync(logPath, JSON.stringify(existing), "utf-8");
process.stdout.write("Acknowledged turn " + existing.length + "\\n");
`,
        "utf-8"
      );

      const reportPath = path.join(tmpDir, "report.html");
      const built = buildReport({
        title: "Prompt Dedupe Test",
        content: `<main id="report-main"><section id="s1"><h1>Overview</h1></section></main>`,
        ai: true
      });
      fs.writeFileSync(reportPath, built.html, "utf-8");

      process.env.HTML_REPORT_AI_CMD = `${process.execPath} ${echoScript}`;
      const srv = await serveReport({ filePath: reportPath, port: 0, autoOpen: false });
      try {
        const baseUrl = `http://127.0.0.1:${srv.serverPort}`;
        const csrfToken = await getCsrf(baseUrl);

        // Turn 1
        const r1 = await fetch(`${baseUrl}/api/agent/prompt`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
          body: JSON.stringify({ sessionId: "dedupe-sess", prompt: "TURN_ONE_MARKER" })
        });
        assert.equal(r1.status, 200);

        // Turn 2
        const r2 = await fetch(`${baseUrl}/api/agent/prompt`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
          body: JSON.stringify({ sessionId: "dedupe-sess", prompt: "TURN_TWO_UNIQUE_MARKER" })
        });
        assert.equal(r2.status, 200);

        const logs = JSON.parse(fs.readFileSync(logFile, "utf-8"));
        assert.equal(logs.length, 2);

        const turn1Count = (logs[0].match(/TURN_ONE_MARKER/g) || []).length;
        assert.equal(turn1Count, 1, "Turn 1 prompt must appear exactly once");

        const turn2Count = (logs[1].match(/TURN_TWO_UNIQUE_MARKER/g) || []).length;
        assert.equal(turn2Count, 1, "Turn 2 prompt must appear exactly once (not 3x)");
        assert.match(logs[1], /User: TURN_ONE_MARKER/, "Prior turn must remain in Conversation History");
      } finally {
        await srv.close();
      }
    });
  });

  describe("Task 2.1 & 2.3: Zero-key --ai-local mode, sibling local-assistant.mjs, strict 503, & port-fallback", () => {
    it("serves zero-key local-bridge responses with --ai-local when all external CLIs are disabled", async () => {
      process.env.HTML_REPORT_DISABLE_AI_CLIS = "all";
      const reportPath = path.join(tmpDir, "local-report.html");
      const built = buildReport({
        title: "Quilting Workshop Local Test",
        content: `<main id="report-main"><section id="cutting"><h1>Cutting Strips</h1><p>Use 6.5 cm strips.</p></section></main>`,
        ai: true,
        aiLocal: true
      });
      assert.match(built.html, /meta name="html-report-ai-mode" content="local"/);
      fs.writeFileSync(reportPath, built.html, "utf-8");

      const srv = await serveReport({ filePath: reportPath, port: 0, autoOpen: false, aiLocal: true });
      try {
        const baseUrl = `http://127.0.0.1:${srv.serverPort}`;
        const preRes = await fetch(`${baseUrl}/api/agent/preflight`);
        const pre = await preRes.json();
        assert.equal(pre.authenticated, true);
        assert.equal(pre.providerAvailable, true);
        assert.equal(pre.activeProvider, "local-bridge");
        assert.equal(pre.localMode, true);
        assert.ok(pre.csrfToken);

        const promptRes = await fetch(`${baseUrl}/api/agent/prompt`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": pre.csrfToken },
          body: JSON.stringify({
            sessionId: "local-sess-1",
            prompt: "How do I cut strips?",
            persona: "analyst",
            context: { elementId: "cutting", activeTheme: "light" }
          })
        });
        assert.equal(promptRes.status, 200);
        const data = await promptRes.json();
        assert.equal(data.ok, true);
        assert.equal(data.provider, "local-bridge");
        assert.match(data.result, /Cutting Strips/);

        // Also verify Datastar SSE streaming + confirm-action under zero-key --ai-local mode
        const sseRes = await fetch(`${baseUrl}/api/agent/prompt`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "X-CSRF-Token": pre.csrfToken
          },
          body: JSON.stringify({
            sessionId: "local-sess-1",
            prompt: "Recalculate cutting width",
            targetSelector: "#cutting",
            persona: "analyst"
          })
        });
        assert.equal(sseRes.status, 200);
        const sseText = await sseRes.text();
        assert.match(sseText, /event: datastar-merge-fragments/);
        assert.match(sseText, /event: message/);
        const msgMatch = sseText.match(/event: message\ndata: ([^\n]+)/);
        assert.ok(msgMatch, "SSE must emit JSON message frame");
        const msgJson = JSON.parse(msgMatch[1]);
        assert.ok(msgJson.action?.id, "Mutating prompt in local-bridge must propose a confirmable action");

        const confirmRes = await fetch(`${baseUrl}/api/agent/confirm-action`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": pre.csrfToken },
          body: JSON.stringify({
            sessionId: "local-sess-1",
            actionId: msgJson.action.id,
            approved: true
          })
        });
        assert.equal(confirmRes.status, 200);
      } finally {
        await srv.close();
      }
    });

    it("auto-detects sibling local-assistant.mjs when HTML_REPORT_AI_CMD is unset", async () => {
      process.env.HTML_REPORT_DISABLE_AI_CLIS = "all";
      const projDir = path.join(tmpDir, "sibling-proj");
      fs.mkdirSync(projDir, { recursive: true });
      fs.writeFileSync(
        path.join(projDir, "local-assistant.mjs"),
        `process.stdout.write("Sibling Local Assistant Reply\\n");\n`,
        "utf-8"
      );
      const reportPath = path.join(projDir, "index.html");
      const built = buildReport({
        title: "Sibling Assistant Test",
        content: `<main id="report-main"><section id="s1"><h1>Hello</h1></section></main>`,
        ai: true
      });
      fs.writeFileSync(reportPath, built.html, "utf-8");

      const srv = await serveReport({ filePath: reportPath, port: 0, autoOpen: false });
      try {
        const baseUrl = `http://127.0.0.1:${srv.serverPort}`;
        const pre = await (await fetch(`${baseUrl}/api/agent/preflight`)).json();
        assert.equal(pre.authenticated, true);
        assert.equal(pre.activeProvider, "custom-cmd");

        const promptRes = await fetch(`${baseUrl}/api/agent/prompt`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": pre.csrfToken },
          body: JSON.stringify({ prompt: "Hello?" })
        });
        assert.equal(promptRes.status, 200);
        const json = await promptRes.json();
        assert.equal(json.result, "Sibling Local Assistant Reply");
      } finally {
        await srv.close();
      }
    });

    it("preserves strict 503 inference_unavailable when local mode and providers are absent", async () => {
      process.env.HTML_REPORT_DISABLE_AI_CLIS = "all";
      const reportPath = path.join(tmpDir, "strict-503.html");
      const built = buildReport({
        title: "Strict 503 Test",
        content: `<main id="report-main"><section id="s1"><h1>Strict</h1></section></main>`,
        ai: true
      });
      fs.writeFileSync(reportPath, built.html, "utf-8");

      const srv = await serveReport({ filePath: reportPath, port: 0, autoOpen: false });
      try {
        const baseUrl = `http://127.0.0.1:${srv.serverPort}`;
        const csrfToken = await getCsrf(baseUrl);
        const res = await fetch(`${baseUrl}/api/agent/prompt`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
          body: JSON.stringify({ prompt: "Test strict 503" })
        });
        assert.equal(res.status, 503);
        const body = await res.json();
        assert.equal(body.code, "inference_unavailable");
      } finally {
        await srv.close();
      }
    });

    it("reports requestedPort and portMismatch in /api/agent/preflight on port collision", async () => {
      const blocker = net.createServer();
      await new Promise((resolve) => blocker.listen(0, resolve));
      const busyPort = blocker.address().port;

      const reportPath = path.join(tmpDir, "port-fallback.html");
      const built = buildReport({
        title: "Port Fallback Test",
        content: `<main id="report-main"><section id="s1"><h1>Port</h1></section></main>`,
        ai: true
      });
      fs.writeFileSync(reportPath, built.html, "utf-8");

      const srv = await serveReport({ filePath: reportPath, port: busyPort, autoOpen: false });
      try {
        assert.notEqual(srv.serverPort, busyPort);
        const pre = await (await fetch(`http://127.0.0.1:${srv.serverPort}/api/agent/preflight`)).json();
        assert.equal(pre.requestedPort, busyPort);
        assert.equal(pre.port, srv.serverPort);
        assert.equal(pre.portMismatch, true);
      } finally {
        await srv.close();
        await new Promise((resolve) => blocker.close(resolve));
      }
    });
  });

  describe("Task 2.2: Dynamic #agent-dock-persona hydration from /api/agent/personas", () => {
    it("hydrates custom personas from personas.json while preserving html-report-ai-persona", async () => {
      const projDir = path.join(tmpDir, "persona-proj");
      fs.mkdirSync(projDir, { recursive: true });
      fs.writeFileSync(
        path.join(projDir, "personas.json"),
        JSON.stringify([
          { id: "analyst", name: "Telemetry Analyst", systemPrompt: "Analyze." },
          { id: "quilting-guide", name: "Quilting Workshop Guide", systemPrompt: "Guide quilting beginners." }
        ]),
        "utf-8"
      );
      const reportPath = path.join(projDir, "index.html");
      const built = buildReport({
        title: "Persona Hydration Test",
        content: `<main id="report-main"><section id="s1"><h1>Quilt</h1></section></main>`,
        ai: true,
        aiPersona: "quilting-guide"
      });
      fs.writeFileSync(reportPath, built.html, "utf-8");

      const srv = await serveReport({ filePath: reportPath, port: 0, autoOpen: false, aiLocal: true });
      const prevDoc = globalThis.document;
      try {
        process.env.REPORT_PORT = String(srv.serverPort);

        // Minimal DOM mock for #agent-dock-persona and <meta name="html-report-ai-persona">
        const options = [{ value: "analyst", textContent: "Analyst" }];
        const personaSel = {
          options,
          value: "analyst",
          dataset: {},
          set innerHTML(v) {
            if (v === "") options.length = 0;
          },
          get firstChild() {
            return options[0] || null;
          },
          appendChild(opt) {
            options.push(opt);
          },
          insertBefore(opt, ref) {
            const idx = options.indexOf(ref);
            if (idx === -1) options.unshift(opt);
            else options.splice(idx, 0, opt);
          },
          addEventListener() {}
        };
        globalThis.document = {
          getElementById(id) {
            return id === "agent-dock-persona" ? personaSel : null;
          },
          createElement(tag) {
            return { tagName: tag.toUpperCase(), value: "", textContent: "" };
          },
          querySelector(sel) {
            if (sel === 'meta[name="html-report-ai-persona"]') {
              return { getAttribute: () => "quilting-guide" };
            }
            if (sel === 'meta[name="html-report-ai-port"]') {
              return { getAttribute: () => String(srv.serverPort) };
            }
            return null;
          }
        };

        const hydrated = await HTMLReportAgent.hydratePersonas({ force: true });
        assert.ok(hydrated.some((p) => p.id === "quilting-guide"));
        assert.ok(options.some((o) => o.value === "quilting-guide" && o.textContent === "Quilting Workshop Guide"));
        assert.equal(personaSel.value, "quilting-guide", "Configured html-report-ai-persona must stay selected");
      } finally {
        globalThis.document = prevDoc;
        await srv.close();
      }
    });
  });

  describe("Task 3.1: Responsive scaffold KPI grid & flag forwarding", () => {
    it("emits responsive CSS grid instead of stats-vertical lg:stats-horizontal and forwards --ai-port/--ai-persona", async () => {
      const wsRoot = path.join(tmpDir, "ws");
      fs.mkdirSync(wsRoot, { recursive: true });
      const res = scaffoldProject({
        project: "kpi-grid-check",
        title: "KPI Grid Check",
        mode: "dashboard",
        widgets: ["kpi-row"],
        ai: true,
        aiPort: 3031,
        aiPersona: "analyst",
        workspaceRoot: wsRoot
      });

      const frag = fs.readFileSync(res.files.fragment, "utf-8");
      assert.match(frag, /grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4/);
      assert.doesNotMatch(frag, /stats-vertical\s+lg:stats-horizontal/);

      const pkg = JSON.parse(fs.readFileSync(res.files.packageJson, "utf-8"));
      assert.match(pkg.scripts.build, /--ai-port 3031/);
      assert.match(pkg.scripts.build, /--ai-persona analyst/);

      // Render a 4-KPI layout in Playwright at sm (640px) and lg (1024px) to verify zero horizontal overflow
      const fourKpiFragment = frag.replace(
        /<\/div>\s*<\/section>/,
        `  <div class="stat bg-base-100 border border-base-300 rounded-box shadow-sm min-w-0">
        <div class="stat-title">Workshop Duration</div>
        <div class="stat-value text-info">180 min</div>
        <div class="stat-desc">Beginner pace</div>
      </div>
    </div>
  </section>`
      );
      const built = buildReport({
        title: "4-KPI Grid Layout Verification",
        content: fourKpiFragment,
        mode: "dashboard"
      });
      const testHtmlPath = path.join(tmpDir, "four-kpi.html");
      fs.writeFileSync(testHtmlPath, built.html, "utf-8");

      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.goto(`file://${testHtmlPath}`, { waitUntil: "domcontentloaded" });
        // Provide deterministic CSS grid layout rules matching Tailwind's sm/xl breakpoints if CDN is offline in sandbox
        await page.addStyleTag({
          content: `
            * { box-sizing: border-box; }
            .grid { display: grid; }
            .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
            .gap-4 { gap: 1rem; }
            .w-full { width: 100%; }
            .min-w-0 { min-width: 0; }
            @media (min-width: 640px) { .sm\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
            @media (min-width: 1280px) { .xl\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
          `
        });
        for (const width of [640, 1024]) {
          await page.setViewportSize({ width, height: 800 });
          const metrics = await page.evaluate(() => {
            const overflowPx = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
            const container = document.querySelector("#kpi-overview .grid");
            const cols = getComputedStyle(container).gridTemplateColumns.split(" ").filter(Boolean).length;
            return { overflowPx, cols };
          });
          assert.equal(metrics.overflowPx, 0, `Viewport ${width}px must have 0px horizontal overflow`);
          assert.equal(metrics.cols, 2, `Viewport ${width}px must render 2 columns cleanly without lg overflow`);
        }
      } finally {
        await browser.close();
      }
    });
  });
});
