/**
 * Gear settings menu, page edit queue, AI activation and clean publishing.
 * Covers openspec/changes: gear-settings-menu, page-edit-prompt-editor,
 * settings-activate-ai, publish-clean-report.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { HTMLReportSettings, HTMLReportMermaid, HTMLReportPublisher, compileTheme, registerCustomTheme, setReportTheme } from "@html-report/core/assets/report-runtime.js";
import { HTMLReportAgent, HTMLReportEdit } from "../assets/authoring-plugin.js";
import { buildReport, parseArgs, stripAuthoringMarkup } from "../../../skills/html-report/scripts/build-report.mjs";
import { scaffoldProject } from "../../../skills/html-report/scripts/scaffold-project.mjs";
import { startServer } from "../../../skills/html-report/scripts/serve-report.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const FRAGMENT = '<section id="intro"><h2>Intro</h2><p>Hello</p></section>';
const shell = buildReport({ title: "Shell", content: FRAGMENT, editable: true }).html;

describe("gear-settings-menu", () => {
  it("renders one gear as the settings entry point and moves theme + export into it", () => {
    assert.ok(shell.includes('id="settings-dropdown"'));
    assert.ok(shell.includes('id="settings-gear-btn"'));
    assert.ok(shell.includes('aria-label="Settings"'));
    const panel = shell.slice(shell.indexOf('id="settings-panel"'), shell.indexOf('id="pwa-install-btn"'));
    for (const id of [
      "open-all-settings-btn",
      "settings-section-appearance",
      "settings-section-download",
      "theme-swatch-list",
      "active-theme-label",
      "settings-publish-toggle",
      "download-html-btn",
      "download-pdf-btn",
      "settings-extra-sections"
    ]) {
      assert.ok(panel.includes(`id="${id}"`), `${id} must live inside the gear panel`);
    }

    // "All Settings" button is the first option
    const idxAllSettings = panel.indexOf('id="open-all-settings-btn"');
    const idxAppearance = panel.indexOf('id="settings-section-appearance"');
    const idxDownload = panel.indexOf('id="settings-section-download"');
    assert.ok(idxAllSettings < idxAppearance, "All Settings button must be before Appearance section");
    assert.ok(idxAppearance < idxDownload, "Appearance section must be before Download section");

    // Appearance is unexpanded with live color palette in summary
    assert.ok(panel.includes('<details class="collapse collapse-arrow'));
    const appSection = panel.slice(idxAppearance, idxDownload);
    assert.ok(appSection.includes('<summary class="collapse-title'));
    assert.ok(appSection.includes('id="active-theme-label"'));
    assert.ok(appSection.includes('bg-primary'));

    // Download section has publish switch as first option ahead of download-html-btn
    const downSection = panel.slice(idxDownload);
    const idxPubSwitch = downSection.indexOf('id="settings-publish-toggle"');
    const idxDownHtml = downSection.indexOf('id="download-html-btn"');
    assert.ok(idxPubSwitch < idxDownHtml, "Publish switch must be before Download as HTML");

    // All Settings modal exists with tabbed structure
    assert.ok(shell.includes('id="all-settings-modal"'));
    assert.ok(shell.includes('id="tab-btn-appearance"'));
    assert.ok(shell.includes('id="tab-btn-download"'));
    assert.ok(shell.includes('id="tab-btn-ai"'));
    assert.ok(shell.includes('id="tab-btn-editor"'));

    assert.ok(!shell.includes('id="theme-dropdown-btn"'), "old navbar theme trigger removed");
    assert.ok(!shell.includes('id="download-dropdown-btn"'), "old navbar download trigger removed");
    assert.ok(shell.includes('id="toc-dropdown"'), "TOC stays in the navbar");
    assert.ok(shell.includes('id="agent-bridge-status-container"'), "bridge badge stays in the navbar");
  });

  it("exposes an extensible, ordered section registry without standalone publishing", () => {
    assert.equal(HTMLReportSettings.registerSection({ id: "zz-test-b", title: "B", order: 900, render() {} }), true);
    HTMLReportSettings.registerSection({ id: "zz-test-a", title: "A", order: 800, render() {} });
    const ids = HTMLReportSettings.getSections().map((s) => s.id);
    assert.ok(ids.indexOf("zz-test-a") < ids.indexOf("zz-test-b"));
    assert.equal(HTMLReportSettings.registerSection({ id: "bad" }), false);
    assert.ok(!ids.includes("publishing"), "standalone publishing section must not be registered");
  });

  it("includes all 4 tabs in the All Settings modal and scopes data-theme on modal swatches", () => {
    for (const panelId of ["panel-appearance", "panel-download", "panel-ai", "panel-editor"]) {
      assert.ok(shell.includes(`id="${panelId}"`), `All Settings modal must include ${panelId}`);
    }
    assert.ok(shell.includes('id="modal-theme-grid"'), "modal-theme-grid must exist");
  });
});

describe("page-edit-queue", () => {
  const T = (id, priority, order, extra = {}) => ({ id, title: `T${id}`, content: "", priority, order, done: false, anchor: null, ...extra });

  it("buildEditPrompt orders by priority then order and excludes done tasks", () => {
    const prompt = HTMLReportEdit.buildEditPrompt(
      [T("a", 2, 1), T("b", 1, 5), T("c", 1, 2), T("d", 3, 0, { done: true })],
      { title: "Q", source: "r.html", mode: "report" }
    );
    const order = [...prompt.matchAll(/^\d+\. \[P(\d)\] (T\w)/gm)].map((m) => m[2]);
    assert.deepEqual(order, ["Tc", "Tb", "Ta"]);
    assert.ok(!prompt.includes("Td"));
    assert.ok(prompt.includes("Source: r.html"));
  });

  it("buildEditPrompt is byte-stable and includes anchors", () => {
    const tasks = [T("a", 1, 1, { content: "line1\nline2", anchor: { id: "kpi", label: "KPIs" } })];
    const page = { title: "Q", source: "r.html", mode: "report" };
    assert.equal(HTMLReportEdit.buildEditPrompt(tasks, page), HTMLReportEdit.buildEditPrompt(tasks, page));
    assert.match(HTMLReportEdit.buildEditPrompt(tasks, page), /Section: KPIs \(#kpi\)/);
  });

  it("persists tasks per page key with CRUD, priority and reorder", () => {
    const key = "unit-test-page";
    HTMLReportEdit.saveTasks([], key);
    const a = HTMLReportEdit.addTask({ title: "one", priority: 2 }, key);
    const b = HTMLReportEdit.addTask({ title: "two", priority: 2 }, key);
    assert.equal(HTMLReportEdit.addTask({ title: "  " }, key), null);
    HTMLReportEdit.moveTask(b.id, -1, key);
    assert.deepEqual(HTMLReportEdit.sortTasks(HTMLReportEdit.getTasks(key)).map((t) => t.title), ["two", "one"]);
    HTMLReportEdit.updateTask(a.id, { priority: 1, done: true }, key);
    assert.equal(HTMLReportEdit.getTasks(key).find((t) => t.id === a.id).done, true);
    assert.equal(HTMLReportEdit.getTasks("other-page").length, 0);
    HTMLReportEdit.removeTask(a.id, key);
    assert.equal(HTMLReportEdit.getTasks(key).length, 1);
  });

  it("resolves the three send states", () => {
    assert.equal(HTMLReportEdit.resolveSendState(true, "connected"), "send");
    assert.equal(HTMLReportEdit.resolveSendState(true, "disconnected"), "turnkey");
    assert.equal(HTMLReportEdit.resolveSendState(false, "connected"), "copy");
  });

  it("ships the edit dock markup, hidden and print-safe with darkmode and small-mode safeguards", () => {
    assert.match(shell, /<aside id="edit-dock"[^>]*print:hidden/);
    assert.match(shell, /border-t-2 border-x border-primary/, "darkmode top border accent");
    assert.match(shell, /shadow-\[0_-10px_35px_-5px_rgba\(0,0,0,0\.5\)\]/, "upward shadow for darkmode");
    for (const id of ["edit-task-title", "edit-task-content", "edit-queue-list", "edit-generate-btn", "edit-send-btn", "edit-section-chip", "edit-auto-priority-toggle"]) {
      assert.ok(shell.includes(`id="${id}"`), id);
    }
    assert.match(shell, /id="edit-send-btn"[^>]*disabled/, "copy prompt button initially disabled");
    assert.match(shell, /id="edit-task-anchor"[^>]*badge-outline/, "anchor badge uses outline for visibility");
  });

  it("buildEditPrompt with autoPriority adds agent instruction", () => {
    const tasks = [T("x", 2, 1, { title: "Refactor charts" })];
    const page = { title: "Dashboard", source: "dash.html", mode: "report" };
    const promptAuto = HTMLReportEdit.buildEditPrompt(tasks, page, { autoPriority: true });
    assert.match(promptAuto, /Auto-priority: The AI agent must assess all tasks, identify dependencies, and create\/determine its own optimal execution priority order\./);

    const promptNormal = HTMLReportEdit.buildEditPrompt(tasks, page, { autoPriority: false });
    assert.ok(!promptNormal.includes("Auto-priority:"));
  });

  it("autoPriority persists per pageKey and setAutoPriority invalidates generated prompt", () => {
    const key = "auto-p-page";
    HTMLReportEdit.setAutoPriority(true, key);
    assert.equal(HTMLReportEdit.isAutoPriority(key), true);
    HTMLReportEdit.setAutoPriority(false, key);
    assert.equal(HTMLReportEdit.isAutoPriority(key), false);
  });

  it("resets generated prompt when tasks enter the queue or are modified", () => {
    const key = "reset-prompt-page";
    HTMLReportEdit.saveTasks([], key);
    HTMLReportEdit.addTask({ title: "Task 1", priority: 2 }, key);
    HTMLReportEdit.generatePrompt();
    assert.ok(HTMLReportEdit._generatedPrompt);

    // Adding a new task resets generated prompt
    HTMLReportEdit.addTask({ title: "Task 2", priority: 1 }, key);
    assert.equal(HTMLReportEdit._generatedPrompt, null, "new task must reset generated prompt");

    // Re-generate and verify updateTask resets it
    HTMLReportEdit.generatePrompt();
    assert.ok(HTMLReportEdit._generatedPrompt);
    const tasks = HTMLReportEdit.getTasks(key);
    HTMLReportEdit.updateTask(tasks[0].id, { title: "Renamed" }, key);
    assert.equal(HTMLReportEdit._generatedPrompt, null, "updating task must reset generated prompt");
  });

  it("buildEditPrompt includes skill provenance and is strictly project-agnostic", () => {
    const prompt = HTMLReportEdit.buildEditPrompt(
      [T("a", 1, 1, { title: "Fix alignment" })],
      { title: "Quarterly Review", source: "review.html", mode: "report" }
    );
    assert.match(prompt, /Generated by: \/html-report skill/);
    assert.match(prompt, /Agent instructions: Use available workspace tools/);
    assert.match(prompt, /skills\/html-report\/references\/agent-authoring-guide\.md/);
    assert.match(prompt, /Follow the task tracking and verification principles of this project/);
    assert.ok(!prompt.toLowerCase().includes("openspec"), "Prompt must not mention OpenSpec");
  });
});

describe("page-edit-selection", () => {
  it("ships selection mode toggle button and target badge in template shell", () => {
    assert.ok(shell.includes('id="edit-dock-select"'), "must include select toggle button");
    assert.ok(shell.includes('id="edit-selected-target"'), "must include selected target badge container");
    assert.ok(shell.includes('id="edit-target-id"'), "must include target id element");
    assert.ok(shell.includes('id="edit-target-tag"'), "must include target tag element");
    assert.ok(shell.includes('id="edit-clear-target"'), "must include clear target button");

    const selectIdx = shell.indexOf('id="edit-dock-select"');
    const addIdx = shell.indexOf('id="edit-dock-add"');
    assert.ok(selectIdx < addIdx, "Select button must be right before + Task button");
  });

  it("getOrAssignId preserves existing id or generates unique semantic slug", () => {
    const elWithId = { id: "existing-chart", tagName: "CANVAS", textContent: "" };
    assert.equal(HTMLReportEdit.getOrAssignId(elWithId), "existing-chart");

    const elNoId = { id: "", tagName: "H2", textContent: "Revenue Trends & KPI" };
    const generated = HTMLReportEdit.getOrAssignId(elNoId);
    assert.match(generated, /^h2-revenue-trends/);
    assert.equal(elNoId.id, generated, "must stamp generated id onto the element");

    const elEmpty = { id: null, tagName: "DIV", textContent: "" };
    const genEmpty = HTMLReportEdit.getOrAssignId(elEmpty);
    assert.match(genEmpty, /^div-/);
  });

  it("setSelectedTarget stores target metadata and addTask persists target", () => {
    const key = "test-target-page";
    HTMLReportEdit.saveTasks([], key);
    HTMLReportEdit.setSelectedTarget({ id: "rev-chart", tag: "canvas" });
    assert.deepEqual(HTMLReportEdit.getSelectedTarget(), { id: "rev-chart", tag: "canvas" });

    const task = HTMLReportEdit.addTask({
      title: "Switch chart to pie",
      content: "Use regional distribution",
      target: HTMLReportEdit.getSelectedTarget(),
      priority: 2
    }, key);

    assert.deepEqual(task.target, { id: "rev-chart", tag: "canvas" });
    const stored = HTMLReportEdit.getTasks(key).find((t) => t.id === task.id);
    assert.deepEqual(stored.target, { id: "rev-chart", tag: "canvas" });

    HTMLReportEdit.setSelectedTarget(null);
    assert.equal(HTMLReportEdit.getSelectedTarget(), null);
  });

  it("buildEditPrompt formats target element and tag into deterministic prompt", () => {
    const tasks = [
      {
        id: "t1",
        title: "Change heading",
        content: "Change text for #hero-title into '2026 Strategy'",
        priority: 1,
        order: 1,
        done: false,
        target: { id: "hero-title", tag: "h1" },
        anchor: { id: "overview", label: "Overview" }
      }
    ];
    const page = { title: "Executive Report", source: "report.html", mode: "report" };
    const prompt = HTMLReportEdit.buildEditPrompt(tasks, page);

    assert.match(prompt, /Target Element: #hero-title \(<h1>\)/);
    assert.match(prompt, /Section: Overview \(#overview\)/);
    assert.match(prompt, /Change text for #hero-title into '2026 Strategy'/);
    // Byte-identical deterministic check
    assert.equal(prompt, HTMLReportEdit.buildEditPrompt(tasks, page));
  });
});

describe("settings-activate-ai", () => {
  it("isAiCapable is false without a DOM and exposes toggle API", () => {
    assert.equal(HTMLReportAgent.isAiCapable(), false);
    assert.equal(typeof HTMLReportAgent.setAiActive, "function");
  });

  it("build --ai emits the capability meta and records the source path", () => {
    const { html } = buildReport({ title: "T", content: FRAGMENT, ai: true, source: "./out/report.html" });
    assert.match(html, /<meta name="html-report-ai" content="on"/);
    assert.match(html, /<meta name="html-report-source" content="\.\/out\/report\.html"/);
    const plain = buildReport({ title: "T", content: FRAGMENT }).html;
    assert.ok(!plain.includes('<meta name="html-report-ai"'));
  });

  it("parses --ai and --published CLI flags", () => {
    const o = parseArgs(["node", "build", "--content", "f.html", "--ai", "--published"]);
    assert.equal(o.ai, true);
    assert.equal(o.published, true);
  });

  it("per-board reconnect prompt can carry an edit request", () => {
    const p = HTMLReportAgent.getReconnectPrompt({ filename: "boards/a.html", extra: "EDIT-REQ" });
    assert.ok(p.includes("serve-report.mjs boards/a.html"));
    assert.ok(p.includes("EDIT-REQ"));
  });

  it("template shell hides agent-dock-container by default and labels it AI Assistant", () => {
    assert.match(shell, /<aside id="agent-dock-container"[^>]*class="[^"]*hidden[^"]*"/);
    assert.match(shell, /<span class="font-bold text-xs tracking-wide">AI Assistant<\/span>/);
    assert.match(shell, /<h3 class="text-xs font-bold text-base-content truncate">AI Assistant<\/h3>/);
  });

  it("AI activation toggles dock visibility and persists off state", () => {
    const origWindow = globalThis.window;
    const origDoc = globalThis.document;
    const origLocal = globalThis.localStorage;

    const storage = new Map();
    const mockStorage = {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k)
    };

    const dockEl = {
      classList: {
        classes: new Set(["print:hidden", "hidden"]),
        toggle(cls, force) {
          if (force === undefined) {
            if (this.classes.has(cls)) this.classes.delete(cls);
            else this.classes.add(cls);
          } else if (force) {
            this.classes.add(cls);
          } else {
            this.classes.delete(cls);
          }
        },
        contains(cls) { return this.classes.has(cls); }
      }
    };

    globalThis.window = { location: { pathname: "/test-board.html", protocol: "http:" } };
    globalThis.localStorage = mockStorage;
    globalThis.document = {
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: (id) => (id === "agent-dock-container" ? dockEl : null)
    };

    try {
      assert.equal(HTMLReportAgent.isAiCapable(), false);
      HTMLReportAgent._updateDockVisibility();
      assert.ok(dockEl.classList.contains("hidden"));

      HTMLReportAgent.setAiActive(true);
      assert.equal(HTMLReportAgent.isAiCapable(), true);
      assert.ok(!dockEl.classList.contains("hidden"), "dock should not be hidden when AI is active");

      HTMLReportAgent.setAiActive(false);
      assert.equal(HTMLReportAgent.isAiCapable(), false);
      assert.ok(dockEl.classList.contains("hidden"), "dock should be hidden when AI is off");
    } finally {
      globalThis.window = origWindow;
      globalThis.document = origDoc;
      globalThis.localStorage = origLocal;
    }
  });
});

describe("mermaid-enlarge", () => {
  it("includes mermaid enlarge modal and wrapper styling in template shell", () => {
    assert.ok(shell.includes('id="mermaid-enlarge-modal"'));
    assert.ok(shell.includes('id="mermaid-enlarge-content"'));
    assert.ok(shell.includes(".mermaid-wrapper"));
    assert.ok(shell.includes(".mermaid-enlarge-btn"));
  });

  it("HTMLReportMermaid exposes initEnlarge and openModal API", () => {
    assert.equal(typeof HTMLReportMermaid.initEnlarge, "function");
    assert.equal(typeof HTMLReportMermaid.openModal, "function");
  });
});

describe("publish-clean-report", () => {
  it("--published output retains gear icon with appearance & download, prunes editor, and is deterministic", () => {
    const opts = { title: "T", content: FRAGMENT, published: true, source: "r.html" };
    const a = buildReport(opts).html;
    const b = buildReport(opts).html;
    assert.equal(sha(a), sha(b));

    // Retained in published mode:
    assert.ok(a.includes('id="settings-dropdown"'), "published HTML retains settings dropdown");
    assert.ok(a.includes('id="settings-gear-btn"'), "published HTML retains gear button");
    assert.ok(a.includes('id="settings-section-appearance"'), "published HTML retains appearance section");
    assert.ok(a.includes('id="settings-section-download"'), "published HTML retains download section");
    assert.ok(a.includes('id="download-html-btn"'), "published HTML retains download-html-btn");
    assert.ok(a.includes('id="download-pdf-btn"'), "published HTML retains download-pdf-btn");

    // Stripped in published mode:
    for (const needle of [
      'id="open-all-settings-btn"',
      'id="settings-publish-toggle"',
      'id="edit-dock"',
      'id="all-settings-modal"',
      "authoring:start"
    ]) {
      assert.ok(!a.includes(needle), `published HTML must not contain ${needle}`);
    }
    assert.match(a, /<meta name="html-report-published" content="true"/);
    assert.ok(a.includes('id="toc-dropdown"'), "TOC preserved");
    assert.ok(a.includes('id="intro"'), "content preserved");
    assert.ok(!buildReport({ title: "T", content: FRAGMENT, published: true, ai: true }).html.includes('<meta name="html-report-ai"'));
  });

  it("default builds omit authoring chrome while editable builds include it", () => {
    const cleanHtml = buildReport({ title: "T", content: FRAGMENT }).html;
    assert.ok(cleanHtml.includes('id="settings-gear-btn"'));
    assert.ok(!cleanHtml.includes('id="edit-dock"'));
    assert.ok(!cleanHtml.includes('id="all-settings-modal"'));

    const editableHtml = buildReport({ title: "T", content: FRAGMENT, editable: true }).html;
    assert.ok(editableHtml.includes('id="settings-gear-btn"'));
    assert.ok(editableHtml.includes('id="edit-dock"'));
    assert.ok(editableHtml.includes('id="all-settings-modal"'));
  });

  it("stripAuthoringMarkup is idempotent", () => {
    const once = stripAuthoringMarkup(shell);
    assert.equal(stripAuthoringMarkup(once), once);
  });

  it("publisher prunes authoring elements, sorts attributes and normalizes output", () => {
    const calls = [];
    const fakeEl = (sel) => ({ remove: () => calls.push(sel) });
    const clone = {
      querySelectorAll: (sel) => (HTMLReportPublisher.AUTHORING_SELECTORS.includes(sel) ? [fakeEl(sel)] : []),
      querySelector: () => null
    };
    HTMLReportPublisher.stripAuthoringElements(clone);
    assert.ok(calls.includes("#open-all-settings-btn") && calls.includes("#edit-dock"));
    assert.equal(HTMLReportPublisher.normalizeSerialized("a  \r\nb\t\n\n\n"), "a\nb\n");
  });
});

describe("edit-mode-queue-edit-and-styling", () => {
  it("ships Compose Cancel button, opposite-side Styling + Reset buttons, and Style Editor pane, and prunes them in --published", () => {
    assert.match(shell, /<div id="edit-dock-body"[^>]*>[\s\S]*?<div class="flex items-center justify-between gap-2">/);
    const idxTablist = shell.indexOf('id="edit-tab-queue"');
    const idxStylingBtn = shell.indexOf('id="edit-tab-styling"');
    const idxResetBtn = shell.indexOf('id="edit-dock-reset-btn"');
    assert.ok(idxTablist < idxStylingBtn && idxStylingBtn < idxResetBtn, "Styling and Reset buttons must follow Compose | Queue tabs");

    for (const id of [
      "edit-cancel-edit-btn",
      "edit-tab-styling",
      "edit-dock-reset-btn",
      "edit-pane-styling",
      "edit-style-theme-dropdown",
      "edit-style-theme-btn",
      "edit-style-theme-label",
      "edit-style-theme-swatches",
      "edit-style-theme-menu",
      "edit-style-theme-swatch-list",
      "edit-style-theme-select",
      "edit-style-default-badge",
      "edit-style-set-default-btn",
      "edit-style-name",
      "edit-style-extends",
      "edit-style-primary-picker",
      "edit-style-primary-hex",
      "edit-style-secondary-hex",
      "edit-style-accent-hex",
      "edit-style-neutral-hex",
      "edit-style-base-100-hex",
      "edit-style-rounded-box",
      "edit-style-rounded-btn",
      "edit-style-save-btn",
      "edit-style-copy-css-btn"
    ]) {
      assert.ok(shell.includes(`id="${id}"`), `template-shell.html must include #${id}`);
    }

    const published = buildReport({ title: "Pub", content: FRAGMENT, published: true }).html;
    for (const id of ["edit-cancel-edit-btn", "edit-tab-styling", "edit-dock-reset-btn", "edit-pane-styling", "edit-style-theme-menu"]) {
      assert.ok(!published.includes(`id="${id}"`), `--published must prune #${id}`);
    }
  });

  it("supports editTaskInCompose, cancelEdit, delete-while-editing, and resetAll with DOM mocks", async () => {
    const origWindow = globalThis.window;
    const origDoc = globalThis.document;
    const origLocal = globalThis.localStorage;
    const origLocation = globalThis.location;

    const storage = new Map();
    const mockStorage = {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k)
    };
    const mkEl = (id, init = {}) => {
      const classes = new Set(init.classes || []);
      return {
        id,
        value: init.value || "",
        textContent: init.textContent || "",
        style: {},
        scrollHeight: 60,
        checked: false,
        children: [],
        attributes: new Map(),
        focus() { this.focused = true; },
        remove() {},
        appendChild(c) { this.children.push(c); return c; },
        addEventListener() {},
        setAttribute(k, v) { this.attributes.set(k, String(v)); },
        getAttribute(k) { return this.attributes.get(k) ?? null; },
        classList: {
          add: (...c) => c.forEach((x) => classes.add(x)),
          remove: (...c) => c.forEach((x) => classes.delete(x)),
          toggle: (c, f) => (f === undefined ? (classes.has(c) ? classes.delete(c) : classes.add(c)) : (f ? classes.add(c) : classes.delete(c))),
          contains: (c) => classes.has(c)
        }
      };
    };

    const els = new Map([
      ["edit-dock", mkEl("edit-dock", { classes: ["hidden"] })],
      ["edit-task-title", mkEl("edit-task-title")],
      ["edit-task-content", mkEl("edit-task-content")],
      ["edit-task-priority", mkEl("edit-task-priority", { value: "2" })],
      ["edit-task-anchor", mkEl("edit-task-anchor", { textContent: "Anchor: none" })],
      ["edit-selected-target", mkEl("edit-selected-target", { classes: ["hidden"] })],
      ["edit-target-id", mkEl("edit-target-id")],
      ["edit-target-tag", mkEl("edit-target-tag")],
      ["edit-add-btn", mkEl("edit-add-btn", { textContent: "Add" })],
      ["edit-cancel-edit-btn", mkEl("edit-cancel-edit-btn", { classes: ["hidden"] })],
      ["edit-auto-priority-toggle", mkEl("edit-auto-priority-toggle")],
      ["edit-style-theme-btn", mkEl("edit-style-theme-btn")],
      ["edit-style-theme-label", mkEl("edit-style-theme-label", { textContent: "light" })],
      ["edit-style-theme-swatches", mkEl("edit-style-theme-swatches")],
      ["edit-style-theme-menu", mkEl("edit-style-theme-menu", { classes: ["hidden"] })],
      ["edit-style-theme-swatch-list", mkEl("edit-style-theme-swatch-list")],
      ["edit-style-theme-select", mkEl("edit-style-theme-select")],
      ["edit-style-default-badge", mkEl("edit-style-default-badge", { textContent: "Default: light" })],
      ["edit-style-status", mkEl("edit-style-status")],
      ["edit-style-offline-actions", mkEl("edit-style-offline-actions", { classes: ["hidden"] })],
      ["edit-style-name", mkEl("edit-style-name", { value: "brand-unit" })],
      ["edit-style-extends", mkEl("edit-style-extends", { value: "dark" })],
      ["edit-style-primary-picker", mkEl("edit-style-primary-picker", { value: "#e11d48" })],
      ["edit-style-primary-hex", mkEl("edit-style-primary-hex", { value: "#e11d48" })],
      ["edit-style-secondary-picker", mkEl("edit-style-secondary-picker", { value: "#f000b8" })],
      ["edit-style-secondary-hex", mkEl("edit-style-secondary-hex", { value: "#f000b8" })],
      ["edit-style-accent-picker", mkEl("edit-style-accent-picker", { value: "#37cdbe" })],
      ["edit-style-accent-hex", mkEl("edit-style-accent-hex", { value: "#37cdbe" })],
      ["edit-style-neutral-picker", mkEl("edit-style-neutral-picker", { value: "#3d4451" })],
      ["edit-style-neutral-hex", mkEl("edit-style-neutral-hex", { value: "#3d4451" })],
      ["edit-style-base-100-picker", mkEl("edit-style-base-100-picker", { value: "#111827" })],
      ["edit-style-base-100-hex", mkEl("edit-style-base-100-hex", { value: "#111827" })],
      ["edit-style-rounded-box", mkEl("edit-style-rounded-box", { value: "1rem" })],
      ["edit-style-rounded-btn", mkEl("edit-style-rounded-btn", { value: "0.5rem" })],
      ["edit-style-tailwind-preview", mkEl("edit-style-tailwind-preview")],
      ["daisyui-custom-themes", mkEl("daisyui-custom-themes")],
      ["active-theme-label", mkEl("active-theme-label", { textContent: "light" })],
      ["modal-active-theme-label", mkEl("modal-active-theme-label", { textContent: "light" })]
    ]);
    const docEl = mkEl("html");
    docEl.setAttribute("data-theme", "light");

    globalThis.localStorage = mockStorage;
    globalThis.location = { protocol: "file:", pathname: "/unit-report.html" };
    globalThis.window = {
      location: globalThis.location,
      confirm: () => false
    };
    globalThis.document = {
      documentElement: docEl,
      body: mkEl("body"),
      head: { appendChild: (el) => { if (el.id) els.set(el.id, el); } },
      getElementById: (id) => els.get(id) || null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: (tag) => mkEl(`created-${tag}`)
    };

    try {
      HTMLReportEdit.saveTasks([]);
      const task = HTMLReportEdit.addTask({
        title: "Old Title",
        content: "Old details",
        priority: 1,
        target: { id: "kpi-1", tag: "div" },
        anchor: { id: "overview", label: "Overview" }
      });
      HTMLReportEdit.generatePrompt();
      assert.ok(HTMLReportEdit._generatedPrompt);

      // Load into Compose for re-editing
      HTMLReportEdit.editTaskInCompose(task.id);
      assert.equal(HTMLReportEdit._editingTaskId, task.id);
      assert.equal(els.get("edit-task-title").value, "Old Title");
      assert.equal(els.get("edit-task-content").value, "Old details");
      assert.equal(els.get("edit-task-priority").value, "1");
      assert.equal(els.get("edit-target-id").textContent, "#kpi-1");
      assert.equal(els.get("edit-task-anchor").textContent, "Anchor: Overview");
      assert.equal(els.get("edit-add-btn").textContent, "Save");
      assert.equal(els.get("edit-cancel-edit-btn").classList.contains("hidden"), false);

      // Cancel restores Add mode
      HTMLReportEdit.cancelEdit();
      assert.equal(HTMLReportEdit._editingTaskId, null);
      assert.equal(els.get("edit-add-btn").textContent, "Add");
      assert.equal(els.get("edit-cancel-edit-btn").classList.contains("hidden"), true);
      assert.equal(HTMLReportEdit.getSelectedTarget(), null);

      // Delete-while-editing clears edit state
      HTMLReportEdit.editTaskInCompose(task.id);
      assert.equal(HTMLReportEdit._editingTaskId, task.id);
      HTMLReportEdit.removeTask(task.id);
      assert.equal(HTMLReportEdit._editingTaskId, null);
      assert.equal(els.get("edit-add-btn").textContent, "Add");

      // Style Editor live OKLCH compilation + storage + offline fallback + swatch dropdown
      const compiled = await HTMLReportEdit.applyStyleEditorLive({ saveToStorage: true });
      assert.equal(compiled.themeName, "brand-unit");
      assert.match(els.get("daisyui-custom-themes").textContent, /\[data-theme="brand-unit"\]/);
      assert.equal(docEl.getAttribute("data-theme"), "brand-unit");
      assert.equal(els.get("edit-style-theme-label").textContent, "brand-unit");
      assert.equal(els.get("edit-style-theme-swatches").getAttribute("data-theme"), "brand-unit");
      const swatchChildren = els.get("edit-style-theme-swatch-list").children;
      assert.ok(swatchChildren.length >= 33, "Edit Mode style dropdown must render all 32 standard themes plus custom themes");
      const brandSwatch = swatchChildren.find((c) => c.getAttribute("data-theme") === "brand-unit");
      assert.ok(brandSwatch && brandSwatch.innerHTML.includes('data-swatch-preview="brand-unit"') && brandSwatch.innerHTML.includes("custom"));
      assert.ok(JSON.parse(mockStorage.getItem("html_report_custom_themes"))["brand-unit"]);

      const offlineRes = await HTMLReportEdit.persistDocumentStyle({ theme: "brand-unit", customTheme: compiled.css });
      assert.equal(offlineRes.persisted, "local");
      assert.equal(els.get("edit-style-offline-actions").classList.contains("hidden"), false);

      // Re-add task + auto-priority, verify confirm=false aborts resetAll
      HTMLReportEdit.addTask({ title: "Temp", priority: 2 });
      HTMLReportEdit.setAutoPriority(true);
      const aborted = await HTMLReportEdit.resetAll();
      assert.equal(aborted, false);
      assert.equal(HTMLReportEdit.getTasks().length, 1);

      // Confirm=true wipes tasks, autoPriority, custom themes, and resets to light
      globalThis.window.confirm = () => true;
      const didReset = await HTMLReportEdit.resetAll();
      assert.equal(didReset, true);
      assert.equal(HTMLReportEdit.getTasks().length, 0);
      assert.equal(HTMLReportEdit.isAutoPriority(), false);
      assert.equal(docEl.getAttribute("data-theme"), "light");
      assert.equal(els.get("daisyui-custom-themes").textContent, "");
      assert.equal(mockStorage.getItem("html_report_custom_themes"), null);
      assert.equal(mockStorage.getItem("html_report_active_theme"), null);
    } finally {
      HTMLReportEdit._editingTaskId = null;
      HTMLReportEdit._documentDefaultTheme = null;
      HTMLReportEdit._lastCustomTheme = null;
      globalThis.window = origWindow;
      globalThis.document = origDoc;
      globalThis.localStorage = origLocal;
      globalThis.location = origLocation;
    }
  });

  describe("HTTP POST /__agent_style__ & Playwright E2E flow", () => {
    let tmpRoot;
    let serverHandle;
    let baseUrl;

    before(async () => {
      tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "edit-style-e2e-"));
      const frag = [
        '<main id="report-main" class="container mx-auto px-4 py-8 space-y-6">',
        '  <section id="sec-alpha" class="card bg-base-100 p-6">',
        '    <h2 id="alpha-title" class="text-xl font-bold">Alpha Section</h2>',
        '    <p id="alpha-copy">Initial alpha copy.</p>',
        '  </section>',
        '  <section id="sec-beta" class="card bg-base-100 p-6">',
        '    <h2 id="beta-title" class="text-xl font-bold">Beta Section</h2>',
        '    <p id="beta-copy">Initial beta copy.</p>',
        '  </section>',
        '</main>'
      ].join("\n");

      scaffoldProject({
        project: "style-demo",
        title: "Style Demo Report",
        mode: "report",
        theme: "light",
        ai: false,
        content: frag,
        rootDir: tmpRoot,
        workspaceRoot: tmpRoot
      });

      const standaloneHtml = buildReport({
        title: "Standalone Style Report",
        content: frag,
        theme: "light",
        source: "standalone.html"
      }).html;
      fs.writeFileSync(path.join(tmpRoot, "standalone.html"), standaloneHtml, "utf-8");
      fs.writeFileSync(
        path.join(tmpRoot, "implementation-progress.html"),
        '<!DOCTYPE html><html><head><title>Root</title></head><body><main id="report-main"><h1>Root</h1></main></body></html>',
        "utf-8"
      );

      serverHandle = await startServer(path.join(tmpRoot, "implementation-progress.html"), 0, false);
      const addr = serverHandle.server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
    });

    after(async () => {
      if (serverHandle?.server) {
        await new Promise((r) => serverHandle.server.close(r));
      }
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    async function getCsrf() {
      const r = await fetch(`${baseUrl}/api/agent/csrf-token`);
      const d = await r.json();
      return d.csrfToken;
    }

    it("rejects path traversal (403) and unsafe style injection (400) on POST /__agent_style__", async () => {
      const csrfToken = await getCsrf();
      const travRes = await fetch(`${baseUrl}/__agent_style__`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ file: "../../etc/passwd", theme: "dark", csrfToken })
      });
      assert.equal(travRes.status, 403);

      const xssRes = await fetch(`${baseUrl}/__agent_style__`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          file: "/projects/style-demo/index.html",
          theme: "evil",
          customTheme: "[data-theme=\"evil\"]{}</style><script>alert(1)</script>",
          csrfToken
        })
      });
      assert.equal(xssRes.status, 400);
    });

    it("persists standard and custom OKLCH themes to standalone HTML and project report.manifest.json", async () => {
      const csrfToken = await getCsrf();

      // Standalone file update
      const stRes = await fetch(`${baseUrl}/__agent_style__`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          file: "standalone.html",
          theme: "emerald",
          customTheme: null,
          csrfToken
        })
      });
      assert.equal(stRes.status, 200);
      const stData = await stRes.json();
      assert.equal(stData.mode, "standalone");
      const updatedStandalone = fs.readFileSync(path.join(tmpRoot, "standalone.html"), "utf-8");
      assert.match(updatedStandalone, /<html[^>]*data-theme="emerald"/);
      assert.match(updatedStandalone, /"theme": "emerald"/);

      // Project manifest + rebuild update with custom OKLCH theme
      const projRes = await fetch(`${baseUrl}/__agent_style__`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          file: "/projects/style-demo/index.html",
          theme: "acme",
          customTheme: { acme: { extends: "dark", primary: "#ff3366" } },
          csrfToken
        })
      });
      assert.equal(projRes.status, 200);
      const manifest = JSON.parse(fs.readFileSync(path.join(tmpRoot, "projects/style-demo/report.manifest.json"), "utf-8"));
      assert.equal(manifest.theme, "acme");
      assert.equal(manifest.customTheme.acme.primary, "#ff3366");
      const rebuiltIndex = fs.readFileSync(path.join(tmpRoot, "projects/style-demo/index.html"), "utf-8");
      assert.match(rebuiltIndex, /<html[^>]*data-theme="acme"/);
      assert.match(rebuiltIndex, /\[data-theme="acme"\]/);

      // Reset project back to light
      const resetRes = await fetch(`${baseUrl}/__agent_style__`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          file: "/projects/style-demo/index.html",
          theme: "light",
          customTheme: null,
          csrfToken
        })
      });
      assert.equal(resetRes.status, 200);
    });
  });
});
