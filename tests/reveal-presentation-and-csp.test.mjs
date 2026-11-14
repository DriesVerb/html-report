import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const buildReportMod = await import(path.resolve(repoRoot, "skills/html-report/scripts/build-report.mjs"));
const { buildReport, buildAgentManifest, parseArgs } = buildReportMod;
const { scaffoldProject } = await import(path.resolve(repoRoot, "skills/html-report/scripts/scaffold-project.mjs"));
const { detectBrowserReadiness } = await import(path.resolve(repoRoot, "skills/html-report/scripts/preflight.mjs"));
const { runHarness } = await import(path.resolve(repoRoot, "skills/html-report/playwright/harness/runner.mjs"));
const { chromium } = await import(path.resolve(repoRoot, "skills/html-report/playwright/node_modules/playwright/index.mjs"));

const tempDirs = [];
function makeTempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

after(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("Reveal.js Presentation, CSP, Preflight & Favicon Fixes", () => {
  it("routes --mode presentation to Reveal.js by default while preserving --impress and #impress", () => {
    const cliDefault = parseArgs(["node", "build-report.mjs", "-c", "frag.html", "--mode", "presentation"]);
    assert.equal(cliDefault.mode, "presentation");
    assert.equal(cliDefault.presentation, true);
    assert.equal(cliDefault.addons.includes("impress"), false);

    const cliLegacy = parseArgs(["node", "build-report.mjs", "-c", "frag.html", "--presentation", "--impress"]);
    assert.ok(cliLegacy.addons.includes("impress"));

    const deckFrag = `
      <main id="report-main" class="container mx-auto px-4 py-8">
        <div id="presentation-shell">
          <div class="reveal-stage"><div class="reveal" id="presentation-deck"><div class="slides">
            <section><div class="slide-body"><h1>Slide 1</h1></div></section>
          </div></div></div>
        </div>
      </main>`;
    const built = buildReport({ title: "Reveal Deck", content: deckFrag, mode: "presentation" });
    assert.ok(built.activeAddons.includes("reveal"));
    assert.equal(built.activeAddons.includes("impress"), false);
    assert.match(built.html, /reveal\.js@5\.1\.0\/dist\/reveal\.css/);
    assert.match(built.html, /reveal\.js@5\.1\.0\/dist\/reveal\.js/);
  });

  it("scaffolds Reveal.js presentation with #presentation-shell, .slide-body, notes, and persists favicon", () => {
    const tmpRoot = makeTempDir("reveal-scaffold-");
    const projectName = `deck-${Date.now()}`;
    const res = scaffoldProject({
      projectName,
      projectsDir: path.join(tmpRoot, "projects"),
      mode: "presentation",
      title: "Alpine Ski Telemetry Deck",
      favicon: "⛷️",
      theme: "dark"
    });

    const frag = fs.readFileSync(res.files.fragment, "utf-8");
    assert.match(frag, /id="presentation-shell"/);
    assert.match(frag, /id="presentation-fullscreen-btn"/);
    assert.match(frag, /id="presentation-notes-btn"/);
    assert.match(frag, /id="presentation-stack-btn"/);
    assert.match(frag, /class="reveal-stage"/);
    assert.match(frag, /class="slide-body/);
    assert.match(frag, /<aside class="notes">/);

    const manifest = JSON.parse(fs.readFileSync(res.files.manifest, "utf-8"));
    assert.equal(manifest.favicon, "⛷️");
    assert.match(fs.readFileSync(res.files.entry, "utf-8"), /⛷️/);

    // Simulate direct buildAgentManifest helper and CLI rebuild preserving favicon
    const m2 = buildAgentManifest({
      title: "Alpine Ski Telemetry Deck",
      content: frag,
      mode: "presentation",
      theme: "dark",
      favicon: "⛷️"
    });
    assert.equal(m2.favicon, "⛷️");
    assert.match(m2.pipeline.rebuildCommand, /--favicon "⛷️"/);
  });

  it("persists --favicon across project rebuilds when invoked via build-report.mjs --project", async () => {
    const projSlug = `test-fav-${Date.now()}`;
    const projDir = path.join(repoRoot, "projects", projSlug);
    tempDirs.push(projDir);
    fs.mkdirSync(projDir, { recursive: true });
    const fragPath = path.join(projDir, "fragment.html");
    const outPath = path.join(projDir, "index.html");
    fs.writeFileSync(fragPath, `<main id="report-main"><h1 id="top">Favicon Persist</h1></main>`, "utf-8");

    const buildScript = path.join(repoRoot, "skills/html-report/scripts/build-report.mjs");
    await execFileAsync(process.execPath, [
      buildScript,
      "--project", projSlug,
      "--title", "Favicon Test",
      "--content", fragPath,
      "--output", outPath,
      "--favicon", "⛷️",
      "--no-ai-dock"
    ], { cwd: repoRoot });

    const manifestAfterFirst = JSON.parse(fs.readFileSync(path.join(projDir, "report.manifest.json"), "utf-8"));
    assert.equal(manifestAfterFirst.favicon, "⛷️");

    // Rebuild passing only --project without --favicon
    await execFileAsync(process.execPath, [
      buildScript,
      "--project", projSlug
    ], { cwd: repoRoot });

    const manifestAfterSecond = JSON.parse(fs.readFileSync(path.join(projDir, "report.manifest.json"), "utf-8"));
    const rebuiltHtml = fs.readFileSync(outPath, "utf-8");
    assert.equal(manifestAfterSecond.favicon, "⛷️");
    assert.ok(rebuiltHtml.includes(encodeURIComponent("⛷️")) || rebuiltHtml.includes("⛷️"));
  });

  it("detects bundled Playwright Chromium from preflight.mjs", async () => {
    const readiness = await detectBrowserReadiness();
    assert.equal(readiness.ready, true);
    assert.equal(readiness.playwrightBundledReady, true);
    assert.equal(readiness.strategy, "playwright-bundled");
    assert.ok(fs.existsSync(readiness.recommendedExecutable));
  });

  it("documents Reveal.js style guide and links it from skills/html-presentation and skills/html-report", () => {
    const styleGuide = fs.readFileSync(
      path.join(repoRoot, "skills/html-report/references/reveal-presentation-style-guide.md"),
      "utf-8"
    );
    const presSkill = fs.readFileSync(path.join(repoRoot, "skills/html-presentation/SKILL.md"), "utf-8");
    const reportSkill = fs.readFileSync(path.join(repoRoot, "skills/html-report/SKILL.md"), "utf-8");

    assert.match(styleGuide, /embedded: true/);
    assert.match(styleGuide, /disableLayout: true/);
    assert.match(styleGuide, /--slide-pad-bottom/);
    assert.match(presSkill, /reveal-presentation-style-guide\.md/);
    assert.doesNotMatch(presSkill, /class="card[^>]*p-10/);
    assert.match(presSkill, /3031/);
    assert.match(reportSkill, /reveal-presentation-style-guide\.md/);
    assert.match(reportSkill, /Reveal\.js/);
  });

  it("does not truncate user goals into ellipsis titles in create.html", async () => {
    const longGoal = "Interactive Executive Revenue & Regional Retention Keynote Across 12 Markets";
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(pathToFileURL(path.join(repoRoot, "create.html")).href, { waitUntil: "domcontentloaded" });
      await page.fill("#input-board-goals", longGoal);
      await page.waitForTimeout(100);
      const heroTitle = await page.textContent("#mockup-hero-title");
      assert.equal(heroTitle.trim(), longGoal);
      assert.doesNotMatch(heroTitle, /\.\.\.$/);
    } finally {
      await browser.close();
    }
  });

  it("verifies Reveal padding, fullscreen reflow, modeless live-sync notes, published mode, and Leaflet marker CSP", async () => {
    const tmpDir = makeTempDir("reveal-browser-");
    const htmlPath = path.join(tmpDir, "deck.html");
    const publishedPath = path.join(tmpDir, "deck-published.html");

    const fragment = `
      <main id="report-main" class="container mx-auto px-4 py-6 space-y-6">
        <section id="presentation-shell" class="space-y-4">
          <div class="presentation-toolbar flex flex-wrap items-center justify-between gap-3">
            <h1 id="deck-title" class="text-2xl font-extrabold">Sky Telemetry Keynote</h1>
            <div class="flex items-center gap-2">
              <button id="presentation-notes-btn" type="button" class="btn btn-outline btn-sm">Notes N</button>
              <button id="presentation-stack-btn" type="button" class="btn btn-outline btn-sm">All Slides</button>
              <button id="presentation-fullscreen-btn" type="button" class="btn btn-primary btn-sm">Present F</button>
            </div>
          </div>
          <div class="reveal-stage">
            <div class="reveal" id="presentation-deck">
              <div class="slides">
                <section>
                  <div class="slide-body justify-center">
                    <h2 id="s1-title" class="text-3xl font-black text-primary">Slide 1 Overview</h2>
                    <p class="text-base text-base-content/80">Clean spacing without p-10 on section.</p>
                  </div>
                  <aside class="notes">
                    <ul><li><strong>First point:</strong> Lead with outcomes.</li></ul>
                  </aside>
                </section>
                <section data-notes="Fallback map note on Slide 2">
                  <div class="slide-body">
                    <h2 id="s2-title" class="text-2xl font-bold">Slide 2 Map &amp; Chart</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div class="h-56 bg-base-200 rounded-xl p-2"><canvas id="deckChart"></canvas></div>
                      <div id="map" class="h-56 rounded-xl overflow-hidden border border-base-300"></div>
                    </div>
                  </div>
                </section>
                <section>
                  <section data-notes="Vertical Top Subslide">
                    <div class="slide-body justify-center">
                      <h2 id="s3-top" class="text-2xl font-bold">Vertical Stack Top</h2>
                    </div>
                  </section>
                  <section data-notes="Vertical Bottom Deep Dive">
                    <div class="slide-body justify-center">
                      <h3 id="s3-sub" class="text-xl font-bold">Vertical Subslide Detail</h3>
                    </div>
                  </section>
                </section>
              </div>
            </div>
          </div>
        </section>
        <script>
          document.addEventListener("DOMContentLoaded", function () {
            if (window.L && document.getElementById("map")) {
              const map = L.map("map").setView([46.5, 7.9], 6);
              L.marker([46.5, 7.9]).addTo(map);
              window.registerLeafletMap && window.registerLeafletMap(map);
            }
            if (window.Chart && document.getElementById("deckChart")) {
              window.reportCharts = window.reportCharts || {};
              window.reportCharts.deckChart = new Chart(document.getElementById("deckChart"), {
                type: "bar",
                data: { labels: ["A", "B"], datasets: [{ label: "Score", data: [42, 78] }] },
                options: { responsive: true, maintainAspectRatio: false }
              });
            }
          });
        </script>
      </main>
    `;

    const draft = buildReport({
      title: "Sky Telemetry Keynote",
      content: fragment,
      mode: "presentation",
      favicon: "⛷️"
    });
    fs.writeFileSync(htmlPath, draft.html, "utf-8");

    const published = buildReport({
      title: "Sky Telemetry Keynote",
      content: fragment,
      mode: "presentation",
      favicon: "⛷️",
      published: true
    });
    fs.writeFileSync(publishedPath, published.html, "utf-8");

    // 1. Run official Playwright harness cdn:reveal check
    const harnessRes = await runHarness(htmlPath, {
      mode: "presentation",
      checkReveal: true,
      quick: true,
      timeout: 20000
    });
    const revealCheck = harnessRes.results.find((r) => r.id === "cdn:reveal");
    assert.ok(revealCheck, "cdn:reveal check must run");
    assert.equal(revealCheck.status, "passed", `cdn:reveal errors: ${(revealCheck.errors || []).join("; ")}`);

    // 2. Verify CSP compliance for default L.marker() + z-index + F/N/vertical sync + published mode
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const cspViolations = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" && /Content Security Policy|CSP|Refused to load the image/i.test(msg.text())) {
          cspViolations.push(msg.text());
        }
      });

      await page.goto(pathToFileURL(publishedPath).href, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => Boolean(document.querySelector(".reveal .slides section.present")), null, { timeout: 8000 });
      await page.waitForTimeout(300);

      // Published build strips authoring edit dock, keeps presentation buttons
      assert.equal(await page.$("#edit-dock"), null);
      assert.ok(await page.$("#presentation-fullscreen-btn"));

      // Leaflet z-index < 50
      const zIdx = await page.evaluate(() => parseInt(getComputedStyle(document.querySelector(".leaflet-container")).zIndex || "0", 10));
      assert.ok(zIdx > 0 && zIdx < 50, `Expected .leaflet-container z-index < 50, got ${zIdx}`);

      // Press N to open modeless Speaker Notes and check Slide 1 sanitized rich notes
      await page.keyboard.press("n");
      await page.waitForTimeout(150);
      const slide1State = await page.evaluate(() => ({
        open: !document.getElementById("presentation-notes-modal").classList.contains("hidden"),
        ariaModal: document.getElementById("presentation-notes-modal").getAttribute("aria-modal"),
        bodyHtml: document.getElementById("presentation-notes-body").innerHTML,
        sanitizedXss: typeof window.sanitizeSpeakerNotesHtml === "function"
          ? window.sanitizeSpeakerNotesHtml('<script>window.__xssProbe=1</script><p onclick="bad()"><strong>Safe</strong></p>')
          : ""
      }));
      assert.equal(slide1State.open, true);
      assert.equal(slide1State.ariaModal, "false");
      assert.match(slide1State.bodyHtml, /<strong>First point:<\/strong>/);
      assert.doesNotMatch(slide1State.sanitizedXss, /<script|onclick/i);
      assert.match(slide1State.sanitizedXss, /<strong>Safe<\/strong>/);

      // Navigate Right to Slide 2 (data-notes fallback + Map/Chart slide)
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(250);
      const slide2Notes = await page.textContent("#presentation-notes-body");
      assert.match(slide2Notes, /Fallback map note on Slide 2/);

      // Navigate Right to Slide 3 vertical stack top, then Down to vertical sub-slide
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(200);
      assert.match(await page.textContent("#presentation-notes-body"), /Vertical Top Subslide/);

      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(200);
      assert.match(await page.textContent("#presentation-notes-body"), /Vertical Bottom Deep Dive/);

      // Press F for fullscreen toggle
      await page.keyboard.press("f");
      await page.waitForTimeout(200);
      const isFs = await page.evaluate(() => {
        const s = document.getElementById("presentation-shell");
        return Boolean(document.fullscreenElement === s || s.classList.contains("is-fullscreen"));
      });
      assert.equal(isFs, true, "Pressing F should activate presentation fullscreen");

      assert.deepEqual(cspViolations, [], `Expected 0 CSP errors for L.marker(): ${cspViolations.join("; ")}`);
    } finally {
      await browser.close();
    }
  });

  it("loads live SSE URLs cleanly in verify-report harness using waitUntil: load", async () => {
    const tmpDir = makeTempDir("reveal-sse-");
    const htmlPath = path.join(tmpDir, "sse-report.html");
    const built = buildReport({
      title: "SSE Live Report",
      content: `<main id="report-main"><h1 id="live-h1">Live Deck</h1></main>`,
      mode: "report"
    });
    fs.writeFileSync(htmlPath, built.html, "utf-8");

    const openStreams = new Set();
    const server = http.createServer((req, res) => {
      if (req.url === "/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        });
        res.write(": connected\n\n");
        openStreams.add(res);
        req.on("close", () => openStreams.delete(res));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(built.html.replace("</body>", `<script>try { new EventSource('/events'); } catch (_) {}</script></body>`));
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    try {
      const res = await runHarness(`http://127.0.0.1:${port}/`, {
        only: "structure",
        timeout: 12000
      });
      assert.equal(res.success, true);
    } finally {
      for (const s of openStreams) {
        try { s.end(); } catch (_) {}
      }
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
