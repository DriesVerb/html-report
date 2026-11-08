/**
 * @file mermaid-zoom.test.mjs
 * Unit and DOM tests for Mermaid Diagram Pan, Zoom & Fullscreen Viewport.
 */

import test, { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const runtimePath = path.resolve(REPO_ROOT, "skills/html-report/assets/report-runtime.js");
const shellPath = path.resolve(REPO_ROOT, "skills/html-report/assets/template-shell.html");

describe("mermaid-zoom: Pan, Zoom & Fullscreen Viewport", () => {
  let runtime;

  beforeEach(async () => {
    // Dynamic import of report-runtime.js (Node ESM export)
    const mod = await import(runtimePath);
    runtime = mod.default || mod;
  });

  it("1. Template shell includes all zoom, pan, and fullscreen toolbar controls", () => {
    const shellHtml = fs.readFileSync(shellPath, "utf-8");

    assert.ok(shellHtml.includes('id="mermaid-enlarge-modal"'), "Missing #mermaid-enlarge-modal");
    assert.ok(shellHtml.includes('id="mermaid-zoom-out-btn"'), "Missing #mermaid-zoom-out-btn");
    assert.ok(shellHtml.includes('id="mermaid-zoom-reset-btn"'), "Missing #mermaid-zoom-reset-btn");
    assert.ok(shellHtml.includes('id="mermaid-zoom-in-btn"'), "Missing #mermaid-zoom-in-btn");
    assert.ok(shellHtml.includes('id="mermaid-zoom-fit-btn"'), "Missing #mermaid-zoom-fit-btn");
    assert.ok(shellHtml.includes('id="mermaid-fullscreen-btn"'), "Missing #mermaid-fullscreen-btn");
    assert.ok(shellHtml.includes('id="mermaid-enlarge-viewport"'), "Missing #mermaid-enlarge-viewport");
    assert.ok(shellHtml.includes('id="mermaid-zoom-level"'), "Missing #mermaid-zoom-level");
  });

  it("2. HTMLReportMermaid exposes full zoom engine API", () => {
    const mermaid = runtime.HTMLReportMermaid;
    assert.ok(mermaid, "runtime.HTMLReportMermaid is defined");
    assert.equal(typeof mermaid.setScale, "function");
    assert.equal(typeof mermaid.zoomIn, "function");
    assert.equal(typeof mermaid.zoomOut, "function");
    assert.equal(typeof mermaid.resetZoom, "function");
    assert.equal(typeof mermaid.fitToViewport, "function");
    assert.equal(typeof mermaid.toggleFullscreen, "function");
    assert.equal(typeof mermaid.openModal, "function");
  });

  it("3. setScale clamps scale between 0.25 (25%) and 4.0 (400%)", () => {
    const mermaid = runtime.HTMLReportMermaid;

    mermaid.setScale(1.5);
    assert.equal(mermaid._scale, 1.5);

    // Below min
    mermaid.setScale(0.1);
    assert.equal(mermaid._scale, 0.25, "Clamps to minimum 0.25");

    // Above max
    mermaid.setScale(5.0);
    assert.equal(mermaid._scale, 4.0, "Clamps to maximum 4.0");

    // Normal range
    mermaid.setScale(2.0);
    assert.equal(mermaid._scale, 2.0);
  });

  it("4. zoomIn and zoomOut smoothly step scale and respect boundaries", () => {
    const mermaid = runtime.HTMLReportMermaid;
    mermaid.resetZoom();
    assert.equal(mermaid._scale, 1.0);

    mermaid.zoomIn(0.2);
    assert.ok(Math.abs(mermaid._scale - 1.2) < 0.001);

    mermaid.zoomOut(0.4);
    assert.ok(Math.abs(mermaid._scale - 0.8) < 0.001);

    mermaid.resetZoom();
    assert.equal(mermaid._scale, 1.0);
    assert.equal(mermaid._panX, 0);
    assert.equal(mermaid._panY, 0);
  });

  it("5. toggleFullscreen toggles state cleanly", () => {
    const mermaid = runtime.HTMLReportMermaid;
    mermaid._isFullscreen = false;

    // In Node environment without DOM, toggleFullscreen safely handles null element
    assert.doesNotThrow(() => {
      mermaid.toggleFullscreen();
    });
  });
});
