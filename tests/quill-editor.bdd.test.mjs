/**
 * @file quill-editor.bdd.test.mjs
 * BDD Specification Suite for Quill WYSIWYG Editor Addon & Creation Studio Dual-Mode Goals.
 */

import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildReport, parseArgs, ADDON_REGISTRY } from "../skills/html-report/scripts/build-report.mjs";
import { ADDON_CATALOG } from "../skills/html-report/scripts/domain-model.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const createHtmlPath = path.resolve(REPO_ROOT, "create.html");
const assetCreateHtmlPath = path.resolve(REPO_ROOT, "skills/html-report/assets/create.html");

describe("Feature Spec: Quill WYSIWYG Editor Support & Wizard Dual-Mode Input", () => {
  describe("Requirement: Quill Addon Pipeline Registration & Auto-Detection", () => {
    it("Scenario: Quill registered in domain-model.mjs catalog", () => {
      assert.ok(ADDON_CATALOG.quill, "Quill should be registered in ADDON_CATALOG");
      assert.equal(ADDON_CATALOG.quill.flag, "--quill");
      assert.ok(ADDON_CATALOG.quill.label.includes("Quill"));
    });

    it("Scenario: Quill detected via DOM signatures (ql-editor, id='editor', new Quill)", () => {
      const fragment = `
        <div class="card p-4">
          <div id="editor" class="ql-editor">
            <p>Executive rich text content</p>
          </div>
        </div>
      `;

      const { html, activeAddons } = buildReport({
        title: "Quill Auto-Detect Test",
        content: fragment
      });

      assert.ok(activeAddons.includes("quill"), "activeAddons should include quill");
      assert.ok(html.includes("quill.snow.css"), "Report head should include quill.snow.css");
      assert.ok(html.includes("quill.js"), "Report head should include quill.js");
    });

    it("Scenario: Quill requested via explicit CLI flags (--quill, --wysiwyg, --editor)", () => {
      const optsQuill = parseArgs(["node", "build-report.mjs", "--quill", "dummy.html"]);
      assert.ok(optsQuill.addons.includes("quill"), "--quill should activate quill addon");

      const optsWysiwyg = parseArgs(["node", "build-report.mjs", "--wysiwyg", "dummy.html"]);
      assert.ok(optsWysiwyg.addons.includes("quill"), "--wysiwyg should alias to quill");

      const optsEditor = parseArgs(["node", "build-report.mjs", "--editor", "dummy.html"]);
      assert.ok(optsEditor.addons.includes("quill"), "--editor should alias to quill");
    });
  });

  describe("Requirement: Creation Studio Wizard Section A Addon & Wireframe Mockup", () => {
    it("Scenario: create.html and asset create.html contain #chk-quill in Section A", () => {
      const rootHtml = fs.readFileSync(createHtmlPath, "utf-8");
      const assetHtml = fs.readFileSync(assetCreateHtmlPath, "utf-8");

      for (const [name, content] of [["root create.html", rootHtml], ["asset create.html", assetHtml]]) {
        assert.ok(content.includes('id="chk-quill"'), `${name} missing #chk-quill`);
        assert.ok(content.includes("WYSIWYG Editor"), `${name} missing WYSIWYG Editor label`);
        assert.ok(content.includes('id="mockup-editor-widget"'), `${name} missing #mockup-editor-widget`);
      }
    });

    it("Scenario: Starter HTML download bundles Quill when #chk-quill is active", () => {
      const content = fs.readFileSync(createHtmlPath, "utf-8");
      assert.ok(content.includes("hasQuill"), "downloadStarterHtml should check hasQuill");
      assert.ok(content.includes("quill.snow.css"), "downloadStarterHtml bundle should include quill.snow.css");
      assert.ok(content.includes("quill.js"), "downloadStarterHtml bundle should include quill.js");
    });
  });

  describe("Requirement: Dual-Mode Simple vs Complex Board Goals Authoring", () => {
    it("Scenario: create.html renders mode toggle buttons and dual input containers", () => {
      const content = fs.readFileSync(createHtmlPath, "utf-8");

      assert.ok(content.includes('id="btn-mode-simple"'), "Missing #btn-mode-simple");
      assert.ok(content.includes('id="btn-mode-complex"'), "Missing #btn-mode-complex");
      assert.ok(content.includes('id="input-board-goals"'), "Missing #input-board-goals");
      assert.ok(content.includes('id="quill-board-goals-container"'), "Missing #quill-board-goals-container");
      assert.ok(content.includes('id="quill-board-goals-editor"'), "Missing #quill-board-goals-editor");
      assert.ok(content.includes("switchBoardGoalMode"), "Missing switchBoardGoalMode handler");
    });

    it("Scenario: Compact Simple/Rich buttons with Simple default and dedicated Rich Editor modal", () => {
      for (const [name, targetPath] of [["root create.html", createHtmlPath], ["asset create.html", assetCreateHtmlPath]]) {
        const content = fs.readFileSync(targetPath, "utf-8");
        assert.ok(content.includes('>Rich<') || content.includes('>Rich</span>'), `${name} should have button labeled Rich`);
        assert.ok(content.includes('>Simple</button>'), `${name} should have button labeled Simple`);
        assert.ok(content.includes('let boardGoalMode = "simple"'), `${name} default mode must be simple`);
        assert.ok(content.includes('id="modal-rich-goals"'), `${name} missing #modal-rich-goals`);
        assert.ok(content.includes('id="btn-save-rich-goals"'), `${name} missing #btn-save-rich-goals`);
        assert.ok(content.includes('id="rich-goals-indicator"'), `${name} missing #rich-goals-indicator`);
        assert.ok(content.includes("openRichEditorModal"), `${name} missing openRichEditorModal`);
        assert.ok(content.includes("closeRichEditorModal"), `${name} missing closeRichEditorModal`);
        assert.ok(content.includes("saveRichGoalsAndClose"), `${name} missing saveRichGoalsAndClose`);
      }
    });

    it("Scenario: Goals persistence and mode restore from localStorage", () => {
      const content = fs.readFileSync(createHtmlPath, "utf-8");
      assert.ok(content.includes("html-report-create-goals-mode"), "Should persist active goal mode in localStorage");
      assert.ok(content.includes("html-report-create-goals-simple"), "Should persist simple goals in localStorage");
      assert.ok(content.includes("html-report-create-goals-complex"), "Should persist complex goals in localStorage");
    });
  });
});
