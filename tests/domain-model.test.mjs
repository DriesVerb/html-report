import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DAISYUI_THEMES,
  TARGET_DEFINITIONS,
  ADDON_CATALOG,
  normalizeTarget,
  normalizeDomainConfig,
  resolveSiblingSkill,
  generateCliCommand,
  generateDeterministicPrompt
} from "../skills/html-report/scripts/domain-model.mjs";

describe("Domain Model: Target Normalization & Constants", () => {
  it("should contain all 32 standard DaisyUI themes with light defaulting first", () => {
    assert.equal(DAISYUI_THEMES.length, 32);
    assert.equal(DAISYUI_THEMES[0], "light");
    assert.ok(DAISYUI_THEMES.includes("corporate"));
    assert.ok(DAISYUI_THEMES.includes("dark"));
    assert.ok(DAISYUI_THEMES.includes("synthwave"));
    assert.ok(DAISYUI_THEMES.includes("nord"));
  });

  it("should define all four target formats with metadata", () => {
    assert.ok(TARGET_DEFINITIONS.report);
    assert.ok(TARGET_DEFINITIONS.print);
    assert.ok(TARGET_DEFINITIONS.dashboard);
    assert.ok(TARGET_DEFINITIONS.presentation);

    assert.equal(TARGET_DEFINITIONS.report.skillTag, "@html-report");
    assert.equal(TARGET_DEFINITIONS.print.skillTag, "@html-print");
    assert.equal(TARGET_DEFINITIONS.dashboard.skillTag, "@html-dashboard");
    assert.equal(TARGET_DEFINITIONS.presentation.skillTag, "@html-presentation");
  });

  it("should normalize target names and aliases cleanly", () => {
    assert.equal(normalizeTarget("report"), "report");
    assert.equal(normalizeTarget("executive-report"), "report");
    assert.equal(normalizeTarget("analytical"), "report");

    assert.equal(normalizeTarget("print"), "print");
    assert.equal(normalizeTarget("printable-doc"), "print");
    assert.equal(normalizeTarget("pdf"), "print");
    assert.equal(normalizeTarget("compliance"), "print");

    assert.equal(normalizeTarget("dashboard"), "dashboard");
    assert.equal(normalizeTarget("live-dashboard"), "dashboard");
    assert.equal(normalizeTarget("telemetry"), "dashboard");

    assert.equal(normalizeTarget("presentation"), "presentation");
    assert.equal(normalizeTarget("slide-presentation"), "presentation");
    assert.equal(normalizeTarget("deck"), "presentation");

    assert.equal(normalizeTarget(null), "report");
    assert.equal(normalizeTarget("unknown-foo"), "report");
  });
});

describe("Domain Model: Configuration Normalization & Constraint Pruning", () => {
  it("should enforce static mode and disable AI/MCP for print deliverables", () => {
    const config = normalizeDomainConfig({
      target: "print",
      operationalMode: "live",
      appPackaging: "offline-app",
      features: {
        hasAiAgentBridge: true,
        hasEnterpriseMcpTools: true
      }
    });

    assert.equal(config.target, "print");
    assert.equal(config.operationalMode, "static", "Print target must be locked to static mode");
    assert.equal(config.appPackaging, "browser", "Print target must eliminate offline and live app packaging");
    assert.equal(config.features.hasAiAgentBridge, false, "Print target cannot have AI agent dock");
    assert.equal(config.features.hasEnterpriseMcpTools, false, "Print target cannot have MCP tools");
  });

  it("should gate AI agent bridge and MCP tools to live operational mode", () => {
    const staticConfig = normalizeDomainConfig({
      target: "report",
      operationalMode: "static",
      features: {
        hasAiAgentBridge: true,
        hasEnterpriseMcpTools: true
      }
    });

    assert.equal(staticConfig.operationalMode, "static");
    assert.equal(staticConfig.features.hasAiAgentBridge, false);
    assert.equal(staticConfig.features.hasEnterpriseMcpTools, false);

    const liveConfig = normalizeDomainConfig({
      target: "report",
      operationalMode: "live",
      features: {
        hasAiAgentBridge: true,
        hasEnterpriseMcpTools: true
      }
    });

    assert.equal(liveConfig.operationalMode, "live");
    assert.equal(liveConfig.features.hasAiAgentBridge, true);
    assert.equal(liveConfig.features.hasEnterpriseMcpTools, true);
  });

  it("should automatically promote live-app packaging to live operational mode", () => {
    const appConfig = normalizeDomainConfig({
      target: "dashboard",
      appPackaging: "live-app"
    });

    assert.equal(appConfig.operationalMode, "live");
    assert.equal(appConfig.appPackaging, "live-app");
  });

  it("should sanitize and validate custom brand color hex", () => {
    const validHex = normalizeDomainConfig({
      customBrandColorHex: "#3b82f6"
    });
    assert.equal(validHex.customBrandColorHex, "#3b82f6");

    const valid3Hex = normalizeDomainConfig({
      customBrandColorHex: "#f00"
    });
    assert.equal(valid3Hex.customBrandColorHex, "#f00");

    const invalidHex = normalizeDomainConfig({
      customBrandColorHex: "rgb(255,0,0)"
    });
    assert.equal(invalidHex.customBrandColorHex, null);
  });
});

describe("Domain Model: Skill Resolution & Downstream Routing", () => {
  it("should resolve correct sibling skill facade across all targets", () => {
    assert.equal(resolveSiblingSkill({ target: "report" }).skillTag, "@html-report");
    assert.equal(resolveSiblingSkill({ target: "print" }).skillTag, "@html-print");
    assert.equal(resolveSiblingSkill({ target: "dashboard" }).skillTag, "@html-dashboard");
    assert.equal(resolveSiblingSkill({ target: "presentation" }).skillTag, "@html-presentation");
  });
});

describe("Domain Model: CLI Flag & Command Generation", () => {
  it("should synthesize exact build command for print deliverables", () => {
    const cli = generateCliCommand({
      title: "Quarterly Audit",
      target: "print",
      defaultStartupTheme: "corporate"
    }, { contentFile: "audit.html", outputFile: "audit-report.html" });

    assert.ok(cli.buildFlags.includes("--mode print"));
    assert.ok(cli.buildFlags.includes("--print"));
    assert.ok(cli.buildFlags.includes("--theme corporate"));
    assert.match(cli.buildCommand, /--mode print/);
    assert.match(cli.buildCommand, /--output audit-report\.html/);
    assert.equal(cli.serveCommand, null);
  });

  it("should synthesize live dev server command for real-time dashboards", () => {
    const cli = generateCliCommand({
      title: "Operations Telemetry",
      target: "dashboard",
      operationalMode: "live"
    }, { outputFile: "ops.html", port: 3000 });

    assert.ok(cli.buildFlags.includes("--mode dashboard"));
    assert.ok(cli.buildFlags.includes("--dashboard"));
    assert.ok(cli.buildFlags.includes("--live"));
    assert.match(cli.serveCommand, /node skills\/html-report\/scripts\/serve-report\.mjs ops\.html --port 3000/);
  });

  it("should include custom theme and PWA flags when requested", () => {
    const cli = generateCliCommand({
      title: "Custom Brand Report",
      target: "report",
      appPackaging: "offline-app",
      customBrandColorHex: "#10b981"
    });

    assert.ok(cli.buildFlags.includes("--pwa"));
    assert.ok(cli.buildFlags.includes('--custom-theme "primary=#10b981"'));
  });
});

describe("Domain Model: Deterministic Prompt Synthesis", () => {
  it("should generate structured, unambiguous markdown prompt for agents", () => {
    const prompt = generateDeterministicPrompt({
      title: "Enterprise BI Scorecard",
      target: "executive-report",
      operationalMode: "live",
      defaultStartupTheme: "synthwave",
      features: {
        addons: ["charts", "gridjs"],
        hasAiAgentBridge: true
      }
    });

    assert.match(prompt, /Invoked via \/html-create -> Routing to Specialized Facade: @html-report/);
    assert.match(prompt, /Purpose & Format: EXECUTIVE ANALYTICAL REPORT/);
    assert.match(prompt, /Operational Mode: LIVE_CONNECTED/);
    assert.match(prompt, /Startup Theme: "synthwave"/);
    assert.match(prompt, /Interactive Charts \(Chart\.js v4\.4\)/);
    assert.match(prompt, /Interactive AI Assistant/);
    assert.match(prompt, /node skills\/html-report\/scripts\/build-report\.mjs/);
    assert.match(prompt, /node skills\/html-report\/scripts\/serve-report\.mjs/);
  });

  it("should incorporate reference files and context notes into deterministic prompt", () => {
    const config = normalizeDomainConfig({
      target: "report",
      referenceFiles: [
        { name: "metrics.csv", note: "Primary ARR cohorts and regional growth numbers" },
        { name: "architecture.png", note: "System diagram for Mermaid sequence flow" },
        "compliance-audit.pdf"
      ]
    });

    assert.equal(config.referenceFiles.length, 3);
    assert.equal(config.referenceFiles[0].name, "metrics.csv");
    assert.equal(config.referenceFiles[0].note, "Primary ARR cohorts and regional growth numbers");
    assert.equal(config.referenceFiles[2].name, "compliance-audit.pdf");

    const prompt = generateDeterministicPrompt(config);
    assert.match(prompt, /Reference Documents, Images & Data-Sets:/);
    assert.match(prompt, /• metrics\.csv \(Context Note: "Primary ARR cohorts and regional growth numbers"\)/);
    assert.match(prompt, /• architecture\.png \(Context Note: "System diagram for Mermaid sequence flow"\)/);
    assert.match(prompt, /• compliance-audit\.pdf/);
  });
});
