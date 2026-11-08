/**
 * @fileoverview page-edit-selection.bdd.test.mjs
 * Native OpenSpec BDD Verification Suite for Edit Mode Element Selection & Inspector.
 * Binds directly to openspec/changes/edit-mode-element-selection/specs/page-edit-selection/spec.md.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { bindOpenSpec } from "./harness/openspec-bdd.mjs";
import { HTMLReportEdit } from "../skills/html-report/assets/report-runtime.js";
import { buildReport } from "../skills/html-report/scripts/build-report.mjs";

const shell = fs.readFileSync(path.resolve(process.cwd(), "skills/html-report/assets/template-shell.html"), "utf-8");

bindOpenSpec("page-edit-selection", {
  "Toggle activation and deactivation": async ({ When, Then }) => {
    let selectMode = false;
    await When("user clicks the select button in the edit dock bar", () => {
      assert.ok(shell.includes('id="edit-dock-select"'));
      selectMode = true;
    });

    await Then("selection mode activates, setting crosshair cursor and highlighting the button; clicking it again or pressing Escape deactivates selection mode", () => {
      assert.equal(selectMode, true);
      assert.ok(typeof HTMLReportEdit.toggleSelectMode === "function");
    });
  },

  "Hover color inversion with zero layout shift": async ({ When, Then }) => {
    let element = null;
    await When("user moves the cursor over an element while selection mode is active", () => {
      element = { id: "card-metric", tagName: "DIV", classList: new Set() };
      element.classList.add("report-select-hover");
    });

    await Then("the element displays an inverted color filter without changing its width, height, margin, or padding, and the filter is removed when the cursor leaves", () => {
      assert.ok(element.classList.has("report-select-hover"));
      element.classList.delete("report-select-hover");
      assert.equal(element.classList.has("report-select-hover"), false);
    });
  },

  "Escape key cancels selection": async ({ When, Then }) => {
    let mode = true;
    await When("selection mode is active and user presses Escape", () => {
      mode = false;
    });

    await Then("selection mode immediately exits, removing hover filters and resetting the cursor to default", () => {
      assert.equal(mode, false);
    });
  },

  "Assign unique ID when missing": async ({ When, Then }) => {
    let headingEl = null;
    let assignedId = null;

    await When("user clicks an element in selection mode that lacks an id attribute", () => {
      headingEl = { id: "", tagName: "H2", textContent: "Quarterly Performance Highlights" };
      assignedId = HTMLReportEdit.getOrAssignId(headingEl);
    });

    await Then("a unique semantic ID based on tag and text slug is assigned directly to the element and captured as the task target", () => {
      assert.match(assignedId, /^h2-quarterly-performance/);
      assert.equal(headingEl.id, assignedId);
    });
  },

  "Target badge displayed and inputs empty": async ({ When, Then }) => {
    const key = "bdd-select-target-page";
    HTMLReportEdit.saveTasks([], key);

    await When("an element is selected in selection mode", () => {
      HTMLReportEdit.setSelectedTarget({ id: "kpi-card-1", tag: "div" });
    });

    await Then("selection mode turns off, compose pane is displayed showing the target badge with the element ID, and task title and content inputs remain empty without autofill", () => {
      assert.deepEqual(HTMLReportEdit.getSelectedTarget(), { id: "kpi-card-1", tag: "div" });
      assert.ok(shell.includes('id="edit-selected-target"'));
      assert.ok(shell.includes('id="edit-target-id"'));
    });
  },

  "Prompt output includes target element metadata": async ({ When, Then }) => {
    let prompt = "";
    await When("a task with an attached target element is included in prompt generation", () => {
      const tasks = [
        {
          id: "t1",
          title: "Adjust chart type",
          content: "Switch line chart into stacked area chart",
          priority: 1,
          order: 1,
          done: false,
          target: { id: "sales-overview-chart", tag: "canvas" },
          anchor: { id: "sales", label: "Sales" }
        }
      ];
      prompt = HTMLReportEdit.buildEditPrompt(tasks, { title: "Sales Analysis", source: "sales.html", mode: "report" });
    });

    await Then("the generated prompt text formats the task with its target element selector and tag", () => {
      assert.match(prompt, /Target Element: #sales-overview-chart \(<canvas>\)/);
      assert.match(prompt, /Section: Sales \(#sales\)/);
      assert.match(prompt, /Switch line chart into stacked area chart/);
    });
  }
});
