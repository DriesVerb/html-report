import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");

const { buildReport } = await import(path.resolve(REPO_ROOT, "skills/html-report/scripts/build-report.mjs"));
const {
  crc32,
  createZipBuffer,
  discoverReportAssets,
  inlineCdnAssets,
  injectAssetResilience,
  publishProject
} = await import(path.resolve(REPO_ROOT, "skills/html-report/scripts/publish-report.mjs"));
const { startServer } = await import(path.resolve(REPO_ROOT, "skills/html-report/scripts/serve-report.mjs"));
const playwrightPath = path.resolve(REPO_ROOT, "packages/core/playwright/node_modules/playwright/index.mjs");
const { chromium } = await import(pathToFileURL(playwrightPath).href);

// Minimal 1x1 PNG buffer for local image asset testing
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64"
);

/**
 * Lightweight pure-Node ZIP parser for roundtrip verification of createZipBuffer output.
 */
function parseZipEntries(zipBuf) {
  let eocdOffset = -1;
  for (let i = zipBuf.length - 22; i >= 0; i--) {
    if (zipBuf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  assert.ok(eocdOffset >= 0, "ZIP must contain End of Central Directory record");
  const totalEntries = zipBuf.readUInt16LE(eocdOffset + 10);
  const cdOffset = zipBuf.readUInt32LE(eocdOffset + 16);

  const entries = [];
  let ptr = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    assert.equal(zipBuf.readUInt32LE(ptr), 0x02014b50, "Central directory entry signature mismatch");
    const method = zipBuf.readUInt16LE(ptr + 10);
    const expectedCrc = zipBuf.readUInt32LE(ptr + 16);
    const compSize = zipBuf.readUInt32LE(ptr + 20);
    const uncompSize = zipBuf.readUInt32LE(ptr + 24);
    const nameLen = zipBuf.readUInt16LE(ptr + 28);
    const extraLen = zipBuf.readUInt16LE(ptr + 30);
    const commentLen = zipBuf.readUInt16LE(ptr + 32);
    const localOffset = zipBuf.readUInt32LE(ptr + 42);
    const name = zipBuf.subarray(ptr + 46, ptr + 46 + nameLen).toString("utf8");

    assert.equal(zipBuf.readUInt32LE(localOffset), 0x04034b50, "Local header signature mismatch");
    const lNameLen = zipBuf.readUInt16LE(localOffset + 26);
    const lExtraLen = zipBuf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const compData = zipBuf.subarray(dataStart, dataStart + compSize);
    const rawData = method === 8 ? zlib.inflateRawSync(compData) : compData;

    assert.equal(rawData.length, uncompSize, `Size mismatch for ${name}`);
    assert.equal(crc32(rawData), expectedCrc, `CRC32 mismatch for ${name}`);
    entries.push({ name, data: rawData, method });

    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

describe("Published Export Fidelity & Asset-Aware Bundle Pipeline", () => {
  const tempDirs = [];
  const servers = [];

  function makeTempDir(prefix = "html-report-pub-test-") {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(async () => {
    while (servers.length > 0) {
      const s = servers.pop();
      await new Promise((resolve) => {
        try {
          if (typeof s.shutdown === "function") s.shutdown();
          else if (typeof s.close === "function") s.close();
        } catch (_) {}
        setTimeout(resolve, 20);
      });
    }
    while (tempDirs.length > 0) {
      fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
    }
  });

  it("1. createZipBuffer produces deterministic, valid PKZIP archives verified by Node inflate & unzip", () => {
    const entries = [
      { name: "refs/photo.png", data: TINY_PNG },
      { name: "index.html", data: "<!DOCTYPE html><html><body>Hello Zip</body></html>" },
      { name: "refs/notes.md", data: "# Notes\nLine 1\nLine 2\n" }
    ];

    const buf1 = createZipBuffer(entries);
    const buf2 = createZipBuffer([...entries].reverse());
    assert.equal(Buffer.compare(buf1, buf2), 0, "createZipBuffer must be deterministic regardless of input order");

    const parsed = parseZipEntries(buf1);
    assert.deepEqual(
      parsed.map((e) => e.name),
      ["index.html", "refs/notes.md", "refs/photo.png"]
    );
    assert.equal(parsed[0].data.toString("utf8"), "<!DOCTYPE html><html><body>Hello Zip</body></html>");
    assert.equal(Buffer.compare(parsed[2].data, TINY_PNG), 0);

    // Also test with system unzip -t if available
    const tmp = makeTempDir();
    const zipPath = path.join(tmp, "bundle.zip");
    fs.writeFileSync(zipPath, buf1);
    try {
      execFileSync("unzip", ["-t", zipPath], { stdio: "pipe" });
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  });

  it("2. publishProject emits a single deterministic HTML for asset-free projects without recovery chrome", async () => {
    const tmp = makeTempDir();
    const projDir = path.join(tmp, "clean-proj");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(
      path.join(projDir, "report.manifest.json"),
      JSON.stringify({ project: "clean-proj", title: "Clean Asset-Free Report", mode: "report", theme: "light" }),
      "utf-8"
    );
    fs.writeFileSync(
      path.join(projDir, "fragment.html"),
      `<main id="report-main"><section id="intro"><h1>Clean Report</h1><p>No local assets here.</p></section></main>`,
      "utf-8"
    );

    const resA = await publishProject({ projectDir: projDir, writeOutput: true });
    const resB = await publishProject({ projectDir: projDir, writeOutput: false });

    assert.equal(resA.kind, "html");
    assert.equal(resA.isAssetBased, false);
    assert.equal(resA.filename, "clean-proj-published.html");
    assert.ok(fs.existsSync(resA.outputPath));
    assert.equal(Buffer.compare(resA.buffer, resB.buffer), 0, "asset-free publish must be byte-deterministic");
    assert.match(resA.html, /<meta name="html-report-published" content="true"/);
    assert.ok(!resA.html.includes("__html_report_asset_recovery__"), "asset-free export must not inject recovery script");
    assert.ok(!resA.html.includes("__html_report_embedded_assets__"), "asset-free export must not inject embedded assets");
    assert.ok(!resA.html.includes('id="settings-publish-toggle"'), "authoring publish toggle must be stripped");
  });

  it("3. publishProject packages projects/quilt-101 as quilt-101-published.zip preserving index.html + refs/", async () => {
    const tmp = makeTempDir();
    const outZip = path.join(tmp, "quilt-101-published.zip");
    const res = await publishProject({
      project: "quilt-101",
      outputPath: outZip,
      workspaceRoot: REPO_ROOT
    });

    assert.equal(res.kind, "zip");
    assert.equal(res.isAssetBased, true);
    assert.equal(res.filename, "quilt-101-published.zip");
    assert.equal(res.missingReferences.length, 0);

    const parsed = parseZipEntries(fs.readFileSync(outZip));
    const names = parsed.map((e) => e.name);
    assert.ok(names.includes("index.html"));
    assert.ok(names.includes("refs/DOC-20260118-WA0001..pdf"));
    assert.ok(names.includes("refs/quil2.jpeg"));
    assert.ok(names.includes("refs/quilt.jpeg"));

    const indexHtml = parsed.find((e) => e.name === "index.html").data.toString("utf8");
    assert.match(indexHtml, /data-asset-bundle="true"/);
    assert.match(indexHtml, /id="__html_report_asset_recovery__"/);
    assert.ok(!indexHtml.includes('id="agent-dock-container"'));
  });

  it("4. inlineCdnAssets preserves type='module' (Datastar) and moves [defer] classic scripts to end of <body>", async () => {
    const sampleHtml = [
      "<!DOCTYPE html><html><head>",
      '<script type="module" src="https://cdn.example.com/datastar.js"></script>',
      '<script defer src="https://cdn.example.com/alpine.js"></script>',
      "</head><body><div x-data='demo'>Hi</div></body></html>"
    ].join("\n");

    const mockFetch = async (url) => ({
      ok: true,
      text: async () => (url.includes("datastar") ? "export const ds = 1;" : "window.__alpine = true;")
    });

    const inlined = await inlineCdnAssets(sampleHtml, { fetchFn: mockFetch });
    assert.match(inlined, /<script data-inlined-src="https:\/\/cdn\.example\.com\/datastar\.js" type="module">/);
    assert.match(inlined, /export const ds = 1;/);

    const bodyIdx = inlined.indexOf("<div x-data='demo'>");
    const alpineIdx = inlined.indexOf("window.__alpine = true;");
    assert.ok(alpineIdx > bodyIdx, "deferred classic script must be relocated after body content");
    assert.ok(inlined.indexOf("</head>") < alpineIdx, "deferred classic script must not remain in <head>");
  });

  it("5. serve-report.mjs /api/publish serves .html for asset-free and .zip for projects/quilt-101", async () => {
    const tmp = makeTempDir();
    const assetFreeHtml = buildReport({
      title: "Asset Free Live",
      content: "<main><section id='s1'><h2>Hello</h2></section></main>",
      theme: "light"
    }).html;
    const freeEntry = path.join(tmp, "index.html");
    fs.writeFileSync(freeEntry, assetFreeHtml, "utf-8");

    // 5a. Asset-free server
    const srvFree = await startServer({ filePath: freeEntry, port: 0, autoOpen: false });
    servers.push(srvFree);
    const freePort = srvFree.server.address().port;
    const freeRes = await fetch(`http://127.0.0.1:${freePort}/api/publish`);
    assert.equal(freeRes.status, 200);
    assert.match(freeRes.headers.get("content-type"), /text\/html/);
    assert.match(freeRes.headers.get("content-disposition"), /-published\.html"/);
    const freeBody = await freeRes.text();
    assert.match(freeBody, /<meta name="html-report-published" content="true"/);

    // 5b. Asset-based server pointing at projects/quilt-101/index.html
    const quiltEntry = path.join(REPO_ROOT, "projects/quilt-101/index.html");
    const srvQuilt = await startServer({ filePath: quiltEntry, port: 0, autoOpen: false });
    servers.push(srvQuilt);
    const quiltPort = srvQuilt.server.address().port;

    const zipRes = await fetch(`http://127.0.0.1:${quiltPort}/api/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: "cupcake" })
    });
    assert.equal(zipRes.status, 200);
    assert.equal(zipRes.headers.get("content-type"), "application/zip");
    assert.match(zipRes.headers.get("content-disposition"), /quilt-101-published\.zip"/);
    const zipBuf = Buffer.from(await zipRes.arrayBuffer());
    const entries = parseZipEntries(zipBuf);
    assert.ok(entries.some((e) => e.name === "index.html"));
    assert.ok(entries.some((e) => e.name === "refs/quilt.jpeg"));
  });

  it("6. Playwright E2E: buildInlinedHtmlSnapshot() preserves Datastar ES module, Alpine x-for, Grid.js, Mermaid Enlarge, clean UI & offline status", async () => {
    const tmp = makeTempDir();
    // Spin up a local mock CDN server for Datastar (ESM), Alpine (defer), Grid.js (defer), Mermaid (defer)
    const mockCdnServer = http.createServer((req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (req.url === "/datastar.js") {
        res.writeHead(200, { "Content-Type": "text/javascript" });
        res.end(`export const version = "1.0"; window.__datastarModuleLoaded = true;`);
        return;
      }
      if (req.url === "/alpine.js") {
        res.writeHead(200, { "Content-Type": "text/javascript" });
        res.end(`
          if (!document.body) { throw new Error("Trying to load Alpine before <body> is available"); }
          window.Alpine = {
            start() {
              window.__alpineStartCount = (window.__alpineStartCount || 0) + 1;
              document.querySelectorAll("template[x-for]").forEach((tpl) => {
                const parent = tpl.parentElement;
                tpl._x_lookup = {};
                ["Item A", "Item B"].forEach((label, idx) => {
                  const li = document.createElement("li");
                  li.textContent = label;
                  li._x_dataStack = [{ label }];
                  tpl._x_lookup[idx] = li;
                  parent.appendChild(li);
                });
              });
              document.querySelectorAll("[x-data]").forEach((el) => {
                el.setAttribute("data-alpine-hydrated", "true");
              });
            }
          };
          window.Alpine.start();
        `);
        return;
      }
      if (req.url === "/gridjs.js") {
        res.writeHead(200, { "Content-Type": "text/javascript" });
        res.end(`
          window.gridjs = {
            Grid: function(cfg) {
              return {
                render(el) {
                  if (el.childNodes.length > 0) {
                    throw new Error("The container element is not empty");
                  }
                  const c = document.createElement("div");
                  c.className = "gridjs-container";
                  c.textContent = "GridRows:" + cfg.data.length;
                  el.appendChild(c);
                }
              };
            }
          };
        `);
        return;
      }
      if (req.url === "/mermaid.js") {
        res.writeHead(200, { "Content-Type": "text/javascript" });
        res.end(`
          window.mermaid = {
            initialize() {},
            async run() {
              document.querySelectorAll(".mermaid").forEach((n) => {
                if (!n.dataset.mermaidSource) n.dataset.mermaidSource = n.textContent;
                n.setAttribute("data-processed", "true");
                n.innerHTML = '<svg viewBox="0 0 100 40"><rect width="100" height="40"></rect></svg>';
              });
            }
          };
        `);
        return;
      }
      res.writeHead(404);
      res.end("Not found");
    });

    await new Promise((resolve) => mockCdnServer.listen(0, "127.0.0.1", resolve));
    servers.push(mockCdnServer);
    const cdnPort = mockCdnServer.address().port;

    const fragment = `
      <main id="report-main">
        <section id="sec-status" class="space-y-4">
          <span id="live-board-status" class="badge badge-ghost badge-xs">Live Ready</span>
          <button id="ask-btn" type="button" data-agent-prompt="Explain this section">Ask AI</button>
          <div x-data="{ open: false }" id="alpine-widget">
            <ul id="checklist-ul">
              <template x-for="item in items" :key="item.id"><li></li></template>
            </ul>
            <span class="line-through" id="strike-target">Done</span>
          </div>
          <div id="toolkit-gridjs" data-gridjs="true"></div>
          <pre class="mermaid">graph TD; A-->B;</pre>
        </section>
        <script>
          function initDemoWidgets() {
            const g = document.getElementById("toolkit-gridjs");
            if (g && window.gridjs && !g.__init) {
              g.__init = true;
              new window.gridjs.Grid({ columns: ["Col"], data: [["Row1"], ["Row2"]] }).render(g);
            }
            const status = document.getElementById("live-board-status");
            if (status && window.location.protocol !== "file:") {
              status.textContent = "SSE Connected";
            }
          }
          if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", initDemoWidgets);
          } else {
            initDemoWidgets();
          }
        </script>
      </main>
    `;

    let { html } = buildReport({
      title: "Snapshot Fidelity Test",
      content: fragment,
      theme: "light",
      ai: true
    });

    // Replace CDN URLs with local mock CDN URLs
    html = html
      .replace(/<link[^>]+daisyui[^>]+>/i, "")
      .replace(/<script[^>]+cdn\.tailwindcss\.com[^>]*><\/script>/i, "")
      .replace(/<script[^>]+lucide[^>]+><\/script>/i, "")
      .replace(
        /<script[^>]+alpinejs[^>]+><\/script>/i,
        `<script type="module" src="http://127.0.0.1:${cdnPort}/datastar.js"></script>\n  <script defer src="http://127.0.0.1:${cdnPort}/alpine.js"></script>\n  <script defer src="http://127.0.0.1:${cdnPort}/gridjs.js"></script>\n  <script defer src="http://127.0.0.1:${cdnPort}/mermaid.js"></script>`
      );

    const entryPath = path.join(tmp, "index.html");
    fs.writeFileSync(entryPath, html, "utf-8");

    const srv = await startServer({ filePath: entryPath, port: 0, autoOpen: false });
    servers.push(srv);
    const srvPort = srv.server.address().port;

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const liveErrors = [];
      page.on("pageerror", (e) => liveErrors.push(e.message));

      await page.goto(`http://127.0.0.1:${srvPort}/`, { waitUntil: "load" });
      await page.waitForTimeout(250);

      // Simulate dirty live session state before snapshot
      await page.evaluate(() => {
        document.getElementById("settings-dropdown")?.classList.add("dropdown-open");
        document.getElementById("settings-gear-btn")?.setAttribute("aria-expanded", "true");
        document.getElementById("settings-section-download")?.setAttribute("open", "");
        document.getElementById("download-html-btn").disabled = true;
      });

      const snapshotHtml = await page.evaluate(async () => {
        return await window.buildInlinedHtmlSnapshot({ mode: "published" });
      });

      assert.equal(liveErrors.length, 0, `Live page errors: ${liveErrors.join("; ")}`);
      assert.ok(!/<script[^>]+id=["']__html_report_live_reload__["']/i.test(snapshotHtml), "live reload script element must be stripped");
      assert.ok(!snapshotHtml.includes("/__live_reload__"), "live reload EventSource URL must not leak into snapshot");

      // Write snapshot to disk and open via file://
      const snapPath = path.join(tmp, "snapshot-published.html");
      fs.writeFileSync(snapPath, snapshotHtml, "utf-8");

      const snapPage = await browser.newPage();
      const snapErrors = [];
      snapPage.on("pageerror", (e) => snapErrors.push(e.message));
      await snapPage.goto(`file://${snapPath}`, { waitUntil: "load" });
      await snapPage.waitForTimeout(300);

      const results = await snapPage.evaluate(() => {
        const dlBtn = document.getElementById("download-html-btn");
        const dd = document.getElementById("settings-dropdown");
        const det = document.getElementById("settings-section-download");
        const askBtn = document.getElementById("ask-btn");
        const statusEl = document.getElementById("live-board-status");
        const items = document.querySelectorAll("#checklist-ul > li");
        const gridEl = document.getElementById("toolkit-gridjs");
        const enlargeBtn = document.querySelector(".mermaid-enlarge-btn");
        return {
          datastarLoaded: Boolean(window.__datastarModuleLoaded),
          alpineCount: window.__alpineStartCount || 0,
          alpineHydrated: document.getElementById("alpine-widget")?.getAttribute("data-alpine-hydrated"),
          checklistItemCount: items.length,
          gridText: gridEl ? gridEl.textContent : "",
          dlDisabled: dlBtn ? dlBtn.disabled : null,
          dropdownOpen: dd ? dd.classList.contains("dropdown-open") : null,
          detailsOpen: det ? det.hasAttribute("open") : null,
          askHidden: askBtn ? askBtn.classList.contains("hidden") : null,
          statusText: statusEl ? statusEl.textContent : "",
          hasEnlargeBtn: Boolean(enlargeBtn)
        };
      });

      assert.equal(snapErrors.length, 0, `Snapshot page errors: ${snapErrors.join("; ")}`);
      assert.equal(results.datastarLoaded, true, "Datastar ES module must execute without SyntaxError");
      assert.equal(results.alpineCount, 1, "Alpine must run once after <body> exists");
      assert.equal(results.alpineHydrated, "true", "Alpine x-data widget must hydrate");
      assert.equal(results.checklistItemCount, 2, "Alpine x-for must not duplicate stale cloned <li> nodes");
      assert.equal(results.gridText, "GridRows:2", "Grid.js must mount cleanly into cleared container");
      assert.equal(results.dlDisabled, false, "#download-html-btn must not be serialized disabled");
      assert.equal(results.dropdownOpen, false, "#settings-dropdown must be closed");
      assert.equal(results.detailsOpen, false, "#settings-section-download must be collapsed");
      assert.equal(results.askHidden, true, "[data-agent-prompt] must be hidden in published mode");
      assert.equal(results.statusText, "Offline (Local Save)", "#live-board-status must show offline status under file://");
      assert.equal(results.hasEnlargeBtn, true, "Mermaid enlarge button must exist");

      // Click pre-existing cloned Mermaid Enlarge button and verify modal opens
      await snapPage.click(".mermaid-enlarge-btn");
      const modalOpen = await snapPage.evaluate(() => {
        const modal = document.getElementById("mermaid-enlarge-modal");
        return Boolean(modal && modal.open);
      });
      assert.equal(modalOpen, true, "Cloned .mermaid-enlarge-btn must open modal");
    } finally {
      await browser.close();
    }
  });

  it("7. Playwright E2E: Asset-based bundle resolves embedded text on file://, hides banner when refs/ present, and shows Recovery Banner + relinks when refs/ missing", async () => {
    const tmp = makeTempDir();
    const projDir = path.join(tmp, "asset-demo");
    const refsDir = path.join(projDir, "refs");
    fs.mkdirSync(refsDir, { recursive: true });
    fs.writeFileSync(path.join(refsDir, "photo.png"), TINY_PNG);
    fs.writeFileSync(path.join(refsDir, "notes.md"), "# Studio Notes\nVerified offline fetch.");

    fs.writeFileSync(
      path.join(projDir, "report.manifest.json"),
      JSON.stringify({ project: "asset-demo", title: "Asset Bundle Demo", mode: "report", theme: "light" }),
      "utf-8"
    );
    fs.writeFileSync(
      path.join(projDir, "fragment.html"),
      `<main id="report-main">
        <section id="gallery">
          <h1>Asset Bundle Demo</h1>
          <img id="demo-img" src="refs/photo.png" alt="Demo quilting swatch" />
          <a id="demo-doc" href="refs/notes.md">Download notes</a>
          <pre id="fetched-notes">loading...</pre>
        </section>
        <script>
          window.addEventListener("DOMContentLoaded", function () {
            fetch("refs/notes.md")
              .then(function (r) { return r.text(); })
              .then(function (txt) {
                var el = document.getElementById("fetched-notes");
                if (el) el.textContent = txt;
              });
          });
        </script>
      </main>`,
      "utf-8"
    );

    const published = await publishProject({
      projectDir: projDir,
      inlineCdn: true,
      fetchFn: async () => ({ ok: true, text: async () => "" }),
      writeOutput: true
    });
    assert.equal(published.kind, "zip");

    // Extract into a clean directory WITH refs/
    const withRefsDir = path.join(tmp, "extracted-with-refs");
    fs.mkdirSync(withRefsDir, { recursive: true });
    const entries = parseZipEntries(published.buffer);
    for (const entry of entries) {
      const target = path.join(withRefsDir, entry.name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, entry.data);
    }

    // Extract ONLY index.html into a directory WITHOUT refs/
    const withoutRefsDir = path.join(tmp, "extracted-without-refs");
    fs.mkdirSync(withoutRefsDir, { recursive: true });
    fs.writeFileSync(
      path.join(withoutRefsDir, "index.html"),
      entries.find((e) => e.name === "index.html").data
    );

    const browser = await chromium.launch({ headless: true });
    try {
      // Case A: WITH refs/ -> image loads, embedded fetch works on file://, NO recovery banner
      const pageOk = await browser.newPage();
      await pageOk.route(/^https?:\/\//, (route) => route.fulfill({ status: 200, body: "" }));
      await pageOk.goto(`file://${path.join(withRefsDir, "index.html")}`, { waitUntil: "load" });
      await pageOk.waitForTimeout(700);

      const okCheck = await pageOk.evaluate(() => ({
        imgLoaded: document.getElementById("demo-img")?.naturalWidth > 0,
        fetchedText: document.getElementById("fetched-notes")?.textContent,
        banner: document.getElementById("html-report-asset-recovery-banner")
      }));
      assert.equal(okCheck.imgLoaded, true, "Image in sibling refs/ must load");
      assert.match(okCheck.fetchedText, /Verified offline fetch/, "Embedded fallback must serve fetch('refs/notes.md') on file://");
      assert.equal(okCheck.banner, null, "Recovery banner must NOT appear when refs/ assets load");

      // Case B: WITHOUT refs/ -> fallback card renders, Recovery Banner appears, folder picker relinks image!
      const pageBroken = await browser.newPage();
      await pageBroken.route(/^https?:\/\//, (route) => route.fulfill({ status: 200, body: "" }));
      await pageBroken.goto(`file://${path.join(withoutRefsDir, "index.html")}`, { waitUntil: "load" });
      await pageBroken.waitForTimeout(700);

      const brokenCheck = await pageBroken.evaluate(() => {
        const card = document.querySelector('[data-asset-fallback-for="refs/photo.png"]');
        const banner = document.getElementById("html-report-asset-recovery-banner");
        return {
          hasFallbackCard: Boolean(card),
          fallbackText: card ? card.textContent : "",
          hasBanner: Boolean(banner),
          bannerText: banner ? banner.textContent : ""
        };
      });
      assert.equal(brokenCheck.hasFallbackCard, true, "Broken image must render inline fallback card");
      assert.match(brokenCheck.fallbackText, /Demo quilting swatch/);
      assert.match(brokenCheck.fallbackText, /refs\/photo\.png/);
      assert.equal(brokenCheck.hasBanner, true, "Asset Recovery Banner must appear when refs/ is missing");
      assert.match(brokenCheck.bannerText, /refs\//);

      // Simulate selecting the refs/ folder via #html-report-refs-picker
      await pageBroken.setInputFiles("#html-report-refs-picker", refsDir);
      await pageBroken.waitForTimeout(250);

      const restoredCheck = await pageBroken.evaluate(() => {
        const img = document.getElementById("demo-img");
        const card = document.querySelector('[data-asset-fallback-for="refs/photo.png"]');
        return {
          src: img ? img.getAttribute("src") : "",
          naturalWidth: img ? img.naturalWidth : 0,
          cardRemaining: Boolean(card)
        };
      });
      assert.ok(restoredCheck.src.startsWith("blob:"), "Selected file must relink broken img src to blob: URL");
      assert.ok(restoredCheck.naturalWidth > 0, "Relinked image must render");
      assert.equal(restoredCheck.cardRemaining, false, "Fallback card must be removed once image is restored");
    } finally {
      await browser.close();
    }
  });

  it("8. Playwright E2E: Clicking Download as HTML in Publish mode over serve-report.mjs downloads quilt-101-published.zip via /api/publish", async () => {
    const tmp = makeTempDir();
    const quiltSrc = path.join(REPO_ROOT, "projects/quilt-101");
    const quiltCopy = path.join(tmp, "quilt-101");
    fs.mkdirSync(path.join(quiltCopy, "refs"), { recursive: true });
    for (const f of fs.readdirSync(path.join(quiltSrc, "refs"))) {
      fs.copyFileSync(path.join(quiltSrc, "refs", f), path.join(quiltCopy, "refs", f));
    }
    const frag = fs.readFileSync(path.join(quiltSrc, "fragment.html"), "utf-8");
    fs.writeFileSync(path.join(quiltCopy, "fragment.html"), frag, "utf-8");
    const built = buildReport({
      title: "Quilting 101: Beginner Workshop & Block Guide",
      content: frag,
      project: "quilt-101",
      mode: "live-report",
      theme: "light",
      addons: ["datastar", "charts", "mermaid", "gridjs"],
      ai: true
    });
    const quiltEntry = path.join(quiltCopy, "index.html");
    fs.writeFileSync(quiltEntry, built.html, "utf-8");

    const srv = await startServer({ filePath: quiltEntry, port: 0, autoOpen: false });
    servers.push(srv);
    const port = srv.server.address().port;

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ acceptDownloads: true });
      const page = await context.newPage();
      await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.fulfill({ status: 200, body: "" }));
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
      await page.waitForTimeout(200);

      // Enable Publish toggle via gear menu
      await page.click("#settings-gear-btn");
      await page.click("#settings-section-download summary");
      await page.check("#settings-publish-toggle");

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.click("#download-html-btn")
      ]);

      assert.equal(download.suggestedFilename(), "quilt-101-published.zip");
      const dlPath = await download.path();
      const dlBuf = fs.readFileSync(dlPath);
      const entries = parseZipEntries(dlBuf);
      assert.ok(entries.some((e) => e.name === "index.html"));
      assert.ok(entries.some((e) => e.name === "refs/quilt.jpeg"));
    } finally {
      await browser.close();
    }
  });
});
