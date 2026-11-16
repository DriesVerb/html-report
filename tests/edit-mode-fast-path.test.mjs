/**
 * Tests for OpenSpec change: speed-up-edit-mode
 * Covers tasks 1.1 - 3.3 across report-runtime.js, preflight.mjs, serve-report.mjs, and Playwright hot-swap.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const playwrightPath = path.join(REPO_ROOT, "skills/html-report/playwright/node_modules/playwright/index.mjs");
const { chromium } = await import(pathToFileURL(playwrightPath).href);

import { HTMLReportEdit } from "../skills/html-report/assets/report-runtime.js";
import { AgentInferenceRouter } from "../skills/html-report/scripts/preflight.mjs";
import { scaffoldProject } from "../skills/html-report/scripts/scaffold-project.mjs";
import {
  startServer,
  resolveEditTarget,
  extractFragmentContext,
  parseSurgicalPatchPayload,
  applySurgicalFragmentPatches
} from "../skills/html-report/scripts/serve-report.mjs";

describe("speed-up-edit-mode", () => {
  let tmpRoot;
  let serverHandle;
  let baseUrl;
  let mockLlmServer;
  let mockLlmUrl;
  let recordedLlmRequests = [];
  let mockLlmBehavior = "fast-patch-ok";
  let prevAiUrl;
  let prevDisableClis;

  const sampleFragment = [
    '<main id="report-main" class="container mx-auto px-4 py-8 space-y-6">',
    '  <section id="overview" class="card bg-base-100 p-6">',
    '    <h1 id="hero-title" class="text-2xl font-bold">Q4 Revenue</h1>',
    '    <p id="hero-sub" class="text-sm">Old subtitle</p>',
    '  </section>',
    '  <section id="details" class="card bg-base-100 p-6">',
    '    <h2 id="details-heading" class="text-xl font-semibold">Details</h2>',
    '    <p id="details-copy">Unchanged body text.</p>',
    '  </section>',
    '</main>'
  ].join("\n");

  before(async () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "edit-mode-fast-"));
    // Write a root stub (simulating server started on implementation-progress.html / create.html)
    fs.writeFileSync(
      path.join(tmpRoot, "implementation-progress.html"),
      '<!DOCTYPE html><html><head><title>Root Stub</title></head><body><main id="report-main"><h1>Root</h1></main></body></html>',
      "utf-8"
    );

    // Scaffold a project under tmpRoot/projects/edit-demo/
    scaffoldProject({
      project: "edit-demo",
      title: "Edit Demo Report",
      mode: "report",
      theme: "light",
      ai: true,
      aiModel: "gemini-2.5-flash",
      content: sampleFragment,
      rootDir: tmpRoot,
      workspaceRoot: tmpRoot
    });

    // Mock HTTP LLM endpoint for AgentInferenceRouter
    mockLlmServer = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => { raw += c; });
      req.on("end", () => {
        const parsed = raw ? JSON.parse(raw) : {};
        recordedLlmRequests.push(parsed);
        const sys = parsed.messages?.find((m) => m.role === "system")?.content || "";
        const isTier1 = sys.includes("surgical HTML fragment patcher");

        let reply = "Applied changes.";
        if (isTier1) {
          if (mockLlmBehavior === "fast-patch-ok") {
            reply = JSON.stringify({
              patches: [
                {
                  find: '<p id="hero-sub" class="text-sm">Old subtitle</p>',
                  replace: '<p id="hero-sub" class="text-sm">New fast subtitle</p>'
                }
              ]
            });
          } else if (mockLlmBehavior === "lint-regression") {
            reply = JSON.stringify({
              patches: [
                {
                  find: '<p id="details-copy">Unchanged body text.</p>',
                  replace: '<h2>Heading Without ID</h2><p id="details-copy">Changed</p>'
                }
              ]
            });
          } else if (mockLlmBehavior === "bad-json") {
            reply = "Not JSON at all, let CLI handle it.";
          }
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ result: reply }));
      });
    });

    await new Promise((resolve) => mockLlmServer.listen(0, "127.0.0.1", resolve));
    const addr = mockLlmServer.address();
    mockLlmUrl = `http://127.0.0.1:${addr.port}/v1/chat/completions`;

    prevAiUrl = process.env.HTML_REPORT_AI_URL;
    prevDisableClis = process.env.HTML_REPORT_DISABLE_AI_CLIS;
    process.env.HTML_REPORT_AI_URL = mockLlmUrl;
    process.env.HTML_REPORT_DISABLE_AI_CLIS = "all";

    serverHandle = await startServer(
      path.join(tmpRoot, "implementation-progress.html"),
      0,
      false
    );
    baseUrl = `http://127.0.0.1:${serverHandle.serverPort}`;
  });

  after(async () => {
    if (prevAiUrl === undefined) delete process.env.HTML_REPORT_AI_URL;
    else process.env.HTML_REPORT_AI_URL = prevAiUrl;
    if (prevDisableClis === undefined) delete process.env.HTML_REPORT_DISABLE_AI_CLIS;
    else process.env.HTML_REPORT_DISABLE_AI_CLIS = prevDisableClis;

    if (serverHandle) await serverHandle.close();
    if (mockLlmServer) await new Promise((resolve) => mockLlmServer.close(resolve));
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  describe("Task 1.1: Workspace-aware buildEditPrompt() enrichment", () => {
    it("includes Semantic Fragment, Output Deliverable, Manifest, theme, addons, and auto-rebuild guidance when fragment is present", () => {
      const tasks = [
        {
          id: "t1",
          title: "Update subtitle",
          content: "Change subtitle copy",
          priority: 1,
          order: 1,
          done: false,
          target: { id: "hero-sub", tag: "p" },
          anchor: { id: "overview", label: "Q4 Revenue" }
        }
      ];
      const page = {
        title: "Edit Demo Report",
        source: "projects/edit-demo/index.html",
        fragment: "projects/edit-demo/fragment.html",
        manifestPath: "projects/edit-demo/report.manifest.json",
        mode: "report",
        theme: "emerald",
        activeAddons: ["charts", "gridjs"]
      };

      const p1 = HTMLReportEdit.buildEditPrompt(tasks, page);
      const p2 = HTMLReportEdit.buildEditPrompt(tasks, page);
      assert.equal(p1, p2, "Prompt must remain byte-identical");
      assert.match(p1, /Semantic Fragment: projects\/edit-demo\/fragment\.html/);
      assert.match(p1, /Output Deliverable: projects\/edit-demo\/index\.html/);
      assert.match(p1, /Manifest: projects\/edit-demo\/report\.manifest\.json/);
      assert.match(p1, /Theme: emerald/);
      assert.match(p1, /Active addons: charts, gridjs/);
      assert.match(p1, /no manual build-report\.mjs run needed/);
      assert.ok(!p1.includes("agent-authoring-guide.md"), "Project prompt should skip cold-start guide reference");
      assert.ok(!p1.toLowerCase().includes("openspec"));
    });

    it("falls back cleanly to standalone prompt format when no fragment is present", () => {
      const prompt = HTMLReportEdit.buildEditPrompt(
        [{ id: "1", title: "Fix copy", content: "", priority: 1, order: 1, done: false }],
        { title: "Standalone", source: "report.html", mode: "report" }
      );
      assert.match(prompt, /Source: report\.html/);
      assert.match(prompt, /Rebuild with skills\/html-report\/scripts\/build-report\.mjs/);
      assert.ok(!prompt.includes("Semantic Fragment:"));
    });
  });

  describe("Task 2.2: AgentInferenceRouter deduplication guard", () => {
    it("never duplicates identical systemPrompt and prompt", async () => {
      recordedLlmRequests = [];
      const res = await AgentInferenceRouter.dispatch({
        prompt: "Same text payload",
        systemPrompt: "Same text payload",
        model: "gemini-2.5-flash"
      });
      assert.equal(res.ok, true);
      assert.equal(recordedLlmRequests.length, 1);
      const sent = recordedLlmRequests[0];
      assert.equal(sent.model, "gemini-2.5-flash");
      assert.equal(sent.messages.length, 1, "Identical systemPrompt must be suppressed");
      assert.equal(sent.messages[0].role, "user");
      assert.equal(sent.messages[0].content, "Same text payload");
    });
  });

  describe("Task 2.1 & 3.1: Unit helpers for resolution, slicing, and surgical patching", () => {
    it("resolveEditTarget resolves project paths and rejects traversal", () => {
      const rootStub = path.join(tmpRoot, "implementation-progress.html");
      const okRes = resolveEditTarget("/projects/edit-demo/index.html", rootStub, tmpRoot);
      assert.equal(okRes.ok, true);
      assert.equal(okRes.targetRel, "projects/edit-demo/index.html");
      assert.equal(okRes.fragmentRel, "projects/edit-demo/fragment.html");

      const travRes = resolveEditTarget("../../etc/passwd", rootStub, tmpRoot);
      assert.equal(travRes.ok, false);
      assert.equal(travRes.status, 403);
    });

    it("extractFragmentContext extracts exact target slice and section outline", () => {
      const ctx = extractFragmentContext(sampleFragment, { targetIds: ["hero-sub"], anchorIds: ["overview"] });
      assert.ok(ctx.outline.some((o) => o.id === "hero-title"));
      assert.equal(ctx.slices.length, 2);
      assert.match(ctx.slices[0].html, /Old subtitle/);
    });

    it("applySurgicalFragmentPatches rejects lint regressions and invalid boilerplate", () => {
      const badBoiler = applySurgicalFragmentPatches(sampleFragment, [
        { find: '<p id="hero-sub" class="text-sm">Old subtitle</p>', replace: "<body>bad</body>" }
      ]);
      assert.equal(badBoiler.ok, false);

      const badHeading = applySurgicalFragmentPatches(sampleFragment, [
        { find: '<p id="hero-sub" class="text-sm">Old subtitle</p>', replace: "<h3>No ID</h3>" }
      ]);
      assert.equal(badHeading.ok, false);
      assert.match(badHeading.reason, /MISSING_HEADING_ID/);

      const good = applySurgicalFragmentPatches(sampleFragment, [
        { find: '<p id="hero-sub" class="text-sm">Old subtitle</p>', replace: '<p id="hero-sub" class="text-sm">Updated</p>' }
      ]);
      assert.equal(good.ok, true);
      assert.equal(good.patchesApplied, 1);
    });
  });

  describe("Task 1.2, 2.1, 2.2 & 3.1: HTTP /__agent_edit__ fast-patch, fallback, and rebuild source preservation", () => {
    async function getCsrf() {
      const r = await fetch(`${baseUrl}/api/agent/csrf-token`);
      const d = await r.json();
      return d.csrfToken;
    }

    it("rejects path traversal on POST /__agent_edit__ with HTTP 403", async () => {
      const csrfToken = await getCsrf();
      const res = await fetch(`${baseUrl}/__agent_edit__`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ prompt: "Edit something", file: "../../etc/passwd", csrfToken })
      });
      assert.equal(res.status, 403);
    });

    it("applies Tier 1 fast-patch on /projects/edit-demo/index.html, rebuilds index.html, and preserves html-report-source", async () => {
      recordedLlmRequests = [];
      mockLlmBehavior = "fast-patch-ok";
      const csrfToken = await getCsrf();
      const res = await fetch(`${baseUrl}/__agent_edit__`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          prompt: "1. [P1] Update subtitle\n   Target Element: #hero-sub (<p>)\n   Change to New fast subtitle",
          file: "/projects/edit-demo/index.html",
          model: "gemini-2.5-flash",
          targetIds: ["hero-sub"],
          csrfToken
        })
      });
      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.ok, true);
      assert.equal(data.mode, "fast-patch");
      assert.equal(data.patchesApplied, 1);
      assert.equal(data.fragment, "projects/edit-demo/fragment.html");

      // Only 1 LLM call with distinct system + user messages & model forwarded
      assert.equal(recordedLlmRequests.length, 1);
      assert.equal(recordedLlmRequests[0].model, "gemini-2.5-flash");
      assert.equal(recordedLlmRequests[0].messages.length, 2);
      assert.notEqual(recordedLlmRequests[0].messages[0].content, recordedLlmRequests[0].messages[1].content);
      assert.match(recordedLlmRequests[0].messages[1].content, /Slice #hero-sub/);

      // fragment.html & rebuilt index.html updated on disk; source meta preserved
      const updatedFrag = fs.readFileSync(path.join(tmpRoot, "projects/edit-demo/fragment.html"), "utf-8");
      const updatedIndex = fs.readFileSync(path.join(tmpRoot, "projects/edit-demo/index.html"), "utf-8");
      assert.match(updatedFrag, /New fast subtitle/);
      assert.match(updatedIndex, /New fast subtitle/);
      assert.match(updatedIndex, /<meta name="html-report-source" content="projects\/edit-demo\/index\.html"\s*\/>/);
    });

    it("falls back to Tier 2 CLI when Tier 1 patch introduces lint regressions without corrupting fragment.html", async () => {
      recordedLlmRequests = [];
      mockLlmBehavior = "lint-regression";
      const fragPath = path.join(tmpRoot, "projects/edit-demo/fragment.html");
      const beforeFrag = fs.readFileSync(fragPath, "utf-8");

      const csrfToken = await getCsrf();
      const res = await fetch(`${baseUrl}/__agent_edit__`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          prompt: "1. [P1] Update details\n   Target Element: #details-copy (<p>)",
          file: "/projects/edit-demo/index.html",
          targetIds: ["details-copy"],
          csrfToken
        })
      });
      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.ok, true);
      assert.equal(data.mode, "cli");
      assert.match(data.fallbackReason, /MISSING_HEADING_ID/);

      // fragment.html must remain untouched by the rejected Tier 1 patch
      assert.equal(fs.readFileSync(fragPath, "utf-8"), beforeFrag);
      // 2 LLM calls: Tier 1 then Tier 2 (Tier 2 scoped to fragment.html with distinct system prompt)
      assert.equal(recordedLlmRequests.length, 2);
      assert.match(recordedLlmRequests[1].messages[0].content, /projects[\/\\]edit-demo[\/\\]fragment\.html/);
      assert.notEqual(recordedLlmRequests[1].messages[0].content, recordedLlmRequests[1].messages[1].content);
    });
  });

  describe("Task 1.1 & 3.2: Browser Playwright manifest prompting & Idiomorph hot-swap preservation", () => {
    it("reads #agent-manifest in getPageInfo() and preserves hot-swap when #agent-manifest sections change", async () => {
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.goto(`${baseUrl}/projects/edit-demo/index.html`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => Boolean(window.HTMLReportEdit && window.__REPORT_READY__));

        const info = await page.evaluate(() => window.HTMLReportEdit.getPageInfo());
        assert.equal(info.fragment, "projects/edit-demo/fragment.html");
        assert.equal(info.source, "projects/edit-demo/index.html");
        assert.equal(info.manifestPath, "projects/edit-demo/report.manifest.json");
        assert.equal(info.aiModel, "gemini-2.5-flash");

        const generated = await page.evaluate(() => {
          window.HTMLReportEdit.saveTasks([]);
          window.HTMLReportEdit.addTask({
            title: "Refine KPI",
            content: "Tighten copy",
            priority: 1,
            target: { id: "hero-sub", tag: "p" }
          });
          return window.HTMLReportEdit.generatePrompt();
        });
        assert.match(generated, /Semantic Fragment: projects\/edit-demo\/fragment\.html/);
        assert.match(generated, /Target Element: #hero-sub \(<p>\)/);

        // Set a window sentinel to verify Idiomorph hot-swap (no full page reload)
        await page.evaluate(() => { window.__HOT_SWAP_SENTINEL__ = "kept"; });

        // Update fragment.html on disk with a new <section> + heading + inline <script> (which updates #agent-manifest AND <main> scripts!)
        const fragPath = path.join(tmpRoot, "projects/edit-demo/fragment.html");
        const curFrag = fs.readFileSync(fragPath, "utf-8");
        const nextFrag = curFrag.replace(
          "</main>",
          '  <section id="added-live"><h2 id="added-live-heading">Added Live Section</h2><p>Hot swapped!</p><script>window.__INLINE_HOT_RAN__ = "yes";</script></section>\n</main>'
        );
        fs.writeFileSync(fragPath, nextFrag, "utf-8");

        await page.waitForFunction(
          () => Boolean(document.getElementById("added-live-heading")),
          null,
          { timeout: 10000 }
        );

        const afterState = await page.evaluate(() => ({
          sentinel: window.__HOT_SWAP_SENTINEL__ || null,
          inlineRan: window.__INLINE_HOT_RAN__ || null,
          headingText: document.getElementById("added-live-heading")?.textContent,
          manifestSections: window.HTMLReportAgent.getManifest()?.sections?.map((s) => s.id) || []
        }));

        assert.equal(afterState.sentinel, "kept", "Must hot-swap <main> via Idiomorph without full page reload");
        assert.equal(afterState.inlineRan, "yes", "Changed <main> inline script must execute during hot-swap");
        assert.equal(afterState.headingText, "Added Live Section");
        assert.ok(afterState.manifestSections.includes("added-live"), "#agent-manifest must stay synced after hot-swap");
      } finally {
        await browser.close();
      }
    });
  });
});
