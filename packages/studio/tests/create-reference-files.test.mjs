import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "../../../skills/html-report/scripts/serve-report.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const playwrightPath = path.resolve(REPO_ROOT, "packages/core/playwright/node_modules/playwright/index.mjs");
const { chromium } = await import(playwrightPath);

describe("Creation Studio Reference File Auto-Staging & Workspace Picker", () => {
  let tmpRoot;
  let serverHandle;
  let browser;
  let baseUrl;

  before(async () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "studio-ref-files-"));
    fs.writeFileSync(path.join(tmpRoot, "package.json"), JSON.stringify({ name: "tmp-ref-files-test", version: "1.0.0" }));
    fs.copyFileSync(path.join(REPO_ROOT, "packages/studio/assets/create.html"), path.join(tmpRoot, "create.html"));

    // Seed workspace data file and ignored directory
    fs.mkdirSync(path.join(tmpRoot, "data"), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, "data", "q4-revenue.csv"), "region,arr\nEMEA,420000\n");
    fs.mkdirSync(path.join(tmpRoot, "node_modules", "pkg"), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, "node_modules", "pkg", "ignored.js"), "export {};");

    process.env.NODE_ENV = "test";
    serverHandle = await startServer(path.join(tmpRoot, "create.html"), 0, false);
    const actualPort = serverHandle.server.address().port;
    baseUrl = `http://localhost:${actualPort}`;
    browser = await chromium.launch({ headless: true });
  });

  after(async () => {
    if (browser) await browser.close();
    if (serverHandle && typeof serverHandle.close === "function") {
      await serverHandle.close();
    } else if (serverHandle && serverHandle.server) {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
    if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("POST /api/create/upload stages files into projects/_uploads/ and sanitizes traversal names", async () => {
    const res = await fetch(`${baseUrl}/api/create/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "../../etc/evil-payload.csv",
        contentBase64: Buffer.from("col\n1\n").toString("base64")
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.name, "evil-payload.csv");
    assert.equal(data.path, "projects/_uploads/evil-payload.csv");

    const stagedOnDisk = path.join(tmpRoot, "projects", "_uploads", "evil-payload.csv");
    assert.equal(fs.existsSync(stagedOnDisk), true);
    assert.equal(fs.readFileSync(stagedOnDisk, "utf-8"), "col\n1\n");
  });

  it("POST /api/create/upload with projectSlug writes directly to projects/<slug>/refs/ and blocks traversal", async () => {
    const projectDir = path.join(tmpRoot, "projects", "q4-sales-audit");
    fs.mkdirSync(path.join(projectDir, "refs"), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, "report.manifest.json"),
      JSON.stringify({ project: "q4-sales-audit", referenceFiles: [] }, null, 2)
    );

    const res = await fetch(`${baseUrl}/api/create/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectSlug: "q4-sales-audit",
        name: "../../etc/passwd-notes.csv",
        contentBase64: Buffer.from("region,arr\nNA,500000\n").toString("base64")
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.scope, "workspace");
    assert.equal(data.projectSlug, "q4-sales-audit");
    assert.equal(data.name, "passwd-notes.csv");
    assert.equal(data.path, "projects/q4-sales-audit/refs/passwd-notes.csv");

    const onDisk = path.join(projectDir, "refs", "passwd-notes.csv");
    assert.equal(fs.existsSync(onDisk), true);
    assert.equal(fs.readFileSync(onDisk, "utf-8"), "region,arr\nNA,500000\n");

    const updatedManifest = JSON.parse(fs.readFileSync(path.join(projectDir, "report.manifest.json"), "utf-8"));
    assert.ok(updatedManifest.referenceFiles.some((r) => r.stagedPath === "projects/q4-sales-audit/refs/passwd-notes.csv"));

    // Path traversal inside projectSlug must be rejected with 403
    const traversalRes = await fetch(`${baseUrl}/api/create/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectSlug: "../../etc",
        name: "bad.txt",
        contentBase64: Buffer.from("nope").toString("base64")
      })
    });
    assert.equal(traversalRes.status, 403);
  });

  it("GET /api/create/workspace-files?project=<slug> prioritizes projectFiles and excludes boilerplate", async () => {
    const projectDir = path.join(tmpRoot, "projects", "q4-sales-audit");
    fs.mkdirSync(path.join(projectDir, "refs"), { recursive: true });
    fs.writeFileSync(path.join(projectDir, "refs", "existing-notes.md"), "# Q4 Notes\n");
    fs.writeFileSync(path.join(projectDir, "index.html"), "<html></html>");
    fs.writeFileSync(path.join(projectDir, "fragment.html"), "<main id='report-main'></main>");
    fs.writeFileSync(path.join(projectDir, "AGENTS.md"), "# Agents\n");

    const res = await fetch(`${baseUrl}/api/create/workspace-files?project=q4-sales-audit`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.project, "q4-sales-audit");
    assert.ok(Array.isArray(data.projectFiles));
    assert.ok(data.projectFiles.some((f) => f.path === "projects/q4-sales-audit/refs/existing-notes.md" && f.inProjectWorkspace === true));
    assert.ok(!data.projectFiles.some((f) => f.name === "index.html" || f.name === "fragment.html" || f.name === "AGENTS.md" || f.name === "report.manifest.json"));
    // projectFiles should appear at the front of files
    assert.equal(data.files[0].inProjectWorkspace, true);
  });

  it("Browser: active workspace auto-includes existing project files and uploads new files directly to projects/<slug>/refs/", async () => {
    const projectDir = path.join(tmpRoot, "projects", "alpha-audit");
    fs.mkdirSync(path.join(projectDir, "refs"), { recursive: true });
    fs.writeFileSync(path.join(projectDir, "refs", "preexisting-brief.md"), "# Preexisting Brief\n");

    const page = await browser.newPage();
    await page.goto(`${baseUrl}/create.html`, { waitUntil: "domcontentloaded" });

    // Enter workspace slug and click Create Workspace
    await page.fill("#input-project-slug", "alpha-audit");
    await page.click("#btn-scaffold-now");
    await page.waitForFunction(() => {
      const b = document.getElementById("scaffold-result-banner");
      return b && !b.classList.contains("hidden");
    });

    // Existing file in projects/alpha-audit/refs/ must auto-populate in #collected-files-list and prompt
    await page.waitForFunction(() => {
      const list = document.getElementById("collected-files-list");
      return list && list.textContent && list.textContent.includes("preexisting-brief.md");
    });

    // Upload a new file -> must go straight to projects/alpha-audit/refs/revenue.csv (NOT _uploads)
    await page.setInputFiles("#file-picker-input", [
      { name: "revenue.csv", mimeType: "text/csv", buffer: Buffer.from("region,arr\nEMEA,300\n") }
    ]);
    await page.waitForFunction(() => {
      const list = document.getElementById("collected-files-list");
      return list && list.textContent && list.textContent.includes("projects/alpha-audit/refs/revenue.csv");
    });

    assert.equal(fs.existsSync(path.join(projectDir, "refs", "revenue.csv")), true);
    const prompt = await page.inputValue("#prompt-output-box");
    assert.match(prompt, /projects\/alpha-audit\/refs\/preexisting-brief\.md/);
    assert.match(prompt, /projects\/alpha-audit\/refs\/revenue\.csv/);

    await page.close();
  });

  it("GET /api/create/workspace-files lists workspace files and skips node_modules", async () => {
    const res = await fetch(`${baseUrl}/api/create/workspace-files?q=revenue`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.ok(data.files.some((f) => f.path === "data/q4-revenue.csv"));
    assert.ok(!data.files.some((f) => f.path.includes("node_modules")));
  });

  it("Browser: file picker auto-stages to projects/_uploads/ and workspace picker adds exact relative path to prompt", async () => {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/create.html`, { waitUntil: "domcontentloaded" });

    // 1. Auto-stage a picked file
    await page.setInputFiles("#file-picker-input", [
      { name: "metrics.csv", mimeType: "text/csv", buffer: Buffer.from("arr,churn\n100,5\n") }
    ]);

    await page.waitForSelector(".collected-file-path", { timeout: 5000 });
    const stagedPathText = await page.textContent(".collected-file-item:nth-child(1) .collected-file-path");
    assert.equal(stagedPathText.trim(), "projects/_uploads/metrics.csv");

    // 2. Pick an existing workspace file via From Workspace
    await page.click("#btn-browse-workspace");
    await page.waitForSelector(".workspace-file-option", { timeout: 5000 });
    await page.fill("#workspace-files-search", "q4-revenue");
    await page.waitForTimeout(150);
    await page.click(".workspace-file-option[data-file-path='data/q4-revenue.csv']");

    const items = await page.$$(".collected-file-item");
    assert.equal(items.length, 2);

    const prompt = await page.inputValue("#prompt-output-box");
    assert.match(prompt, /• metrics\.csv \(CSV Dataset\) \[Path: projects\/_uploads\/metrics\.csv\]/);
    assert.match(prompt, /• q4-revenue\.csv \(CSV Dataset\) \[Path: data\/q4-revenue\.csv\]/);
    assert.match(prompt, /• metrics\.csv \(Path: projects\/_uploads\/metrics\.csv\):/);
    assert.match(prompt, /• q4-revenue\.csv \(Path: data\/q4-revenue\.csv\):/);

    await page.close();
  });

  it("Browser: navbar Sections links scroll to target #step-* sections without snapping back to top", async () => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${baseUrl}/create.html`, { waitUntil: "domcontentloaded" });

    // Open Sections dropdown and click 3. Content Capabilities (#step-features)
    await page.click("#toc-dropdown-btn");
    await page.click('#report-toc-list a[href="#step-features"]');
    await page.waitForTimeout(200);

    const scrollAfterFeatures = await page.evaluate(() => window.scrollY);
    assert.ok(scrollAfterFeatures > 100, `Expected page to scroll to #step-features, got scrollY=${scrollAfterFeatures}`);

    // Open Sections dropdown and click 6. Final AI Prompt & Mockup (#step-output)
    await page.click("#toc-dropdown-btn");
    await page.click('#report-toc-list a[href="#step-output"]');
    await page.waitForTimeout(200);

    const scrollAfterOutput = await page.evaluate(() => window.scrollY);
    assert.ok(scrollAfterOutput > scrollAfterFeatures, `Expected #step-output (${scrollAfterOutput}) to be further down than #step-features (${scrollAfterFeatures})`);

    await page.close();
  });
});
