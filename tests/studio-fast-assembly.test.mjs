/**
 * Task 3.3 Unit & Playwright Integration Tests
 * Studio Fast Assembly & Smart Scaffolding Pipeline + Lucide Icon Fallback
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import net from "node:net";
import { pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const playwrightPath = path.join(REPO_ROOT, "skills/html-report/playwright/node_modules/playwright/index.mjs");
const { chromium } = await import(pathToFileURL(playwrightPath).href);

import {
  DAISYUI_THEMES,
  WIDGET_PRESETS,
  normalizeDomainConfig,
  generateDeterministicPrompt
} from "../skills/html-report/scripts/domain-model.mjs";
import {
  scaffoldProject,
  introspectDataFile,
  generateStarterFragment
} from "../skills/html-report/scripts/scaffold-project.mjs";
import { startServer } from "../skills/html-report/scripts/serve-report.mjs";
import { runLifecycle } from "../skills/html-report/scripts/harness.mjs";
import { buildReport } from "../skills/html-report/scripts/build-report.mjs";

describe("Studio Fast Assembly & Smart Scaffolding Pipeline", () => {
  let tmpRoot;
  let serverHandle;
  let baseUrl;

  before(async () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "studio-fast-assembly-"));
    // Create a minimal root entry HTML and staged upload file for endpoint tests
    fs.writeFileSync(
      path.join(tmpRoot, "create.html"),
      fs.readFileSync(path.join(REPO_ROOT, "create.html"), "utf8"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(tmpRoot, "implementation-progress.html"),
      "<html><body><h1>Root Stub</h1></body></html>",
      "utf8"
    );

    const uploadsDir = path.join(tmpRoot, "projects", "_uploads");
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(
      path.join(uploadsDir, "q3-metrics.csv"),
      "region,revenue,growth_pct\nNorth America,420000,14.5\nEMEA,310000,18.2\nAPAC,265000,22.1\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(uploadsDir, "service-health.json"),
      JSON.stringify([
        { service: "auth-api", p95_ms: 42, availability: 99.98 },
        { service: "billing-core", p95_ms: 78, availability: 99.95 }
      ]),
      "utf8"
    );

    serverHandle = await startServer(
      path.join(tmpRoot, "implementation-progress.html"),
      0,
      false
    );
    baseUrl = `http://127.0.0.1:${serverHandle.serverPort}`;
  });

  after(async () => {
    if (serverHandle) {
      await serverHandle.close();
    }
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  describe("Domain Model Alignment & WIDGET_PRESETS", () => {
    it("includes 'lemonade' (not 'lemon') in canonical DAISYUI_THEMES and exposes WIDGET_PRESETS", () => {
      assert.ok(DAISYUI_THEMES.includes("lemonade"), "DAISYUI_THEMES must contain 'lemonade'");
      assert.ok(!DAISYUI_THEMES.includes("lemon"), "DAISYUI_THEMES must not contain 'lemon'");
      for (const key of ["kpi-row", "chart-pair", "grid-table", "mermaid-flow", "timeline"]) {
        assert.ok(WIDGET_PRESETS[key], `WIDGET_PRESETS must define '${key}'`);
      }
      const normalized = normalizeDomainConfig({
        theme: "lemon",
        projectSlug: "Q4 Sales_Deck!",
        widgets: ["kpi-row", "chart-pair", "unknown-widget"]
      });
      assert.equal(normalized.defaultStartupTheme, "lemonade");
      assert.equal(normalized.projectSlug, "q4-sales-deck");
      assert.deepEqual(normalized.widgets, ["kpi-row", "chart-pair"]);

      const prompt = generateDeterministicPrompt({
        theme: "lemon",
        projectSlug: "q4-sales",
        widgets: ["kpi-row", "grid-table"]
      });
      assert.ok(prompt.includes("kpi-row"), "Prompt should list selected widget presets");
      assert.ok(prompt.includes("q4-sales"), "Prompt should reference projectSlug");
    });

    it("GET /api/create/config returns WIDGET_PRESETS and aligned themes", async () => {
      const res = await fetch(`${baseUrl}/api/create/config`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.ok(data.themes.includes("lemonade"));
      assert.ok(!data.themes.includes("lemon"));
      assert.ok(Array.isArray(data.capabilities) && data.capabilities.includes("scaffold"));
      assert.ok(data.widgets && data.widgets["kpi-row"]);
      assert.ok(data.widgets["chart-pair"]);
    });
  });

  describe("Zero-Dependency CSV/JSON Introspection & Widget Starters", () => {
    it("introspects CSV headers and sample rows cleanly", () => {
      const csvPath = path.join(tmpRoot, "projects", "_uploads", "q3-metrics.csv");
      const meta = introspectDataFile(csvPath);
      assert.equal(meta.format, "csv");
      assert.deepEqual(meta.columns, ["region", "revenue", "growth_pct"]);
      assert.equal(meta.rows.length, 3);
      assert.deepEqual(meta.numericColumns, ["revenue", "growth_pct"]);
      assert.equal(meta.labelColumn, "region");
    });

    it("introspects JSON arrays of objects into columns and numeric fields", () => {
      const jsonPath = path.join(tmpRoot, "projects", "_uploads", "service-health.json");
      const meta = introspectDataFile(jsonPath);
      assert.equal(meta.format, "json");
      assert.deepEqual(meta.columns, ["service", "p95_ms", "availability"]);
      assert.equal(meta.rows.length, 2);
      assert.ok(meta.numericColumns.includes("p95_ms"));
    });

    it("generateStarterFragment() emits Chart.js and Grid.js wired to introspected dataset columns", () => {
      const csvPath = path.join(tmpRoot, "projects", "_uploads", "q3-metrics.csv");
      const dataset = introspectDataFile(csvPath);
      const fragment = generateStarterFragment({
        slug: "starter-widget-test",
        title: "Starter Widget Test",
        mode: "report",
        widgets: ["kpi-row", "chart-pair", "grid-table", "mermaid-flow", "timeline"],
        datasets: [dataset]
      });
      assert.ok(fragment.includes('id="kpi-overview"'));
      assert.ok(fragment.includes("new Chart("));
      assert.ok(fragment.includes("new gridjs.Grid("));
      assert.ok(fragment.includes('"region"') && fragment.includes('"revenue"'));
      assert.ok(fragment.includes('<div class="mermaid">'));
      assert.ok(fragment.includes('class="timeline'));
    });
  });

  describe("POST /api/create/scaffold & Collision + Reference Staging", () => {
    it("scaffolds project via API with collision suffix (-2), reference staging, and Chart/Grid pre-wiring", async () => {
      const payload = {
        projectSlug: "exec-q3-board",
        title: "Exec Q3 Board",
        target: "report",
        theme: "corporate",
        widgets: ["kpi-row", "chart-pair", "grid-table"],
        referenceFiles: [
          { name: "q3-metrics.csv", savedName: "q3-metrics.csv", size: 92 },
          { name: "service-health.json", savedName: "service-health.json", size: 120 }
        ]
      };

      const res1 = await fetch(`${baseUrl}/api/create/scaffold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      assert.equal(res1.status, 200);
      const body1 = await res1.json();
      assert.equal(body1.ok, true);
      assert.equal(body1.slug, "exec-q3-board");
      assert.equal(body1.entryUrl, "/projects/exec-q3-board/index.html");
      const absProjDir = path.join(tmpRoot, body1.projectDir);
      const absFragPath = path.join(tmpRoot, body1.fragmentPath);
      const absManifestPath = path.join(tmpRoot, body1.manifestPath);
      assert.ok(fs.existsSync(absFragPath));
      assert.ok(fs.existsSync(absManifestPath));
      assert.ok(fs.existsSync(path.join(absProjDir, "index.html")));
      assert.ok(fs.existsSync(path.join(absProjDir, "refs", "q3-metrics.csv")));
      assert.equal(body1.stagedRefs.length, 2);
      assert.equal(body1.datasets.length, 2);

      // Verify pre-wired fragment content
      const fragContent = fs.readFileSync(absFragPath, "utf8");
      assert.ok(fragContent.includes("new Chart("));
      assert.ok(fragContent.includes("new gridjs.Grid("));

      // Second POST with same slug must auto-suffix -2 without overwriting
      const res2 = await fetch(`${baseUrl}/api/create/scaffold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      assert.equal(res2.status, 200);
      const body2 = await res2.json();
      assert.equal(body2.ok, true);
      assert.equal(body2.slug, "exec-q3-board-2");
    });
  });

  describe("Live Fragment Auto-Rebuild Watcher in serve-report.mjs", () => {
    it("automatically runs buildReport() on fragment.html save and updates sibling index.html", async () => {
      const watchDir = fs.mkdtempSync(path.join(os.tmpdir(), "fragment-watch-"));
      try {
        const fragPath = path.join(watchDir, "fragment.html");
        const manifestPath = path.join(watchDir, "report.manifest.json");
        const outPath = path.join(watchDir, "index.html");
        const initialFragHtml = '<section id="sec-1"><h2 id="h-1">Initial Heading</h2><p>Before save.</p></section>';
        fs.writeFileSync(fragPath, initialFragHtml, "utf8");
        fs.writeFileSync(
          manifestPath,
          JSON.stringify({ title: "Watch Build Test", theme: "light", mode: "report" }),
          "utf8"
        );
        const builtWatch = buildReport({
          content: initialFragHtml,
          contentPath: fragPath,
          title: "Watch Build Test",
          theme: "light"
        });
        fs.writeFileSync(outPath, builtWatch.html, "utf8");

        const watchServer = await startServer(outPath, 0, false);
        try {
          // Listen to SSE live-reload stream
          const abortCtrl = new AbortController();
          const sseRes = await fetch(`http://127.0.0.1:${watchServer.serverPort}/__live_reload__`, {
            signal: abortCtrl.signal
          });
          const reader = sseRes.body.getReader();
          const decoder = new TextDecoder();

          // Modify fragment.html and wait for watcher rebuild + SSE event
          const marker = `LIVE_WATCH_MARKER_${Date.now()}`;
          fs.writeFileSync(
            fragPath,
            `<section id="sec-1"><h2 id="h-1">Updated Heading</h2><p>${marker}</p></section>`,
            "utf8"
          );

          const deadline = Date.now() + 5000;
          let rebuilt = false;
          let sseReceived = false;
          let pendingRead = reader.read();
          while (Date.now() < deadline && (!rebuilt || !sseReceived)) {
            const currentHtml = fs.readFileSync(outPath, "utf8");
            if (currentHtml.includes(marker)) rebuilt = true;
            const raceResult = await Promise.race([
              pendingRead.then((res) => ({ kind: "read", res })),
              new Promise((resolve) => setTimeout(() => resolve({ kind: "timeout" }), 120))
            ]);
            if (raceResult.kind === "read") {
              if (raceResult.res?.value) {
                const text = decoder.decode(raceResult.res.value);
                if (text.includes("reload") || text.includes("content_update")) {
                  sseReceived = true;
                }
              }
              if (!raceResult.res?.done && !sseReceived) {
                pendingRead = reader.read();
              }
            }
          }
          abortCtrl.abort();
          assert.equal(rebuilt, true, "Saving fragment.html must trigger buildReport() into sibling index.html");
          assert.equal(sseReceived, true, "Watcher rebuild must notify SSE live-reload clients");
        } finally {
          await watchServer.close();
        }
      } finally {
        fs.rmSync(watchDir, { recursive: true, force: true });
      }
    });
  });

  describe("harness.mjs --fast Static-Only Verification", () => {
    it("runs lintFragment() + buildReport() without Playwright in sub-second time and honors sibling report.manifest.json", async () => {
      const scaffolded = scaffoldProject({
        project: "fast-verify-target",
        title: "Fast Verify Title",
        mode: "report",
        theme: "corporate",
        widgets: ["kpi-row"],
        rootDir: path.join(tmpRoot, "projects")
      });

      const report = await runLifecycle({
        file: scaffolded.files.fragment,
        fast: true
      });

      assert.equal(report.fast, true);
      assert.equal(report.success, true, `Expected --fast to succeed, error: ${JSON.stringify(report.error)}`);
      assert.equal(report.output, path.join(scaffolded.projectDir, "index.html"));
      assert.ok(fs.existsSync(report.output));
      assert.equal(report.server, null);
      const visitedStates = (report.history || []).map((h) => (typeof h === "string" ? h : h.to || h.state));
      assert.ok(!visitedStates.includes("VERIFYING"), "Fast mode must skip Playwright VERIFYING stage");
      assert.ok(report.durationMs < 2000, `Expected --fast under 2000ms, got ${report.durationMs}ms`);
    });
  });

  describe("Playwright E2E: Studio Fast Assembly & Lucide Icon Resilience", () => {
    it("supports #input-project-slug, #widget-presets-selector, #btn-scaffold-now, preflight-gated #btn-send-to-agent, and renders Lucide SVGs even when jsDelivr fails", async () => {
      const browser = await chromium.launch({ headless: true });
      try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();

        // Simulate intermittent/blocked primary jsDelivr Lucide CDN to verify fallback mirror resilience
        await page.route("https://cdn.jsdelivr.net/npm/lucide@*/**", (route) => route.abort());

        // Intercept /api/agent/preflight and /api/agent/prompt to verify bridge gating & dispatch deterministically
        let preflightMode = "offline";
        let capturedAgentPrompt = null;
        let capturedCsrfHeader = null;
        await page.route("**/api/agent/preflight*", async (route) => {
          if (preflightMode === "offline") {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ ok: true, secureBridge: false, providerAvailable: false, authenticated: false, activeProviderName: "" })
            });
          } else if (preflightMode === "unauthenticated") {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                ok: true,
                secureBridge: false,
                streamConnected: true,
                streamListeners: 1,
                providerAvailable: true,
                authenticated: false,
                inferenceVerified: false,
                activeProvider: "gemini",
                activeProviderName: "Gemini CLI"
              })
            });
          } else {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                ok: true,
                bridgeReachable: true,
                secureBridge: true,
                providerAvailable: true,
                authenticated: true,
                activeProvider: "gemini-cli",
                activeProviderName: "Gemini CLI"
              })
            });
          }
        });
        await page.route("**/api/agent/prompt", async (route) => {
          capturedCsrfHeader = route.request().headers()["x-csrf-token"] || null;
          capturedAgentPrompt = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ ok: true, sessionId: "test-sess-1", response: "Queued build." })
          });
        });

        await page.goto(`${baseUrl}/create`, { waitUntil: "load" });

        // 0. Verify initial project lifecycle state & user-facing button label
        const initialBadge = await page.textContent("#workspace-state-badge");
        assert.ok(initialBadge.includes("Draft"), `Expected initial Draft state badge, got: ${initialBadge}`);
        const scaffoldBtnText = await page.textContent("#btn-scaffold-now");
        assert.ok(scaffoldBtnText.includes("Create Workspace"), `Expected Create Workspace label, got: ${scaffoldBtnText}`);

        // 1. Verify Lucide icons STILL rendered into SVG via fallback CDN despite primary CDN abort
        await page.waitForFunction(() => document.querySelectorAll("svg.lucide").length > 10, null, { timeout: 10000 });
        const iconStats = await page.evaluate(() => ({
          svgCount: document.querySelectorAll("svg.lucide").length,
          unrenderedCount: document.querySelectorAll(":not(svg)[data-lucide]").length
        }));
        assert.ok(iconStats.svgCount > 10, `Expected Lucide SVGs via fallback CDN, found ${iconStats.svgCount}`);
        assert.equal(iconStats.unrenderedCount, 0, "Expected zero unrendered :not(svg)[data-lucide] placeholders");

        // 2. Verify #btn-send-to-agent is HIDDEN when preflight reports bridge unavailable
        const visibleInitially = await page.isVisible("#btn-send-to-agent");
        assert.equal(visibleInitially, false, "#btn-send-to-agent must be hidden when no secure bridge is active");

        // 2b. Even if streamConnected=true and CLI installed, unauthenticated/insecure bridge keeps #btn-send-to-agent HIDDEN
        preflightMode = "unauthenticated";
        await page.evaluate(() => window.checkAgentBridgePreflight());
        await page.waitForTimeout(100);
        const visibleWhenUnauth = await page.isVisible("#btn-send-to-agent");
        assert.equal(visibleWhenUnauth, false, "#btn-send-to-agent must stay hidden when bridge is unauthenticated/insecure");

        // 3. Switch preflight to secure+authenticated online and re-run preflight check -> button reveals and enables
        preflightMode = "online";
        await page.evaluate(() => window.checkAgentBridgePreflight());
        await page.waitForFunction(() => {
          const btn = document.getElementById("btn-send-to-agent");
          return btn && !btn.classList.contains("hidden") && !btn.disabled;
        });

        // 4. Fill #input-project-slug & toggle a widget preset
        await page.fill("#input-project-slug", "pw-fast-demo");
        await page.check(".widget-preset-chk[data-widget='timeline']");
        await page.uncheck(".widget-preset-chk[data-widget='kpi-row']");

        // 5. Click #btn-scaffold-now -> reveals #scaffold-result-banner with generated files and updates lifecycle badge
        await page.click("#btn-scaffold-now");
        await page.waitForFunction(() => {
          const banner = document.getElementById("scaffold-result-banner");
          return banner && !banner.classList.contains("hidden");
        });
        const createdBadge = await page.textContent("#workspace-state-badge");
        assert.ok(createdBadge.includes("Workspace Created"), `Expected Workspace Created badge, got: ${createdBadge}`);
        const bannerText = await page.textContent("#scaffold-result-banner");
        assert.ok(bannerText.includes("pw-fast-demo"), `Banner should show slug pw-fast-demo, got: ${bannerText}`);
        assert.ok(fs.existsSync(path.join(tmpRoot, "projects", "pw-fast-demo", "fragment.html")));
        const pwFrag = fs.readFileSync(path.join(tmpRoot, "projects", "pw-fast-demo", "fragment.html"), "utf8");
        assert.ok(pwFrag.includes("timeline"), "Scaffolded fragment should include checked timeline preset");
        assert.ok(!pwFrag.includes('id="kpi-overview"'), "Unchecked kpi-row preset should be omitted");

        // 6. Click #btn-send-to-agent -> posts prompt payload with CSRF token to /api/agent/prompt and updates lifecycle badge
        await page.click("#btn-send-to-agent");
        await page.waitForFunction(() => {
          const s = document.getElementById("agent-bridge-dispatch-status");
          return s && s.textContent && s.textContent.includes("Dispatched");
        });
        const dispatchedBadge = await page.textContent("#workspace-state-badge");
        assert.ok(dispatchedBadge.includes("Sent to Agent"), `Expected Sent to Agent badge, got: ${dispatchedBadge}`);
        assert.ok(capturedCsrfHeader && capturedCsrfHeader.length >= 32, "X-CSRF-Token header must be sent to /api/agent/prompt");
        assert.ok(capturedAgentPrompt && capturedAgentPrompt.prompt, "Prompt payload must be sent to /api/agent/prompt");
        assert.equal(capturedAgentPrompt.csrfToken, capturedCsrfHeader);
        assert.equal(capturedAgentPrompt.context.projectSlug, "pw-fast-demo");

        // 6b. Non-JSON 404 from /api/create/scaffold must show clean plain-English error (no JSON parse crash)
        await page.route("**/api/create/scaffold", async (route) => {
          await route.fulfill({
            status: 404,
            contentType: "text/plain",
            body: "404 Not Found: /api/create/scaffold"
          });
        });
        await page.click("#btn-scaffold-now");
        await page.waitForFunction(() => {
          const errBanner = document.getElementById("scaffold-error-banner");
          return errBanner && !errBanner.classList.contains("hidden");
        });
        const errMsg = await page.textContent("#scaffold-error-message");
        assert.ok(!errMsg.includes("Unexpected non-whitespace character"), `Must not show raw JSON parse error: ${errMsg}`);
        assert.ok(errMsg.includes("404"), `Expected clear 404 guidance, got: ${errMsg}`);
        const errorBadge = await page.textContent("#workspace-state-badge");
        assert.ok(errorBadge.includes("Workspace Not Created"), `Expected Workspace Not Created badge, got: ${errorBadge}`);
        await page.unroute("**/api/create/scaffold");

        // 7. Build a report with Lucide icon markup and verify fallback mirror renders SVG icons inside built reports too
        const iconFragPath = path.join(tmpRoot, "projects", "pw-fast-demo", "fragment.html");
        const iconReportPath = path.join(tmpRoot, "projects", "pw-fast-demo", "index.html");
        const updatedFrag = pwFrag.replace(
          "</main>",
          `\n  <section id="icon-check"><h2 id="icon-h">Icons</h2><p><i data-lucide="activity" class="w-4 h-4"></i></p></section>\n</main>`
        );
        fs.writeFileSync(iconFragPath, updatedFrag, "utf8");
        const builtIcons = buildReport({ content: updatedFrag, contentPath: iconFragPath, title: "Icon Report Test" });
        fs.writeFileSync(iconReportPath, builtIcons.html, "utf8");
        await page.goto(`${baseUrl}/projects/pw-fast-demo/index.html`, { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelectorAll("svg.lucide").length > 0, null, { timeout: 10000 });
        const reportIcons = await page.evaluate(() => document.querySelectorAll("svg.lucide").length);
        assert.ok(reportIcons > 0, "Built report must also render Lucide SVG icons via fallback mirror if jsDelivr fails");
      } finally {
        await browser.close();
      }
    });
  });

  describe("Supervised Server Auto-Restart Lifecycle", () => {
    it("supports supervised mode and restarts cleanly on POST /api/server/restart", async () => {
      const freePort = await new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.listen(0, "127.0.0.1", () => {
          const addr = srv.address();
          srv.close(() => resolve(addr.port));
        });
        srv.on("error", reject);
      });

      const serveScript = path.join(REPO_ROOT, "skills/html-report/scripts/serve-report.mjs");
      const targetHtml = path.join(tmpRoot, "implementation-progress.html");
      const cleanEnv = { ...process.env };
      delete cleanEnv.NODE_ENV;
      delete cleanEnv.HTML_REPORT_SUPERVISED;
      delete cleanEnv.HTML_REPORT_NO_SELF_WATCH;
      cleanEnv.HTML_REPORT_NO_OPEN = "1";

      const proc = spawn(process.execPath, [serveScript, targetHtml, "--port", String(freePort), "--no-open"], {
        env: cleanEnv,
        stdio: "pipe"
      });

      try {
        let initialConfig = null;
        for (let i = 0; i < 40; i++) {
          try {
            const res = await fetch(`http://127.0.0.1:${freePort}/api/create/config`);
            if (res.ok) {
              initialConfig = await res.json();
              break;
            }
          } catch (_) {}
          await new Promise((r) => setTimeout(r, 100));
        }
        assert.ok(initialConfig && initialConfig.ok, "Supervised server should boot and respond");
        assert.equal(initialConfig.supervised, true, "Server should report supervised: true");
        assert.ok(initialConfig.capabilities.includes("self-restart"), "Server should advertise self-restart capability");

        const restartRes = await fetch(`http://127.0.0.1:${freePort}/api/server/restart`, { method: "POST" });
        assert.equal(restartRes.status, 202);
        const restartBody = await restartRes.json();
        assert.equal(restartBody.ok, true);
        assert.equal(restartBody.restarting, true);

        await new Promise((r) => setTimeout(r, 400));
        let recoveredConfig = null;
        for (let i = 0; i < 40; i++) {
          try {
            const res = await fetch(`http://127.0.0.1:${freePort}/api/create/config`);
            if (res.ok) {
              recoveredConfig = await res.json();
              break;
            }
          } catch (_) {}
          await new Promise((r) => setTimeout(r, 100));
        }
        assert.ok(recoveredConfig && recoveredConfig.ok, "Supervised server should automatically come back online on the same port");
      } finally {
        try { proc.kill("SIGTERM"); } catch (_) {}
        await new Promise((resolve) => {
          const t = setTimeout(() => {
            try { proc.kill("SIGKILL"); } catch (_) {}
            resolve();
          }, 1500);
          proc.once("exit", () => {
            clearTimeout(t);
            resolve();
          });
        });
      }
    });
  });

  describe("Two-Way Agent Bridge Security Guardrails", () => {
    it("enforces local Origin, Host, and CSRF tokens on /api/agent/prompt, /api/create/scaffold, and /api/agent/csrf-token", async () => {
      // 1. GET /api/agent/csrf-token issues ephemeral token on localhost without wildcard CORS
      const csrfRes = await fetch(`${baseUrl}/api/agent/csrf-token`, {
        headers: { Origin: baseUrl }
      });
      assert.equal(csrfRes.status, 200);
      assert.equal(csrfRes.headers.get("access-control-allow-origin"), baseUrl);
      const csrfJson = await csrfRes.json();
      assert.equal(csrfJson.ok, true);
      assert.ok(csrfJson.csrfToken && csrfJson.csrfToken.length >= 32);

      // 2. Cross-origin & null-origin requests are rejected with 403
      const evilCsrfRes = await fetch(`${baseUrl}/api/agent/csrf-token`, {
        headers: { Origin: "https://evil.example.com" }
      });
      assert.equal(evilCsrfRes.status, 403);

      const evilPromptRes = await fetch(`${baseUrl}/api/agent/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://evil.example.com" },
        body: JSON.stringify({ prompt: "hi" })
      });
      assert.equal(evilPromptRes.status, 403);

      const nullOriginScaffoldRes = await fetch(`${baseUrl}/api/create/scaffold`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "null" },
        body: JSON.stringify({ projectSlug: "csrf-test" })
      });
      assert.equal(nullOriginScaffoldRes.status, 403);

      // 3. Browser-originated POST without valid CSRF token returns 401
      const missingCsrfPromptRes = await fetch(`${baseUrl}/api/agent/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify({ prompt: "hi", heuristic: true })
      });
      assert.equal(missingCsrfPromptRes.status, 401);

      const badCsrfScaffoldRes = await fetch(`${baseUrl}/api/create/scaffold`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl, "X-CSRF-Token": "forged-token" },
        body: JSON.stringify({ projectSlug: "csrf-bad" })
      });
      assert.equal(badCsrfScaffoldRes.status, 401);

      // 4. Valid local Origin + valid CSRF token succeeds
      const validPromptRes = await fetch(`${baseUrl}/api/agent/prompt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: baseUrl,
          "X-CSRF-Token": csrfJson.csrfToken
        },
        body: JSON.stringify({ prompt: "Status check", heuristic: true, stream: false })
      });
      assert.equal(validPromptRes.status, 200);
      const validPromptJson = await validPromptRes.json();
      assert.equal(validPromptJson.ok, true);
    });
  });
});
