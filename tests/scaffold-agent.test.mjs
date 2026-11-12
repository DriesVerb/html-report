import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stampAgentHooks, buildAgentManifest, buildReport } from "../skills/html-report/scripts/build-report.mjs";
import { scaffoldProject } from "../skills/html-report/scripts/scaffold-project.mjs";
import runtimeApi from "../skills/html-report/assets/report-runtime.js";

const REPO_ROOT = process.cwd();

describe("Project Scaffolding & Deterministic Agent-Facing Hooks", () => {
  it("stampAgentHooks deterministically stamps sections and widgets and is idempotent", () => {
    const sample = `
      <main id="report-main">
        <section id="exec-summary">
          <h2>Executive Summary</h2>
          <div class="stats">
            <div class="stat"><div class="stat-title">Revenue</div><div class="stat-value">$1.2M</div></div>
            <div class="stat"><div class="stat-title">Growth</div><div class="stat-value">+18%</div></div>
          </div>
          <canvas id="rev-chart"></canvas>
        </section>
        <section>
          <h2>System Flow</h2>
          <div class="mermaid">graph TD; A-->B;</div>
          <table><thead><tr><th>Key</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>
        </section>
      </main>
    `;

    const first = stampAgentHooks(sample);
    const second = stampAgentHooks(first.html);

    assert.equal(first.html, second.html, "stampAgentHooks must be 100% idempotent");
    assert.deepEqual(first.sections, second.sections, "extracted sections must be identical across runs");
    assert.deepEqual(first.widgets, second.widgets, "extracted widgets must be identical across runs");

    assert.equal(first.sections.length, 2);
    assert.equal(first.sections[0].slug, "executive-summary");
    assert.equal(first.sections[0].selector, "#exec-summary");
    assert.equal(first.sections[1].slug, "system-flow");
    assert.equal(first.sections[1].selector, '[data-agent-id="section-2"]');

    assert.equal(first.widgets.length, 5);
    assert.deepEqual(
      first.widgets.map((w) => w.type),
      ["kpi", "kpi", "chart", "mermaid", "table"]
    );
    assert.equal(first.widgets[2].selector, "#rev-chart");
  });

  it("buildReport embeds #agent-manifest JSON and data-agent-* attributes deterministically", () => {
    const fragment = `<main id="report-main"><section id="intro"><h1>Metrics</h1><canvas id="c1"></canvas></section></main>`;
    const builtA = buildReport({
      title: "Deterministic Test",
      content: fragment,
      project: "det-test",
      mode: "report",
      theme: "light",
      ai: true
    });
    const builtB = buildReport({
      title: "Deterministic Test",
      content: fragment,
      project: "det-test",
      mode: "report",
      theme: "light",
      ai: true
    });

    assert.equal(builtA.html, builtB.html, "buildReport HTML output must be deterministic");
    assert.match(builtA.html, /<script type="application\/json" id="agent-manifest">/);
    assert.match(builtA.html, /data-agent-section="metrics"/);
    assert.match(builtA.html, /data-agent-widget="chart"/);
    assert.equal(builtA.agentManifest.project, "det-test");
    assert.equal(builtA.agentManifest.aiBridge, true);
    assert.equal(builtA.agentManifest.sections[0].slug, "metrics");
    assert.equal(builtA.agentManifest.widgets[0].selector, "#c1");
  });

  it("scaffoldProject creates fragment.html, index.html, report.manifest.json, and AGENTS.md", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "html-report-scaffold-"));
    try {
      const res = scaffoldProject({
        project: "Foobar Analytics!",
        title: "Foobar Analytics",
        mode: "dashboard",
        theme: "nord",
        addons: ["charts", "mermaid"],
        ai: true,
        workspaceRoot: tmpRoot
      });

      assert.equal(res.slug, "foobar-analytics");
      assert.ok(fs.existsSync(res.files.fragment), "fragment.html must exist");
      assert.ok(fs.existsSync(res.files.entry), "index.html must exist");
      assert.ok(fs.existsSync(res.files.manifest), "report.manifest.json must exist");
      assert.ok(fs.existsSync(res.files.agents), "AGENTS.md must exist");

      const manifest = JSON.parse(fs.readFileSync(res.files.manifest, "utf-8"));
      assert.equal(manifest.project, "foobar-analytics");
      assert.equal(manifest.mode, "dashboard");
      assert.equal(manifest.theme, "nord");
      assert.equal(manifest.aiBridge, true);
      assert.equal(manifest.files.entry, "projects/foobar-analytics/index.html");
      assert.equal(manifest.files.fragment, "projects/foobar-analytics/fragment.html");
      assert.ok(manifest.pipeline.rebuildCommand.includes("--project foobar-analytics"));
      assert.ok(manifest.sections.length >= 2);

      const agentsMd = fs.readFileSync(res.files.agents, "utf-8");
      assert.match(agentsMd, /fragment\.html/);
      assert.match(agentsMd, /report\.manifest\.json/);

      const indexHtml = fs.readFileSync(res.files.entry, "utf-8");
      assert.match(indexHtml, /id="agent-manifest"/);
      assert.match(indexHtml, /meta name="html-report-ai" content="on"/);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("HTMLReportAgent exposes deterministic inspection helpers", () => {
    const { HTMLReportAgent } = runtimeApi;
    assert.equal(typeof HTMLReportAgent.getManifest, "function");
    assert.equal(typeof HTMLReportAgent.getSections, "function");
    assert.equal(typeof HTMLReportAgent.getWidgets, "function");
    assert.equal(typeof HTMLReportAgent.scrollToAgent, "function");
    assert.equal(typeof HTMLReportAgent.getEditPrompt, "function");

    const prompt = HTMLReportAgent.getEditPrompt("chart-1", "Update Q4 series");
    assert.match(prompt, /Target Element: \[data-agent-id="chart-1"\]/);
    assert.match(prompt, /Instruction: Update Q4 series/);
  });

  it("create.html integrates Two-Way Agent Bridge label and scaffold-project.mjs pipeline", () => {
    const createHtml = fs.readFileSync(path.join(REPO_ROOT, "create.html"), "utf-8");
    const assetCreateHtml = fs.readFileSync(path.join(REPO_ROOT, "skills/html-report/assets/create.html"), "utf-8");
    assert.equal(createHtml, assetCreateHtml, "create.html and skills/html-report/assets/create.html must stay synced");
    assert.match(createHtml, /Two-Way Agent Bridge &amp; AI Dock/);
    assert.match(createHtml, /id="ai-turnkey-config"/);
    assert.match(createHtml, /id="ai-bridge-port"/);
    assert.match(createHtml, /id="ai-bridge-purpose"/);
    assert.match(createHtml, /node skills\/html-report\/scripts\/scaffold-project\.mjs/);
    assert.match(createHtml, /--ai-port \$\{aiPort\}/);
  });

  it("scaffoldProject transfers Turnkey AI connection settings (port, model, persona) into manifest, HTML meta, and AGENTS.md", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "html-report-turnkey-"));
    try {
      const res = scaffoldProject({
        project: "turnkey-ai-test",
        title: "Turnkey AI Test",
        mode: "dashboard",
        ai: true,
        aiPort: 4123,
        aiModel: "Gemini 4 Hydrogen (Medium)",
        aiPersona: "strategist",
        workspaceRoot: tmpRoot
      });

      const manifest = JSON.parse(fs.readFileSync(res.files.manifest, "utf-8"));
      assert.deepEqual(manifest.aiConfig, {
        port: 4123,
        model: "Gemini 4 Hydrogen (Medium)",
        persona: "strategist",
        floatingAssistant: true
      });
      assert.ok(manifest.pipeline.serveCommand.includes("--port 4123"));
      assert.ok(manifest.pipeline.rebuildCommand.includes("--ai-port 4123"));
      assert.ok(manifest.pipeline.rebuildCommand.includes('--ai-model "Gemini 4 Hydrogen (Medium)"'));
      assert.ok(manifest.pipeline.rebuildCommand.includes("--ai-persona strategist"));

      const indexHtml = fs.readFileSync(res.files.entry, "utf-8");
      assert.match(indexHtml, /meta name="html-report-ai-port" content="4123"/);
      assert.match(indexHtml, /meta name="html-report-ai-model" content="Gemini 4 Hydrogen \(Medium\)"/);
      assert.match(indexHtml, /meta name="html-report-ai-persona" content="strategist"/);

      const agentsMd = fs.readFileSync(res.files.agents, "utf-8");
      assert.match(agentsMd, /4123/);
      assert.match(agentsMd, /Gemini 4 Hydrogen \(Medium\)/);
      assert.match(agentsMd, /strategist/);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("create.html exposes Key & Lock AI Handshake (port 3031, board support description, mandatory Part 2 lock)", () => {
    const createHtml = fs.readFileSync(path.join(REPO_ROOT, "create.html"), "utf-8");
    const assetCreateHtml = fs.readFileSync(path.join(REPO_ROOT, "skills/html-report/assets/create.html"), "utf-8");
    assert.equal(createHtml, assetCreateHtml, "create.html and skills/html-report/assets/create.html must stay in sync");
    assert.match(createHtml, /id="ai-bridge-port"[^>]*value="3031"/);
    assert.match(createHtml, /id="ai-bridge-purpose"/);
    assert.match(createHtml, /id="ai-floating-assistant"/);
    assert.match(createHtml, /Activate hovering AI Assistant button/);
    assert.match(createHtml, /--no-ai-dock/);
    assert.match(createHtml, /What should the AI on your board do\?/);
    assert.doesNotMatch(createHtml, /id="ai-bridge-model"/);
    assert.doesNotMatch(createHtml, /id="ai-bridge-persona"/);
    assert.match(createHtml, /id="ai-turnkey-part1-prompt"/);
    assert.match(createHtml, /id="ai-turnkey-reply-prompt"/);
    assert.match(createHtml, /id="ai-turnkey-part2-status"/);
    assert.match(createHtml, /id="ai-turnkey-lock-icon"/);
    assert.match(createHtml, /id="prompt-ready-badge"/);
    assert.match(createHtml, /id="btn-copy-prompt"/);
    assert.match(createHtml, /id="btn-save-prompt"/);
    assert.match(createHtml, /What the AI on this board should do:/);
    assert.match(createHtml, /How to maintain a connection to the board:/);
    assert.match(createHtml, /Reply Prompt to give back \(paste into Step 2 in create\.html to unlock\):/);
    assert.match(createHtml, /The board is NOT scaffolded yet/);
    assert.match(createHtml, /Connection & Keep-Alive Details:/);
    assert.match(createHtml, /Hovering AI Assistant \(⌘K\) Integration Schema:/);
    assert.match(createHtml, /Agent-Side Capabilities & Context:/);
    assert.match(createHtml, /Turnkey Agent Reply \(Scaffold Info & Two-Way Agent Bridge\):/);
    assert.match(createHtml, /--ai-purpose/);
  });

  it("scaffoldProject records floatingAssistant=false and html-report-ai-dock=off when aiDock is false", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "html-report-dock-off-"));
    try {
      const res = scaffoldProject({
        project: "headless-bridge-test",
        title: "Headless Bridge Test",
        mode: "report",
        theme: "light",
        ai: true,
        aiPort: 3031,
        aiDock: false,
        rootDir: tmpRoot
      });
      const manifest = JSON.parse(fs.readFileSync(res.files.manifest, "utf-8"));
      assert.equal(manifest.aiConfig.floatingAssistant, false);
      assert.ok(manifest.pipeline.rebuildCommand.includes("--no-ai-dock"));
      const indexHtml = fs.readFileSync(res.files.entry, "utf-8");
      assert.match(indexHtml, /meta name="html-report-ai-dock" content="off"/);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
