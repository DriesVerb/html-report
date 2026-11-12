/**
 * @file domain-language.bdd.test.mjs
 * Acceptance test suite verifying the Ubiquitous Domain Language and Feature Alignment Architecture.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  BOUNDED_CONTEXTS,
  UBIQUITOUS_GLOSSARY,
  FEATURE_BENEFICIARIES,
  SERVING_MODES,
  BEHAVIORAL_MODES,
  FEATURE_ALIGNMENT_RUBRIC,
  evaluateFeatureAlignment,
  generateFeatureAlignmentPrompt
} from "../skills/html-report/scripts/domain-model.mjs";

describe("Feature Spec: Ubiquitous Domain Language & Feature Alignment Architecture", () => {
  describe("Requirement: Unified Bounded Context Classification", () => {
    it("Scenario: Attributing a feature proposal to a primary Bounded Context", () => {
      // GIVEN a proposal for streaming live token metrics
      const proposal = {
        title: "Live Subagent Swarm Streamer",
        boundedContext: "agentBridge",
        archetypes: ["@html-dashboard"],
        invariants: "Streams SSE fragments targeting #agent-swarm-hierarchy.",
        artifactQuad: true
      };

      // WHEN the feature is evaluated against the domain metamodel
      const result = evaluateFeatureAlignment(proposal);

      // THEN it is classified under the Two-Way AI Agent Bridge & Telemetry context
      assert.equal(result.checks.find(c => c.name === "Context Attribution")?.passed, true);
      assert.ok(BOUNDED_CONTEXTS.agentBridge.name.includes("Two-Way AI Agent Bridge"));
    });

    it("Scenario: Distinguishing Assembly from Pipeline", () => {
      assert.ok(BOUNDED_CONTEXTS.assembly);
      assert.ok(BOUNDED_CONTEXTS.pipeline);
      assert.notEqual(BOUNDED_CONTEXTS.assembly.name, BOUNDED_CONTEXTS.pipeline.name);
      assert.match(BOUNDED_CONTEXTS.assembly.description, /fast and reliably/);
      assert.match(BOUNDED_CONTEXTS.pipeline.description, /state machine/);
    });

    it("Scenario: Modeling Create Mode, Edit Mode, and Published Document lifecycles", () => {
      assert.ok(BOUNDED_CONTEXTS.createMode);
      assert.ok(BOUNDED_CONTEXTS.editMode);
      assert.ok(BOUNDED_CONTEXTS.publishedDocument);
      assert.match(BOUNDED_CONTEXTS.createMode.description, /Guiding users/);
      assert.match(BOUNDED_CONTEXTS.editMode.description, /not yet published/);
      assert.match(BOUNDED_CONTEXTS.publishedDocument.description, /no longer needs edit-mode/);
    });

    it("Scenario: Distinguishing User-Facing from Agent-Facing feature beneficiaries", () => {
      assert.equal(FEATURE_BENEFICIARIES.user.key, "user");
      assert.equal(FEATURE_BENEFICIARIES.agent.key, "agent");
      assert.equal(FEATURE_BENEFICIARIES.hybrid.key, "hybrid");
      assert.ok(FEATURE_BENEFICIARIES.user.description.includes("create.html"));
      assert.ok(FEATURE_BENEFICIARIES.agent.description.includes("CLI"));
    });

    it("Scenario: Classifying features across the two-axis model (Serving vs Behavioral)", () => {
      assert.ok(SERVING_MODES.staticFile);
      assert.ok(SERVING_MODES.serverConnected);
      assert.ok(BEHAVIORAL_MODES.passive);
      assert.ok(BEHAVIORAL_MODES.interactive);

      // Verify static file can be interactive (e.g. PokéAPI or Weather API)
      assert.ok(SERVING_MODES.staticFile.description.includes("Client-side fetch to external CORS APIs supported"));
      assert.ok(BEHAVIORAL_MODES.interactive.description.includes("public API fetches"));
    });
  });

  describe("Requirement: Canonical Ubiquitous Glossary Enforcement", () => {
    it("Scenario: Normalizing ambiguous fragment terminology", () => {
      // GIVEN a user request with deprecated terms ("snippet", "body partial")
      const ambiguousProposal = {
        title: "Snippet generator",
        description: "Produces an HTML snippet and body partial for cards",
        boundedContext: "coreAssembly",
        archetypes: ["@html-report"],
        invariants: "Must compile cleanly",
        artifactQuad: true
      };

      // WHEN evaluated
      const result = evaluateFeatureAlignment(ambiguousProposal);

      // THEN vocabulary check fails with specific violations
      assert.equal(result.checks.find(c => c.name === "Ubiquitous Vocabulary")?.passed, false);
      assert.ok(result.violations.some(v => v.includes("snippet")));
      assert.ok(result.violations.some(v => v.includes("partial")));
    });

    it("Scenario: Distinguishing Template Shell from Output Deliverable", () => {
      const templateShellDef = UBIQUITOUS_GLOSSARY.find(g => g.canonical === "Template Shell");
      const outputDeliverableDef = UBIQUITOUS_GLOSSARY.find(g => g.canonical === "Output Deliverable");

      assert.ok(templateShellDef);
      assert.ok(outputDeliverableDef);
      assert.ok(templateShellDef.rule.includes("template-shell.html"));
      assert.ok(outputDeliverableDef.rule.includes("standalone, single-file HTML5"));
    });
  });

  describe("Requirement: 5-Step Feature Alignment Rubric", () => {
    it("Scenario: Validating a compliant feature proposal", () => {
      const proposal = {
        title: "OKLCH Palette Harmonizer",
        boundedContext: "themeAdaptation",
        archetypes: ["@html-report", "@html-create"],
        invariants: "Ensures contrast ratio >= 4.5:1 against base-100 backgrounds.",
        artifactQuad: true
      };

      const result = evaluateFeatureAlignment(proposal);
      assert.equal(result.aligned, true);
      assert.equal(result.score, 100);
      assert.equal(result.checks.length, 5);
      assert.ok(result.checks.every(c => c.passed));
    });
  });

  describe("Requirement: Interactive Domain Architecture Report & OpenSpec Artifacts", () => {
    it("Scenario: Verifying existence of change artifacts and live mirror", () => {
      let changeDir = path.resolve("openspec/changes/domain-language-unification");
      if (!fs.existsSync(changeDir)) {
        const archiveDir = path.resolve("openspec/changes/archive");
        const found = fs.readdirSync(archiveDir).find(d => d.includes("domain-language-unification"));
        if (found) changeDir = path.join(archiveDir, found);
      }
      assert.ok(fs.existsSync(path.join(changeDir, "proposal.md")), "proposal.md must exist");
      assert.ok(fs.existsSync(path.join(changeDir, "design.md")), "design.md must exist");
      assert.ok(fs.existsSync(path.join(changeDir, "tasks.md")), "tasks.md must exist");
      assert.ok(fs.existsSync(path.resolve("openspec/specs/domain-language-model/spec.md")), "main spec.md must exist in openspec/specs");
      assert.ok(fs.existsSync(path.join(changeDir, "index.html")), "index.html must exist");

      // Verify live mirror at root
      const mirrorHtml = fs.readFileSync(path.resolve("implementation-progress.html"), "utf8");
      assert.match(mirrorHtml, /OpenSpec Journey/);
      assert.match(mirrorHtml, /steps steps-horizontal w-full min-w-\[500px\]/);
      assert.match(mirrorHtml, /openMarkdownViewer\('proposal\.md'\)/);
    });
  });
});
