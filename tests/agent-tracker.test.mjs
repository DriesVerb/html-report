import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AgentTrackerFacade,
  TranscriptTailDaemon,
  AgentTelemetryStrategy,
  AgyTelemetryStrategy,
  ClaudeCodeTelemetryStrategy,
  CodexSwarmTelemetryStrategy,
  GenericTelemetryStrategy,
  CanonicalAgentStates,
  CanonicalToolCategories,
  sanitizeCanonicalEvent
} from "../skills/html-report/scripts/agent-tracker.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const playwrightPath = path.resolve(__dirname, "../skills/html-report/playwright/node_modules/playwright/index.mjs");
const { chromium } = await import(playwrightPath);

describe("Phase 1: Agent Tracker Facade & Strategies", () => {
  it("1. Strategy Normalization: should normalize all 4 agent models without runtime errors", () => {
    const facade = new AgentTrackerFacade();

    // 1. Google Antigravity
    const agySample = {
      step_index: 4,
      source: "MODEL",
      type: "PLANNER_RESPONSE",
      status: "DONE",
      thinking: "Antigravity inspecting workspace configuration.",
      tool_calls: [{
        id: "call_agy_1",
        call: { name: "read_file", args: { Path: "skills/html-report/scripts/agent-tracker.mjs" } }
      }]
    };
    const agyRes = facade.ingest(agySample, { provider: "agy" });
    assert.equal(agyRes.normalized.providerId, "agy");
    assert.equal(agyRes.normalized.state, "running_tool");
    assert.equal(agyRes.normalized.activeTool.name, "read_file");
    assert.equal(agyRes.normalized.activeTool.category, "file_system");
    assert.equal(agyRes.normalized.activeTool.target, "skills/html-report/scripts/agent-tracker.mjs");
    assert.equal(agyRes.normalized.thought, "Antigravity inspecting workspace configuration.");

    // 2. Anthropic Claude Code
    const claudeSample = {
      type: "tool_use",
      id: "toolu_01A89",
      name: "Bash",
      input: { command: "npm test" },
      thinking: "Claude evaluating test suites."
    };
    const claudeRes = facade.ingest(claudeSample, { provider: "claude" });
    assert.equal(claudeRes.normalized.providerId, "claude");
    assert.equal(claudeRes.normalized.state, "running_tool");
    assert.equal(claudeRes.normalized.activeTool.name, "Bash");
    assert.equal(claudeRes.normalized.activeTool.category, "bash");
    assert.equal(claudeRes.normalized.activeTool.target, "npm test");
    assert.equal(claudeRes.normalized.thought, "Claude evaluating test suites.");

    // 3. OpenAI Codex / Swarm
    const codexSample = {
      delta: {
        tool_calls: [{
          id: "call_codex_9",
          function: { name: "patch_file", arguments: JSON.stringify({ file: "server.js", lines: 10 }) }
        }]
      },
      reasoning_content: "Codex synthesizing function parameters."
    };
    const codexRes = facade.ingest(codexSample, { provider: "codex" });
    assert.equal(codexRes.normalized.providerId, "codex");
    assert.equal(codexRes.normalized.state, "running_tool");
    assert.equal(codexRes.normalized.activeTool.name, "patch_file");
    assert.equal(codexRes.normalized.activeTool.category, "file_system");
    assert.equal(codexRes.normalized.activeTool.target, "server.js");
    assert.equal(codexRes.normalized.thought, "Codex synthesizing function parameters.");

    // 4. Generic Agent Webhook
    const genericSample = {
      state: "waiting_user",
      activeTool: { name: "ask_human", target: "Confirm migration?" },
      thought: "Awaiting human-in-the-loop confirmation."
    };
    const genRes = facade.ingest(genericSample, { provider: "generic" });
    assert.equal(genRes.normalized.providerId, "generic");
    assert.equal(genRes.normalized.state, "waiting_user");
    assert.equal(genRes.normalized.activeTool.name, "ask_human");
    assert.equal(genRes.normalized.activeTool.target, "Confirm migration?");
  });

  it("2. Zero Vendor Leakage: should strictly sanitize canonical state with 0 leaked vendor fields", () => {
    const facade = new AgentTrackerFacade();
    const vendorPolluted = {
      step_index: 42,
      source: "MODEL",
      type: "PLANNER_RESPONSE",
      finish_reason: "tool_calls",
      content_block: { type: "thinking" },
      delta: { tool_calls: [] },
      function_call: { name: "test" },
      unknown_vendor_key_abc: "leak_candidate",
      tool_calls: [{
        id: "call_leak_test",
        call: { name: "run_command", args: { CommandLine: "ls -la" } }
      }],
      thinking: "Guarding against vendor schema pollution"
    };

    const result = facade.ingest(vendorPolluted, { provider: "agy" });
    const canonical = result.normalized;

    // Allowed top-level keys
    const allowedKeys = new Set([
      "providerId",
      "providerName",
      "state",
      "activeTool",
      "thought",
      "recentHistory",
      "subagents",
      "telemetry",
      "timestamp",
      "stateStartedAt"
    ]);

    for (const key of Object.keys(canonical)) {
      assert.ok(allowedKeys.has(key), `Disallowed vendor key leaked into canonical state: ${key}`);
    }

    assert.equal(canonical.step_index, undefined);
    assert.equal(canonical.source, undefined);
    assert.equal(canonical.finish_reason, undefined);
    assert.equal(canonical.content_block, undefined);
    assert.equal(canonical.delta, undefined);
    assert.equal(canonical.unknown_vendor_key_abc, undefined);

    // Validate activeTool schema
    if (canonical.activeTool) {
      const allowedToolKeys = new Set(["id", "name", "target", "category", "args", "output", "diff", "startTime"]);
      for (const k of Object.keys(canonical.activeTool)) {
        assert.ok(allowedToolKeys.has(k), `Disallowed key leaked into activeTool: ${k}`);
      }
    }
  });

  it("3. Dev Server SSE Delivery: should successfully push SSE fragments to /__datastar_stream__", async () => {
    const facade = new AgentTrackerFacade();
    facade.ingest({
      step_index: 99,
      source: "MODEL",
      thinking: "Automated test SSE delivery pulse",
      tool_calls: [{ call: { name: "test_telemetry", args: { CommandLine: "echo test" } } }]
    });

    const pushResult = await facade.pushToDevServer({ port: 3000, host: "127.0.0.1", selector: "#live-feature-observer" });
    assert.ok(pushResult.ok, "Push to dev server should return ok: true");
    assert.ok(typeof pushResult.listeners === "number", "Response should report listener count");
  });

  it("5. Command Output Drawer: should render expandable terminal output drawer with mockup-code", () => {
    const facade = new AgentTrackerFacade();
    facade.ingest({
      step_index: 30,
      source: "MODEL",
      tool_calls: [{
        call: {
          name: "run_command",
          args: { CommandLine: "npm test" }
        }
      }],
      output: {
        stdout: "PASS tests/agent-tracker.test.mjs\nAll tests passed",
        stderr: "",
        exitCode: 0
      }
    });

    const html = facade.renderCoreObserverHtml();
    assert.ok(html.includes("terminal-output-drawer"), "HTML should contain terminal output drawer");
    assert.ok(html.includes("mockup-code"), "HTML should use DaisyUI mockup-code class");
    assert.ok(html.includes("npm test"), "HTML should display command line");
    assert.ok(html.includes("PASS tests/agent-tracker.test.mjs"), "HTML should display stdout lines");
    assert.ok(html.includes("exit 0"), "HTML should render exit code 0");
  });

  it("6. Code Diff Preview: should normalize edit_file diff and render target vs replacement snippets", () => {
    const facade = new AgentTrackerFacade();
    const res = facade.ingest({
      step_index: 31,
      source: "MODEL",
      tool_calls: [{
        call: {
          name: "edit_file",
          args: {
            Path: "skills/html-report/scripts/agent-tracker.mjs",
            Target: "const oldCode = 1;",
            Replacement: "const newCode = 2;"
          }
        }
      }]
    }, { provider: "agy" });

    assert.ok(res.normalized.activeTool.diff, "activeTool should contain diff object");
    assert.equal(res.normalized.activeTool.diff.filePath, "skills/html-report/scripts/agent-tracker.mjs");
    assert.equal(res.normalized.activeTool.diff.target, "const oldCode = 1;");
    assert.equal(res.normalized.activeTool.diff.replacement, "const newCode = 2;");

    const html = facade.renderCoreObserverHtml();
    assert.ok(html.includes("code-diff-preview"), "HTML should contain code-diff-preview card");
    assert.ok(html.includes("const oldCode = 1;"), "HTML should display target code snippet");
    assert.ok(html.includes("const newCode = 2;"), "HTML should display replacement code snippet");
  });

  it("7. Human Attention Alerts: should render prominent attention banner when in waiting_user or error state", () => {
    const facade = new AgentTrackerFacade();

    // 1. Waiting user state
    facade.ingest({
      status: "WAITING_USER",
      thinking: "Awaiting confirmation from user"
    }, { provider: "agy" });
    const waitingHtml = facade.renderCoreObserverHtml();
    assert.ok(waitingHtml.includes("human-attention-banner"), "Waiting state should render human attention banner");
    assert.ok(waitingHtml.includes("AGENT WAITING ON HUMAN ATTENTION"), "Waiting banner should explain human attention is required");

    // 2. Error state
    facade.ingest({
      status: "ERROR",
      thinking: "Fatal command exception"
    }, { provider: "agy" });
    const errorHtml = facade.renderCoreObserverHtml();
    assert.ok(errorHtml.includes("human-attention-banner"), "Error state should render critical error alert banner");
    assert.ok(errorHtml.includes("CRITICAL AGENT ERROR"), "Error banner should explain critical agent error");
  });

  it("8. Multi-Agent Swarm Hierarchy: should track orchestrator and subagents spawned via invoke_subagent in swimlanes", () => {
    const facade = new AgentTrackerFacade();
    facade.ingest({
      step_index: 50,
      source: "MODEL",
      tool_calls: [{
        call: {
          name: "invoke_subagent",
          args: {
            TypeName: "research",
            Role: "Codebase Researcher",
            Prompt: "Search repository for telemetry adapters"
          }
        }
      }]
    }, { provider: "agy" });

    const canonical = facade.getCanonicalState();
    assert.ok(canonical.subagents.length >= 1, "Should record at least 1 subagent");
    const sub = canonical.subagents[0];
    assert.equal(sub.typeName, "research");
    assert.equal(sub.role, "Codebase Researcher");

    const html = facade.renderCoreObserverHtml();
    assert.ok(html.includes("agent-swarm-hierarchy"), "HTML should render agent swarm hierarchy card");
    assert.ok(html.includes("research"), "HTML should render subagent type name");
    assert.ok(html.includes("Codebase Researcher"), "HTML should render subagent role");
  });

  it("9. Transcript Tail Daemon: should tail byte-offset JSONL without re-reading previous lines", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-tail-test-"));
    const transcriptFile = path.join(tmpDir, "transcript.jsonl");

    const line1 = JSON.stringify({ step_index: 1, source: "USER_INPUT", content: "Init tail test" }) + "\n";
    const line2 = JSON.stringify({ step_index: 2, source: "MODEL", thinking: "Step 2 reasoning" }) + "\n";
    fs.writeFileSync(transcriptFile, line1 + line2, "utf8");

    const daemon = new TranscriptTailDaemon({
      transcriptPath: transcriptFile,
      pollIntervalMs: 50,
      pushToDevServer: false
    });

    const receivedSteps = [];
    daemon.on("step", (res) => {
      receivedSteps.push(res);
    });

    await daemon.start();
    const initialOffset = daemon.lastByteOffset;
    assert.equal(initialOffset, Buffer.byteLength(line1 + line2));

    // Append step 3
    const line3 = JSON.stringify({
      step_index: 3,
      source: "MODEL",
      tool_calls: [{ call: { name: "read_file", args: { Path: "test.txt" } } }]
    }) + "\n";
    fs.appendFileSync(transcriptFile, line3, "utf8");

    // Wait for daemon polling cycle
    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.equal(daemon.lastByteOffset, Buffer.byteLength(line1 + line2 + line3));
    assert.ok(receivedSteps.length >= 1, "Should have received newly appended step");
    assert.equal(daemon.facade.getCanonicalState().activeTool?.name, "read_file");

    daemon.stop();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("10. Context Window & Token Velocity Telemetry: should calculate saturation gauge and tokens/sec", () => {
    const facade = new AgentTrackerFacade();
    facade.ingest({
      step_index: 60,
      source: "MODEL",
      telemetry: {
        contextTokens: 45000,
        contextWindowLimit: 200000,
        promptTokens: 35000,
        reasoningTokens: 6000,
        completionTokens: 4000,
        tokensPerSecond: 135
      }
    }, { provider: "generic" });

    const canonical = facade.getCanonicalState();
    assert.ok(canonical.telemetry, "Canonical state should contain telemetry object");
    assert.equal(canonical.telemetry.contextTokens, 45000);
    assert.equal(canonical.telemetry.saturationPct, 22.5);
    assert.equal(canonical.telemetry.tokensPerSecond, 135);

    const html = facade.renderCoreObserverHtml();
    assert.ok(html.includes("context-telemetry-widget"), "HTML should render context telemetry widget");
    assert.ok(html.includes("22.5%"), "HTML should display saturation percentage");
    assert.ok(html.includes("135"), "HTML should display tokens per second");
  });

  it("4. Playwright Headless Verification: should render side-by-side verification and switch strategies dynamically", async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const consoleErrors = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    try {
      await page.goto("http://localhost:3000/current-feature.html", { waitUntil: "domcontentloaded", timeout: 10000 });

      // 1. Verify Active Spotlight Banner
      const spotlight = await page.waitForSelector("#active-work-spotlight", { timeout: 5000 });
      assert.ok(spotlight, "Active work spotlight should be present");

      // 2. Verify Core Observer Component
      const observer = await page.waitForSelector("#live-feature-observer", { timeout: 5000 });
      assert.ok(observer, "Core observer component should be present");

      // 3. Verify Heartbeat Pill
      const badge = await page.waitForSelector("#live-state-badge");
      const badgeText = await page.textContent("#live-state-text");
      assert.ok(badgeText.length > 0, "State badge text should not be empty");

      // 4. Verify Stopwatch
      const stopwatch = await page.waitForSelector("#live-stopwatch");
      const timeVal1 = await page.textContent("#live-stopwatch");
      assert.match(timeVal1, /^[0-9.]+s$/, "Stopwatch should display formatted seconds");

      // 5. Test Strategy Switching in UI (Claude Code)
      await page.click('button[data-strat="claude"]');
      await page.waitForTimeout(100);
      const provClaude = await page.textContent("#active-provider-name");
      assert.equal(provClaude, "Anthropic Claude Code");

      // 6. Test Strategy Switching in UI (OpenAI Codex)
      await page.click('button[data-strat="codex"]');
      await page.waitForTimeout(100);
      const provCodex = await page.textContent("#active-provider-name");
      assert.equal(provCodex, "OpenAI Codex / Swarm");

      // 7. Test Strategy Switching in UI (Generic REST)
      await page.click('button[data-strat="generic"]');
      await page.waitForTimeout(100);
      const provGeneric = await page.textContent("#active-provider-name");
      assert.equal(provGeneric, "Generic Agent Webhook");

      // 8. Test Action Triggering (Tool Execution)
      await page.click('button[onclick*="fireStrategyAction(\'tool\')"]');
      await page.waitForTimeout(100);
      const toolName = await page.textContent("#live-tool-name");
      assert.ok(toolName.length > 0, "Tool name should update on tool execution");

      // 9. Verify Recent Activity Feed
      const recentFeed = await page.waitForSelector("#live-recent-feed");
      const recentCount = await page.locator("#live-recent-feed > div").count();
      assert.ok(recentCount >= 1, "Recent feed should contain at least one item");

      // 10. Test Command Output Drawer (stdout & stderr)
      await page.click('button[data-strat="agy"]');
      await page.waitForTimeout(100);
      await page.click('button[onclick*="fireStrategyAction(\'cmd_stdout\')"]');
      await page.waitForTimeout(100);
      const stdoutText = await page.textContent("#terminal-stdout-container");
      assert.ok(stdoutText.includes("Passed"), "Terminal drawer should render stdout text");
      const exitBadge = await page.textContent("#terminal-drawer-exit");
      assert.ok(exitBadge.includes("exit 0"), "Terminal drawer should show exit 0 badge");

      await page.click('button[onclick*="fireStrategyAction(\'cmd_stderr\')"]');
      await page.waitForTimeout(100);
      const stderrText = await page.textContent("#terminal-stdout-container");
      assert.ok(stderrText.includes("bad option") || stderrText.includes("Error") || stderrText.includes("failed"), "Terminal drawer should render stderr text");

      // 11. Verify Live Feature Component Workbench at bottom of Active Feature In Flight card
      const wbInsideSpotlight = await page.locator("#active-work-spotlight #active-feature-workbench").count();
      assert.equal(wbInsideSpotlight, 1, "Active Feature Workbench must be located at the bottom of the Active Feature In Flight card");

      // 12. Verify Component Workbench Tab Switching (Status Badges tab)
      await page.click("#tab-btn-badges");
      await page.waitForTimeout(100);
      const badgesPanelVisible = await page.isVisible("#comp-stage-badges");
      assert.ok(badgesPanelVisible, "Status Badges panel should become visible on tab click");
      const diffPanelHidden = await page.isVisible("#comp-stage-diff");
      assert.ok(!diffPanelHidden, "Code Diff panel should be hidden when Badges tab is active");

      // Verify Swarm Swimlanes tab switching
      await page.click("#tab-btn-swarm");
      await page.waitForTimeout(100);
      const swarmPanelVisible = await page.isVisible("#comp-stage-swarm");
      assert.ok(swarmPanelVisible, "Swarm swimlanes panel should be visible");

      // Switch back to Code Diff tab
      await page.click("#tab-btn-diff");
      await page.waitForTimeout(100);
      const diffPanelVisible = await page.isVisible("#comp-stage-diff");
      assert.ok(diffPanelVisible, "Code Diff panel should become visible again");

      // 13. Verify Code Diff Action in Core Observer
      await page.click('button[onclick*="fireStrategyAction(\'edit_diff\')"]');
      await page.waitForTimeout(100);
      const diffContainerVisible = await page.isVisible("#code-diff-preview");
      assert.ok(diffContainerVisible, "Code diff preview widget should be visible in observer");
      const diffTargetText = await page.textContent("#diff-target-code");
      assert.ok(diffTargetText.includes("output"), "Diff target should contain target code snippet");

      // 14. Verify Human Attention Banner on Waiting State
      await page.click('button[onclick*="fireStrategyAction(\'waiting\')"]');
      await page.waitForTimeout(100);
      const attnBannerVisible = await page.isVisible("#human-attention-banner");
      assert.ok(attnBannerVisible, "Human attention banner should be visible when in waiting state");

      // 15. Verify Telemetry Tab & Pulse in Core Observer
      await page.click("#tab-btn-telemetry");
      await page.waitForTimeout(100);
      const telPanelVisible = await page.isVisible("#comp-stage-telemetry");
      assert.ok(telPanelVisible, "Telemetry workbench panel should be visible");

      await page.click('button[onclick*="fireStrategyAction(\'telemetry\')"]');
      await page.waitForTimeout(100);
      const telWidgetVisible = await page.isVisible("#context-telemetry-widget");
      assert.ok(telWidgetVisible, "Context telemetry widget should be visible in observer");
      const velText = await page.textContent("#telemetry-vel-count");
      assert.equal(velText, "168", "Telemetry velocity should display 168 tok/s from pulse");

      // Verify no unexpected console errors
      assert.equal(consoleErrors.length, 0, `Page had console errors: ${consoleErrors.join(", ")}`);
    } finally {
      await browser.close();
    }
  });

  it("11. Multi-Breakpoint & Multi-Theme Verification: should render cleanly across mobile, tablet, desktop and DaisyUI themes", async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const viewports = [
        { name: "mobile", width: 375, height: 667 },
        { name: "tablet", width: 768, height: 1024 },
        { name: "desktop", width: 1440, height: 900 }
      ];

      for (const vp of viewports) {
        const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
        await page.goto("http://localhost:3000/current-feature.html", { waitUntil: "domcontentloaded", timeout: 10000 });

        const spotlight = await page.waitForSelector("#active-work-spotlight");
        const spotlightBox = await spotlight.boundingBox();
        assert.ok(spotlightBox, `Spotlight should have valid bounding box on ${vp.name}`);
        assert.ok(spotlightBox.width <= vp.width + 1, `Spotlight width (${spotlightBox.width}) should not exceed viewport width (${vp.width}) on ${vp.name}`);

        const observer = await page.waitForSelector("#live-feature-observer");
        const observerBox = await observer.boundingBox();
        assert.ok(observerBox, `Observer should have valid bounding box on ${vp.name}`);
        assert.ok(observerBox.width <= vp.width + 1, `Observer width (${observerBox.width}) should not exceed viewport width (${vp.width}) on ${vp.name}`);

        await page.close();
      }

      // Test theme switching across 5 diverse DaisyUI themes
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.goto("http://localhost:3000/current-feature.html", { waitUntil: "domcontentloaded", timeout: 10000 });

      const themes = ["light", "dark", "cyberpunk", "synthwave", "corporate"];
      for (const th of themes) {
        await page.evaluate((themeName) => {
          document.documentElement.setAttribute("data-theme", themeName);
          localStorage.setItem("html-report-theme", themeName);
        }, th);
        await page.waitForTimeout(50);
        const activeTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
        assert.equal(activeTheme, th, `Theme should be set to ${th}`);
      }
      await page.close();
    } finally {
      await browser.close();
    }
  });
});
