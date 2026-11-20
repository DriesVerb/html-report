/**
 * Task 3.3 Unit & Playwright Integration Tests
 * Studio Fast Assembly & Smart Scaffolding Pipeline + Lucide Icon Fallback
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, execFileSync } from "node:child_process";
import net from "node:net";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");

import {
  DAISYUI_THEMES,
  WIDGET_PRESETS,
  normalizeDomainConfig,
  generateDeterministicPrompt
} from "../../../skills/html-report/scripts/domain-model.mjs";
import {
  scaffoldProject,
  introspectDataFile,
  generateStarterFragment
} from "../../../skills/html-report/scripts/scaffold-project.mjs";
import { startServer } from "../../../skills/html-report/scripts/serve-report.mjs";
import { runLifecycle, lintFragment } from "../../../skills/html-report/scripts/harness.mjs";
import { buildReport } from "../../../skills/html-report/scripts/build-report.mjs";

describe("Studio Fast Assembly & Smart Scaffolding Pipeline", () => {
  let tmpRoot;
  let serverHandle;
  let baseUrl;

  before(async () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "studio-fast-assembly-"));
    // Create a minimal root entry HTML and staged upload file for endpoint tests
    fs.writeFileSync(
      path.join(tmpRoot, "create.html"),
      fs.readFileSync(path.join(REPO_ROOT, "packages/studio/assets/create.html"), "utf8"),
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
    it("introspects CSV headers, sample rows, and pre-computed numeric columnSummaries cleanly", () => {
      const csvPath = path.join(tmpRoot, "projects", "_uploads", "q3-metrics.csv");
      const meta = introspectDataFile(csvPath);
      assert.equal(meta.format, "csv");
      assert.equal(meta.rowCount, 3);
      assert.deepEqual(meta.columns, ["region", "revenue", "growth_pct"]);
      assert.equal(meta.rows.length, 3);
      assert.deepEqual(meta.numericColumns, ["revenue", "growth_pct"]);
      assert.equal(meta.labelColumn, "region");
      assert.deepEqual(meta.columnSummaries.revenue, {
        count: 3,
        sum: 995000,
        avg: 331666.666667,
        min: 265000,
        max: 420000
      });
      assert.deepEqual(meta.columnSummaries.growth_pct, {
        count: 3,
        sum: 54.8,
        avg: 18.266667,
        min: 14.5,
        max: 22.1
      });
    });

    it("introspects JSON arrays of objects into columns, numeric fields, and columnSummaries", () => {
      const jsonPath = path.join(tmpRoot, "projects", "_uploads", "service-health.json");
      const meta = introspectDataFile(jsonPath);
      assert.equal(meta.format, "json");
      assert.equal(meta.rowCount, 2);
      assert.deepEqual(meta.columns, ["service", "p95_ms", "availability"]);
      assert.equal(meta.rows.length, 2);
      assert.ok(meta.numericColumns.includes("p95_ms"));
      assert.deepEqual(meta.columnSummaries.p95_ms, {
        count: 2,
        sum: 120,
        avg: 60,
        min: 42,
        max: 78
      });
    });

    it("scaffold-project.mjs --json stages reference CSV, generates pre-wired fragment + index.html, and prints columnSummaries JSON", () => {
      const scaffoldCli = path.join(REPO_ROOT, "skills/html-report/scripts/scaffold-project.mjs");
      const stdout = execFileSync(
        process.execPath,
        [
          scaffoldCli,
          "--project", "q4-sales",
          "--title", "Q4 Sales Audit",
          "--ref", "projects/_uploads/q3-metrics.csv",
          "--widgets", "kpi-row,chart-pair,grid-table",
          "--json"
        ],
        { cwd: tmpRoot, encoding: "utf8" }
      );
      const payload = JSON.parse(stdout);
      assert.equal(payload.ok, true);
      assert.equal(payload.slug, "q4-sales");
      assert.equal(payload.mode, "report");
      assert.equal(payload.theme, "light");
      assert.deepEqual(payload.widgets, ["kpi-row", "chart-pair", "grid-table"]);
      assert.ok(payload.addons.includes("charts") && payload.addons.includes("gridjs"));
      assert.ok(fs.existsSync(payload.fragmentPath), "fragmentPath must exist on disk");
      assert.ok(fs.existsSync(payload.outputPath), "outputPath (index.html) must exist on disk");
      assert.ok(fs.existsSync(path.join(payload.projectDir, "refs", "q3-metrics.csv")), "staged CSV must exist in refs/");
      assert.equal(payload.datasets.length, 1);
      assert.equal(payload.datasets[0].fileName, "q3-metrics.csv");
      assert.equal(payload.datasets[0].rowCount, 3);
      assert.deepEqual(payload.datasets[0].columnSummaries.revenue, {
        count: 3,
        sum: 995000,
        avg: 331666.666667,
        min: 265000,
        max: 420000
      });

      const reportSkill = fs.readFileSync(path.join(REPO_ROOT, "skills/html-report/SKILL.md"), "utf8");
      const studioSkill = fs.readFileSync(path.join(REPO_ROOT, "skills/html-studio/SKILL.md"), "utf8");
      assert.match(reportSkill, /scaffold-project\.mjs --project .* --ref .* --widgets .* --json/);
      assert.match(studioSkill, /scaffold-project\.mjs --project .* --ref .* --widgets .* --json/);
    });

    it("generateStarterFragment() emits declarative Chart.js and Grid.js wired to introspected dataset columns", () => {
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
      assert.ok(fragment.includes('data-chart-source="#starter-chart-primary-data"'));
      assert.ok(fragment.includes('data-gridjs-source="#starter-grid-data"'));
      assert.ok(fragment.includes('"region"') && fragment.includes('"revenue"'));
      assert.ok(fragment.includes('<div class="mermaid">'));
      assert.ok(fragment.includes('class="timeline'));
    });

    it("generateStarterFragment() averages pct/latency columns in kpi-row and scaffoldProject warns on outside-workspace --ref", () => {
      const outsideCsv = path.join(os.tmpdir(), `outside-ref-${Date.now()}.csv`);
      fs.writeFileSync(outsideCsv, "service,availability_pct,p95_ms\napi,99.90,40\nworker,99.80,60\n", "utf8");
      try {
        const res = scaffoldProject({
          project: "outside-ref-warn",
          title: "Outside Ref Warn",
          referenceFiles: [outsideCsv],
          workspaceRoot: tmpRoot
        });
        assert.equal(res.stagedRefs[0].stagedPath, null);
        assert.equal(res.stagedRefs[0].reason, "outside_workspace");
        assert.ok(Array.isArray(res.warnings) && res.warnings.length === 1);
        assert.match(res.warnings[0], /outside workspaceRoot/);

        const ds = introspectDataFile(outsideCsv);
        const frag = generateStarterFragment({
          slug: "pct-avg-test",
          title: "Pct Avg Test",
          widgets: ["kpi-row"],
          datasets: [ds]
        });
        assert.ok(frag.includes("99.85"), "availability_pct should average to 99.85 instead of summing to 199.70");
        assert.ok(!frag.includes("199.70"));
      } finally {
        if (fs.existsSync(outsideCsv)) fs.unlinkSync(outsideCsv);
      }
    });

    it("generateStarterFragment() emits dedicated print starter with #print-cover-page, table, and sign-off in print mode", () => {
      const frag = generateStarterFragment({
        slug: "print-starter-test",
        title: "Q4 Compliance Print Pack",
        mode: "print"
      });
      assert.ok(frag.includes('id="print-cover-page"'));
      assert.ok(frag.includes('id="print-cover-title"'));
      assert.ok(frag.includes("hidden print:flex"));
      assert.ok(frag.includes("break-after-page"));
      assert.ok(frag.includes("break-inside-avoid"));
      assert.ok(frag.includes('<div class="overflow-x-auto w-full">'));
      assert.ok(frag.includes("<table class=\"table table-zebra table-xs"));
      assert.ok(frag.includes('id="attestation"'));

      const innerOnly = frag.replace(/^<main[^>]*>/i, "").replace(/<\/main>\s*$/i, "");
      const lintRes = lintFragment(innerOnly);
      assert.equal(lintRes.valid, true, `Print starter inner fragment should pass lintFragment cleanly: ${JSON.stringify(lintRes.issues)}`);
    });

    it("stageReferenceFiles rejects symlink escapes outside workspaceRoot and handles camelCase rate KPIs", () => {
      const outsideSecret = path.join(os.tmpdir(), `outside-secret-${Date.now()}.csv`);
      fs.writeFileSync(outsideSecret, "k,v\na,1\n", "utf8");
      const uploadsDir = path.join(tmpRoot, "projects", "_uploads");
      fs.mkdirSync(uploadsDir, { recursive: true });
      const symlinkPath = path.join(uploadsDir, "symlink-escape.csv");
      try {
        fs.symlinkSync(outsideSecret, symlinkPath);
        const res = scaffoldProject({
          project: "symlink-escape-test",
          title: "Symlink Escape Test",
          referenceFiles: ["projects/_uploads/symlink-escape.csv", "/nonexistent/outside-oracle.csv"],
          workspaceRoot: tmpRoot
        });
        assert.equal(res.stagedRefs[0].stagedPath, null);
        assert.equal(res.stagedRefs[0].reason, "outside_workspace");
        assert.equal(res.stagedRefs[1].stagedPath, null);
        assert.equal(res.stagedRefs[1].reason, "outside_workspace");
      } finally {
        if (fs.existsSync(symlinkPath)) fs.unlinkSync(symlinkPath);
        if (fs.existsSync(outsideSecret)) fs.unlinkSync(outsideSecret);
      }

      const rateCsv = path.join(tmpRoot, "projects", "_uploads", "camel-rates.csv");
      fs.writeFileSync(rateCsv, "service,errorRate,cost_usd\napi,1.20,100\nworker,2.50,250\n", "utf8");
      try {
        const ds = introspectDataFile(rateCsv);
        const frag = generateStarterFragment({
          slug: "camel-rate-test",
          title: "Camel Rate Test",
          widgets: ["kpi-row"],
          datasets: [ds]
        });
        assert.ok(frag.includes("1.85"), "errorRate should average to 1.85");
        assert.ok(!frag.includes("3.70"), "errorRate must not sum to 3.70");
      } finally {
        if (fs.existsSync(rateCsv)) fs.unlinkSync(rateCsv);
      }
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

      // Verify pre-wired declarative fragment content
      const fragContent = fs.readFileSync(absFragPath, "utf8");
      assert.ok(fragContent.includes('data-chart-source="#starter-chart-primary-data"'));
      assert.ok(fragContent.includes('data-gridjs-source="#starter-grid-data"'));

      // Second POST with same slug without updateExisting must auto-suffix -2 without overwriting
      const res2 = await fetch(`${baseUrl}/api/create/scaffold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      assert.equal(res2.status, 200);
      const body2 = await res2.json();
      assert.equal(body2.ok, true);
      assert.equal(body2.slug, "exec-q3-board-2");

      // Third POST with updateExisting: true updates exec-q3-board in-place and preserves refs/ and custom fragment edits
      const customMarker = "<!-- CUSTOM_AGENT_FRAGMENT_EDIT -->";
      fs.writeFileSync(absFragPath, `${fragContent}\n${customMarker}\n`, "utf8");
      fs.writeFileSync(path.join(absProjDir, "refs", "extra-notes.md"), "# Keep me\n", "utf8");

      const res3 = await fetch(`${baseUrl}/api/create/scaffold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          theme: "dark",
          userGoals: "Updated executive goals",
          updateExisting: true
        })
      });
      assert.equal(res3.status, 200);
      const body3 = await res3.json();
      assert.equal(body3.ok, true);
      assert.equal(body3.updated, true);
      assert.equal(body3.slug, "exec-q3-board");
      assert.equal(fs.existsSync(path.join(absProjDir, "refs", "extra-notes.md")), true, "Existing refs/ must be preserved");
      assert.ok(fs.readFileSync(absFragPath, "utf8").includes(customMarker), "Customized fragment.html must be preserved on updateExisting");
      const updatedManifest = JSON.parse(fs.readFileSync(absManifestPath, "utf8"));
      assert.equal(updatedManifest.theme, "dark");
      assert.equal(updatedManifest.goals, "Updated executive goals");
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
