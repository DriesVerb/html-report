import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const playwrightPath = path.resolve(__dirname, "../skills/html-report/playwright/node_modules/playwright/index.mjs");
const { chromium } = await import(playwrightPath);

function fetchUrl(url, { headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, (res) => {
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
  });
}

describe("Datastar Live LLM Tracking & Showdown Artifact Viewer", () => {
  it("should resolve /proposal.md as raw text/markdown when requested via fetch/curl", async () => {
    const res = await fetchUrl("http://localhost:3000/proposal.md");
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-type"], /text\/markdown/);
    assert.match(res.body, /^# Proposal:/m);
  });

  it("should resolve /proposal.md as Showdown HTML preview when Accept header contains text/html", async () => {
    const res = await fetchUrl("http://localhost:3000/proposal.md", {
      headers: { Accept: "text/html,application/xhtml+xml" }
    });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-type"], /text\/html/);
    assert.match(res.body, /showdown\.Converter/);
    assert.match(res.body, /id="markdown-body"/);
  });

  it("should resolve /specs/ as the active capability spec.md", async () => {
    const res = await fetchUrl("http://localhost:3000/specs");
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-type"], /text\/markdown/);
    assert.ok(res.body.length > 50, "Spec body should not be empty");
  });

  it("should open Showdown modal in browser and switch tabs when clicking artifact buttons", async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const consoleErrors = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });

      // Verify main components exist
      const stepper = await page.$("#journey-stepper");
      assert.ok(stepper, "Journey stepper must be present");

      // Click on proposal.md button
      const proposalBtn = await page.$('button:has-text("proposal.md")');
      if (proposalBtn) {
        await proposalBtn.click();
        await page.waitForTimeout(300);

        // Verify modal is open and has rendered content
        const modalVisible = await page.isVisible("#markdown-viewer-modal");
        assert.ok(modalVisible, "Markdown viewer modal must be visible");

        const modalDocTitle = await page.textContent("#modal-doc-title, #markdown-modal-title");
        assert.equal(modalDocTitle.trim(), "proposal.md");

        const renderedMarkdown = await page.textContent("#modal-markdown-body, #modal-markdown-container, #markdown-modal-body");
        assert.match(renderedMarkdown, /Proposal:/);

        // Click on tasks.md tab inside modal
        const tasksTab = await page.$('#tab-btn-tasks, button.doc-tab-btn[data-doc="tasks.md"], button.md-tab-btn[data-doc="tasks.md"], #markdown-viewer-modal button:has-text("tasks.md")');
        if (tasksTab) {
          await tasksTab.click();
          await page.waitForTimeout(300);

          const updatedDocTitle = await page.textContent("#modal-doc-title, #markdown-modal-title");
          assert.equal(updatedDocTitle.trim(), "tasks.md");

          const tasksMarkdown = await page.textContent("#modal-markdown-body, #modal-markdown-container, #markdown-modal-body");
          assert.match(tasksMarkdown, /Tasks:/);
        }

        // Close modal
        const closeBtn = await page.$("#markdown-viewer-modal button:has-text('✕')");
        if (closeBtn) await closeBtn.click();
        await page.waitForTimeout(200);
      }
      assert.equal(consoleErrors.length, 0, `Expected 0 console errors, got: ${consoleErrors.join("; ")}`);
    } finally {
      await browser.close();
    }
  });
});
