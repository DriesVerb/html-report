/**
 * @fileoverview native-openspec-bdd.test.mjs
 * Inner Loop Unit TDD for the Native OpenSpec BDD-as-TDD Verification Harness.
 * Tests low-level algorithms, error decoration, AsyncLocalStorage, regex parsing, and key normalization.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Feature, Scenario, Given, When, Then, And, executeScenario } from "./harness/bdd.mjs";
import { parseSpecMarkdown, normalizeKey, resolveSpecPath, loadSpec } from "./harness/openspec-bdd.mjs";

describe("Native OpenSpec BDD Harness - Inner Loop Unit Tests", () => {
  describe("1. bdd.mjs DSL Primitives & Step Execution", () => {
    it("should export Feature and Scenario functions", () => {
      assert.equal(typeof Feature, "function");
      assert.equal(typeof Scenario, "function");
    });

    it("should export Given, When, Then, And as callable functions", () => {
      assert.equal(typeof Given, "function");
      assert.equal(typeof When, "function");
      assert.equal(typeof Then, "function");
      assert.equal(typeof And, "function");
    });

    it("should throw if Given/When/Then/And called outside an active Scenario", () => {
      assert.throws(
        () => Given("outside step", () => {}),
        /must be called within an active Scenario/
      );
      assert.throws(
        () => When("outside step", () => {}),
        /must be called within an active Scenario/
      );
      assert.throws(
        () => Then("outside step", () => {}),
        /must be called within an active Scenario/
      );
      assert.throws(
        () => And("outside step", () => {}),
        /must be called within an active Scenario/
      );
    });

    it("should execute steps sequentially, record durations, and update step status", async () => {
      let executionLog = [];
      let capturedCtx = null;

      await executeScenario(async (stepCtx) => {
        capturedCtx = stepCtx;

        await stepCtx.Given("initial condition is set", () => {
          executionLog.push("given");
        });

        await stepCtx.When("an action occurs", async () => {
          await new Promise((r) => setTimeout(r, 10));
          executionLog.push("when");
        });

        await stepCtx.Then("verify expected state", () => {
          executionLog.push("then");
        });

        await stepCtx.And("additional verification", () => {
          executionLog.push("and");
        });
      });

      assert.deepEqual(executionLog, ["given", "when", "then", "and"]);
      assert.ok(capturedCtx, "stepCtx should be captured");
      assert.equal(capturedCtx.steps.length, 4);
      assert.equal(capturedCtx.steps[0].keyword, "GIVEN");
      assert.equal(capturedCtx.steps[0].status, "passed");
      assert.ok(typeof capturedCtx.steps[1].durationMs === "number");
      assert.ok(capturedCtx.steps[1].durationMs >= 8, "Async step duration should be measured");
    });

    it("should support standalone Given/When/Then via AsyncLocalStorage", async () => {
      let executed = false;

      await executeScenario(async () => {
        await Given("standalone given", () => {});
        await When("standalone when", () => {});
        await Then("standalone then", () => {
          executed = true;
        });
      });

      assert.equal(executed, true);
    });

    it("should catch step assertion failures and decorate error with step context", async () => {
      let capturedError = null;

      try {
        await executeScenario(async ({ Given, When, Then }) => {
          await Given("a setup step", () => {});
          await When("something happens", () => {});
          await Then("assertion fails", () => {
            assert.equal(1, 2, "numbers do not match");
          });
        });
      } catch (err) {
        capturedError = err;
      }

      assert.ok(capturedError, "An error should have been caught");
      assert.match(capturedError.message, /\[BDD Step Failed: "THEN assertion fails"\]/);
      assert.match(capturedError.message, /numbers do not match/);
      assert.ok(capturedError.failedStep);
      assert.equal(capturedError.failedStep.keyword, "THEN");
      assert.equal(capturedError.failedStep.desc, "assertion fails");
      assert.equal(capturedError.failedStep.status, "failed");
      assert.ok(Array.isArray(capturedError.bddSteps));
      assert.equal(capturedError.bddSteps.length, 3);
    });

    // Verification that Scenario() can also be declared directly inside describe
    Scenario("Declared Scenario directly inside describe suite", async ({ Given, When, Then }) => {
      let state = 0;
      await Given("state is initialized", () => { state = 10; });
      await When("state is incremented", () => { state += 5; });
      await Then("state equals 15", () => { assert.equal(state, 15); });
    });
  });

  describe("2. openspec-bdd.mjs Markdown Parsing & Discovery", () => {
    it("normalizeKey should strip whitespace, punctuation, and lowercase characters", () => {
      assert.equal(normalizeKey("Executing a structured BDD scenario"), "executingastructuredbddscenario");
      assert.equal(normalizeKey("Scenario: Foo-Bar_123!"), "scenariofoobar123");
      assert.equal(normalizeKey(""), "");
      assert.equal(normalizeKey(null), "");
      assert.equal(normalizeKey(undefined), "");
    });

    it("parseSpecMarkdown should parse spec title, requirements, scenarios, and steps", () => {
      const markdown = `
# Feature: Color Theme Engine

### Requirement: OKLCH Conversion
The engine must convert hex to OKLCH.

#### Scenario: Hex to OKLCH conversion
- **GIVEN** a hex color code #3b82f6
- **WHEN** converter parses the hex
- **THEN** it outputs valid OKLCH coordinates
- **AND** luminance is within expected delta

### Requirement: Fallback Handling
#### Scenario: Malformed input fallback
- **GIVEN** an invalid color string
- **WHEN** parser executes
- **THEN** it falls back to neutral gray
`;

      const parsed = parseSpecMarkdown(markdown);
      assert.equal(parsed.title, "Feature: Color Theme Engine");
      assert.equal(parsed.requirements.length, 2);

      const req1 = parsed.requirements[0];
      assert.equal(req1.name, "OKLCH Conversion");
      assert.equal(req1.scenarios.length, 1);
      assert.equal(req1.scenarios[0].name, "Hex to OKLCH conversion");
      assert.equal(req1.scenarios[0].steps.length, 4);
      assert.match(req1.scenarios[0].steps[0], /GIVEN a hex color code/);
      assert.match(req1.scenarios[0].steps[3], /AND luminance is within/);

      const req2 = parsed.requirements[1];
      assert.equal(req2.name, "Fallback Handling");
      assert.equal(req2.scenarios.length, 1);
      assert.equal(req2.scenarios[0].name, "Malformed input fallback");
      assert.equal(req2.scenarios[0].steps.length, 3);
    });

    it("parseSpecMarkdown should handle scenarios without preceding requirement heading", () => {
      const markdown = `
# Standalone Spec

#### Scenario: Isolated scenario test
- **GIVEN** no requirement header
- **WHEN** parsed
- **THEN** assigned to General Requirements
`;
      const parsed = parseSpecMarkdown(markdown);
      assert.equal(parsed.requirements.length, 1);
      assert.equal(parsed.requirements[0].name, "General Requirements");
      assert.equal(parsed.requirements[0].scenarios[0].name, "Isolated scenario test");
    });

    it("resolveSpecPath should locate capability specs and delta specs", () => {
      // 1. Existing file directly
      const direct = resolveSpecPath("openspec/specs/agent-tracker/spec.md");
      assert.ok(fs.existsSync(direct));

      // 2. Capability name shortcut
      const shortcut = resolveSpecPath("agent-tracker");
      assert.ok(fs.existsSync(shortcut));
      assert.match(shortcut, /openspec\/specs\/agent-tracker\/spec\.md$/);

      // 3. Change delta or archived capability shortcut
      const deltaShortcut = resolveSpecPath("native-openspec-bdd");
      assert.ok(fs.existsSync(deltaShortcut));
      assert.match(deltaShortcut, /openspec\/(?:specs|changes)\/native-openspec-bdd(?:\/specs\/native-openspec-bdd)?\/spec\.md$/);
    });

    it("loadSpec should throw an error if file does not exist", () => {
      assert.throws(
        () => loadSpec("non-existent-capability-xyz-123"),
        /OpenSpec file not found at:/
      );
    });

    it("loadSpec should discover scenarios and compute stats", () => {
      const spec = loadSpec("native-openspec-bdd");
      assert.ok(spec.title.includes("native-openspec-bdd") || spec.title.includes("Native OpenSpec BDD"));
      assert.equal(spec.totalScenarios, 5);
      assert.equal(spec.requirements.length, 3);
    });
  });
});
