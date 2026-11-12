import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "../skills/html-report/scripts/serve-report.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const playwrightPath = path.resolve(REPO_ROOT, "skills/html-report/playwright/node_modules/playwright/index.mjs");
const { chromium } = await import(playwrightPath);

describe("Create Studio live project deletion without reload", () => {
  let tmpRoot;
  let serverHandle;
  let browser;
  let baseUrl;

  before(async () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "studio-live-delete-"));
    fs.writeFileSync(path.join(tmpRoot, "package.json"), JSON.stringify({ name: "tmp-studio-test", version: "1.0.0" }));
    fs.copyFileSync(path.join(REPO_ROOT, "create.html"), path.join(tmpRoot, "create.html"));

    const projectsDir = path.join(tmpRoot, "projects");
    fs.mkdirSync(path.join(projectsDir, "alpha-report"), { recursive: true });
    fs.writeFileSync(
      path.join(projectsDir, "alpha-report", "index.html"),
      "<!doctype html><html><head><title>Alpha Report</title></head><body><h1>Alpha</h1></body></html>"
    );
    fs.writeFileSync(
      path.join(projectsDir, "direct-file.html"),
      "<!doctype html><html><head><title>Direct File Report</title></head><body><h1>Direct</h1></body></html>"
    );

    process.env.NODE_ENV = "test";
    serverHandle = await startServer(path.join(tmpRoot, "create.html"), 0, false);
    const actualPort = serverHandle.server.address().port;
    baseUrl = `http://localhost:${actualPort}`;
    browser = await chromium.launch({ headless: true });
  });

  after(async () => {
    if (browser) await browser.close();
    if (serverHandle) await serverHandle.close();
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("removes deleted project from Create Studio UI when deleted on disk without page reload", async () => {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/create.html#projects`, { waitUntil: "domcontentloaded" });

    // Wait for initial projects to load
    await page.waitForFunction(() => {
      const badge = document.getElementById("navbar-projects-badge");
      return badge && badge.textContent.trim() === "2";
    }, { timeout: 5000 });

    // Set a window sentinel to prove the page does NOT reload
    await page.evaluate(() => {
      window.__noReloadSentinel = "alive";
    });

    // Delete alpha-report directly on disk
    fs.rmSync(path.join(tmpRoot, "projects", "alpha-report"), { recursive: true, force: true });

    // UI should update in place via SSE projects-changed event
    await page.waitForFunction(() => {
      const badge = document.getElementById("navbar-projects-badge");
      const grid = document.getElementById("projects-grid");
      return badge && badge.textContent.trim() === "1" && grid && !grid.textContent.includes("Alpha Report");
    }, { timeout: 5000 });

    const sentinel = await page.evaluate(() => window.__noReloadSentinel);
    assert.equal(sentinel, "alive", "Page must not reload when a project is deleted on disk");

    await page.close();
  });

  it("DELETE /api/projects deletes a direct file inside projects/ and updates UI", async () => {
    const res = await fetch(`${baseUrl}/api/projects`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "projects/direct-file.html" })
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.equal(fs.existsSync(path.join(tmpRoot, "projects", "direct-file.html")), false);

    const listRes = await fetch(`${baseUrl}/api/projects`);
    const listBody = await listRes.json();
    assert.equal(listRes.status, 200);
    assert.equal(listBody.count, 0);
  });
});
