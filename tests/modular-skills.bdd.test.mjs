/**
 * @fileoverview modular-skills.bdd.test.mjs
 * Native OpenSpec BDD-as-TDD Verification Suite for Modular Skill Decomposition (Matt Pocock Pattern).
 * Binds directly to openspec/changes/pipeline-four-core-features/specs/modular-skill-decomposition/spec.md.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bindOpenSpec } from "./harness/openspec-bdd.mjs";
import {
  discoverSkills,
  routeSkill,
  runBenchmark,
  parseSkillMarkdown,
  CANONICAL_SKILL_NAMES,
  MAX_SKILL_SIZE_BYTES
} from "../skills/html-report/scripts/skill-router.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

bindOpenSpec("modular-skill-decomposition", {
  "Inspecting modular skill facade sizes": async ({ When, Then, And }) => {
    let discovered = [];

    await When("an agent or test harness audits all canonical skill packages", async () => {
      discovered = discoverSkills(path.join(REPO_ROOT, "skills")).filter(s =>
        CANONICAL_SKILL_NAMES.includes(s.name)
      );
    });

    await Then("each SKILL.md file size is strictly less than or equal to 5,120 bytes", () => {
      assert.equal(discovered.length, CANONICAL_SKILL_NAMES.length);
      for (const skill of discovered) {
        assert.ok(
          skill.sizeBytes <= MAX_SKILL_SIZE_BYTES,
          `Skill ${skill.name} size is ${skill.sizeBytes} bytes, exceeding ${MAX_SKILL_SIZE_BYTES}`
        );
      }
    });

    await And("each frontmatter specifies a concise third-person description and distinct domain scope", () => {
      for (const skill of discovered) {
        assert.ok(skill.frontmatter.name, `Missing frontmatter name in ${skill.name}`);
        assert.ok(skill.frontmatter.description, `Missing description in ${skill.name}`);
        assert.ok(skill.frontmatter.description.length >= 40, `Description too brief for ${skill.name}`);
      }
    });
  },

  "Verifying shared core engine utilization": async ({ When, Then, And }) => {
    let siblings = [];

    await When("the file tree of sibling skill packages is inspected", async () => {
      const allSkills = discoverSkills(path.join(REPO_ROOT, "skills"));
      siblings = allSkills.filter(s => s.name !== "html-report" && CANONICAL_SKILL_NAMES.includes(s.name));
    });

    await Then("sibling packages do not contain duplicate scripts/ or assets/ subdirectories", () => {
      for (const sibling of siblings) {
        assert.equal(
          sibling.hasDuplicatedAssets,
          false,
          `Sibling skill ${sibling.name} has duplicated scripts or assets`
        );
      }
    });

    await And("each facade executes against the shared skills/html-report/ engine via portable relative paths", () => {
      for (const sibling of siblings) {
        assert.ok(
          sibling.body.includes("skills/html-report/") || sibling.body.includes("../html-report/"),
          `Sibling skill ${sibling.name} does not reference the shared engine`
        );
      }
    });
  },

  "Resolving modular skills from .agents/skills/": async ({ When, Then, And }) => {
    let agentSkills = [];

    await When("an agent platform scans .agents/skills/ for available capabilities", async () => {
      agentSkills = discoverSkills(path.join(REPO_ROOT, ".agents/skills"));
    });

    await Then("all canonical skills resolve directly to their canonical packages", () => {
      const resolvedNames = agentSkills.map(s => s.name);
      for (const canonical of CANONICAL_SKILL_NAMES) {
        assert.ok(
          resolvedNames.includes(canonical),
          `Missing resolved canonical skill in .agents/skills/: ${canonical}`
        );
      }
    });

    await And("each resolved SKILL.md is parseable with valid YAML frontmatter metadata", () => {
      for (const canonical of CANONICAL_SKILL_NAMES) {
        const skill = agentSkills.find(s => s.name === canonical);
        assert.ok(skill, `Skill ${canonical} not found`);
        assert.equal(skill.frontmatter.name, canonical);
        assert.ok(skill.body.length > 500, `Skill body too short in ${canonical}`);
      }
    });
  },

  "Routing domain prompts to specialized skills": async ({ When, Then, And }) => {
    let benchmarkResults = null;

    await When("domain-specific prompts representing reports, print/PDFs, live telemetry, presentations, PWAs, and decision wizards are routed", async () => {
      benchmarkResults = runBenchmark();
    });

    await Then("the router returns the correct specialized skill", () => {
      assert.ok(benchmarkResults.passed >= 30, `Expected at least 30 passed, got ${benchmarkResults.passed}`);
    });

    await And("benchmark accuracy across domain phrases achieves at least 95%", () => {
      assert.ok(
        benchmarkResults.accuracy >= 95.0,
        `Routing benchmark accuracy was ${benchmarkResults.accuracy}%, required >= 95.0%`
      );
    });
  }
});
