import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DAISYUI_THEMES,
  TARGET_DEFINITIONS,
  ADDON_CATALOG,
  BOUNDED_CONTEXTS,
  UBIQUITOUS_GLOSSARY,
  FEATURE_BENEFICIARIES,
  SERVING_MODES,
  BEHAVIORAL_MODES,
  FEATURE_ALIGNMENT_RUBRIC,
  normalizeTarget,
  normalizeDomainConfig,
  resolveSiblingSkill,
  generateCliCommand,
  generateDeterministicPrompt,
  evaluateFeatureAlignment,
  generateFeatureAlignmentPrompt
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

describe("Domain Model: Ubiquitous Language & Feature Alignment Rubric", () => {
  it("should define all formal Bounded Contexts with primary artifacts", () => {
    assert.ok(BOUNDED_CONTEXTS.assembly);
    assert.ok(BOUNDED_CONTEXTS.pipeline);
    assert.ok(BOUNDED_CONTEXTS.deliveryArchetypes);
    assert.ok(BOUNDED_CONTEXTS.createMode);
    assert.ok(BOUNDED_CONTEXTS.editMode);
    assert.ok(BOUNDED_CONTEXTS.publishedDocument);
    assert.ok(BOUNDED_CONTEXTS.openSpecJourney);

    for (const bc of Object.values(BOUNDED_CONTEXTS)) {
      assert.ok(typeof bc.name === "string" && bc.name.length > 0);
      assert.ok(bc.description.length > 10);
      assert.ok(Array.isArray(bc.primaryArtifacts) && bc.primaryArtifacts.length > 0);
    }
  });

  it("should define the Canonical Ubiquitous Glossary mapping deprecated synonyms", () => {
    assert.ok(UBIQUITOUS_GLOSSARY.length >= 10);
    const fragmentDef = UBIQUITOUS_GLOSSARY.find(g => g.canonical === "Semantic Fragment");
    assert.ok(fragmentDef);
    assert.ok(fragmentDef.deprecated.includes("snippet"));
    assert.ok(fragmentDef.deprecated.includes("partial"));

    const bridgeDef = UBIQUITOUS_GLOSSARY.find(g => g.canonical === "Two-Way Agent Bridge");
    assert.ok(bridgeDef);
    assert.ok(bridgeDef.deprecated.includes("co-pilot socket"));
  });

  it("should define the 5-Step Feature Alignment Rubric", () => {
    assert.equal(FEATURE_ALIGNMENT_RUBRIC.length, 5);
    assert.equal(FEATURE_ALIGNMENT_RUBRIC[0].name, "Context Attribution");
    assert.equal(FEATURE_ALIGNMENT_RUBRIC[1].name, "Ubiquitous Vocabulary");
    assert.equal(FEATURE_ALIGNMENT_RUBRIC[2].name, "Archetype Impact");
    assert.equal(FEATURE_ALIGNMENT_RUBRIC[3].name, "Bridge & Authoring Invariants");
    assert.equal(FEATURE_ALIGNMENT_RUBRIC[4].name, "Journey & Live Mirror");
  });

  it("should evaluate a fully compliant feature proposal with 100% score", () => {
    const proposal = {
      title: "Real-Time Telemetry Anomaly Filter",
      boundedContext: "agentBridge",
      archetypes: ["@html-dashboard"],
      invariants: "Must suppress jitter fluctuations below 25% delta.",
      artifactQuad: true,
      changeDir: "openspec/changes/telemetry-filter"
    };

    const result = evaluateFeatureAlignment(proposal);
    assert.equal(result.aligned, true);
    assert.equal(result.score, 100);
    assert.equal(result.violations.length, 0);
  });

  it("should detect deprecated synonyms and flag alignment violations", () => {
    const proposal = {
      title: "Add HTML snippet for partial preview",
      description: "This feature adds a template snippet and partial to the bundler.",
      boundedContext: "coreAssembly",
      archetypes: ["@html-report"],
      invariants: "None",
      artifactQuad: true
    };

    const result = evaluateFeatureAlignment(proposal);
    assert.equal(result.aligned, false);
    assert.ok(result.score < 100);
    assert.ok(result.violations.some(v => v.includes("deprecated domain synonyms")));
  });

  it("should define Feature Beneficiaries distinguishing user vs agent capabilities", () => {
    assert.ok(FEATURE_BENEFICIARIES.user);
    assert.ok(FEATURE_BENEFICIARIES.agent);
    assert.ok(FEATURE_BENEFICIARIES.hybrid);
    assert.match(FEATURE_BENEFICIARIES.user.description, /Studio GUI/);
    assert.match(FEATURE_BENEFICIARIES.agent.description, /Headless CLI/);
  });

  it("should define the Two-Axis runtime model (Serving Mode vs Behavioral Mode)", () => {
    assert.ok(SERVING_MODES.staticFile);
    assert.ok(SERVING_MODES.serverConnected);
    assert.ok(BEHAVIORAL_MODES.passive);
    assert.ok(BEHAVIORAL_MODES.interactive);
    assert.match(SERVING_MODES.staticFile.description, /Zero dedicated server/);
    assert.match(BEHAVIORAL_MODES.interactive.description, /Dynamic user or data interaction/);
  });

  it("should generate standardized OpenSpec feature proposal prompt", () => {
    const prompt = generateFeatureAlignmentPrompt({
      title: "Multi-Turn Anomaly Detector",
      boundedContext: "agentBridge",
      beneficiary: "agent",
      servingMode: "serverConnected",
      behavioralMode: "interactive",
      archetypes: ["@html-dashboard", "@html-report"],
      invariants: "Must adhere to SSE token rate thresholds."
    });

    assert.match(prompt, /### OpenSpec Feature Proposal: Multi-Turn Anomaly Detector/);
    assert.match(prompt, /Target Beneficiary:[\s\S]*Agent-Facing/);
    assert.match(prompt, /Serving Mode: Server-Connected/);
    assert.match(prompt, /Behavioral Mode: Interactive/);
    assert.match(prompt, /Two-Way AI Agent Bridge & Telemetry/);
    assert.match(prompt, /@html-dashboard, @html-report/);
    assert.match(prompt, /Must adhere to SSE token rate thresholds/);
    assert.match(prompt, /http:\/\/localhost:3031/);
  });
});

