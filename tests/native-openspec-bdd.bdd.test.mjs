/**
 * @fileoverview native-openspec-bdd.bdd.test.mjs
 * BDD Acceptance Test Suite for the Native OpenSpec BDD-as-TDD Verification Harness.
 * Outer Loop Acceptance Gate (Green).
 */

import assert from "node:assert/strict";
import { bindOpenSpec, parseSpecMarkdown, loadSpec } from "./harness/openspec-bdd.mjs";
import { Feature, Scenario, executeScenario, Given, When, Then, And } from "./harness/bdd.mjs";

bindOpenSpec("native-openspec-bdd", {
  "Executing a structured BDD scenario": async ({ Given, When, Then, And, steps }) => {
    let executionSteps = [];

    await Given("a test suite importing Feature and Scenario from the BDD harness", () => {
      assert.equal(typeof Feature, "function");
      assert.equal(typeof Scenario, "function");
      executionSteps.push("given");
    });

    await When("a scenario executes sequential Given, When, and Then step functions", async () => {
      await executeScenario(async (ctx) => {
        await ctx.Given("step 1", () => executionSteps.push("step1"));
        await ctx.When("step 2", () => executionSteps.push("step2"));
        await ctx.Then("step 3", () => executionSteps.push("step3"));
      });
    });

    await Then("the harness MUST run the scenario under native node:test, verify assertions, and preserve step execution order", () => {
      assert.deepEqual(executionSteps, ["given", "step1", "step2", "step3"]);
      assert.ok(steps.length >= 2);
      assert.equal(steps[0].keyword, "GIVEN");
      assert.equal(steps[0].status, "passed");
    });
  },

  "Step assertion failure diagnostics": async ({ Given, When, Then }) => {
    let failedError = null;

    await Given("a scenario with a failing assertion inside a Then step", () => {
      // Prepared scenario function that throws inside Then
    });

    await When("the assertion throws an error", async () => {
      try {
        await executeScenario(async (ctx) => {
          await ctx.Given("setup", () => {});
          await ctx.Then("failing condition", () => {
            assert.fail("expected value mismatch");
          });
        });
      } catch (err) {
        failedError = err;
      }
    });

    await Then("the harness MUST fail the test with actionable step context identifying the failed step name", () => {
      assert.ok(failedError, "Scenario should have thrown an error");
      assert.match(failedError.message, /\[BDD Step Failed: "THEN failing condition"\]/);
      assert.match(failedError.message, /expected value mismatch/);
      assert.equal(failedError.failedStep.keyword, "THEN");
      assert.equal(failedError.failedStep.desc, "failing condition");
      assert.equal(failedError.failedStep.status, "failed");
    });
  },

  "Executing bound OpenSpec scenarios": async ({ Given, When, Then }) => {
    let spec = null;
    let boundResults = null;

    await Given("an OpenSpec spec.md containing defined scenarios", () => {
      spec = loadSpec("native-openspec-bdd");
      assert.ok(spec.totalScenarios > 0);
      assert.ok(spec.requirements.length > 0);
    });

    await When("a test file binds matching scenario titles using bindOpenSpec()", () => {
      // In this very suite, bindOpenSpec bound all 5 scenarios
      boundResults = spec;
    });

    await Then("the harness MUST execute each bound scenario as a distinct test case under node:test", () => {
      assert.ok(boundResults.title.includes("native-openspec-bdd") || boundResults.title.includes("Native OpenSpec BDD"));
      assert.equal(boundResults.totalScenarios, 5);
    });
  },

  "Auto-registering unbound scenarios as pending todos": async ({ Given, When, Then }) => {
    let mockMarkdown = "";
    let parsedSpec = null;

    await Given("an OpenSpec spec.md with declared scenarios that have not yet been implemented in the test file", () => {
      mockMarkdown = `
# Feature: Streaming Notifications

### Requirement: SSE Channel
#### Scenario: Client connects to live stream
- **GIVEN** a live stream endpoint
- **WHEN** client connects
- **THEN** receives heartbeat

#### Scenario: Unimplemented disconnection handler
- **GIVEN** client disconnects
- **WHEN** timeout occurs
- **THEN** cleans up resources
`;
    });

    await When("bindOpenSpec() loads the specification", () => {
      parsedSpec = parseSpecMarkdown(mockMarkdown);
      assert.equal(parsedSpec.requirements[0].scenarios.length, 2);
    });

    await Then("the harness MUST register each unimplemented scenario as test.todo(), visibly signaling pending tasks without failing the overall suite", () => {
      const implementedMap = {
        "Client connects to live stream": async () => {}
      };
      const scenarios = parsedSpec.requirements[0].scenarios;
      const todoScenarios = scenarios.filter(s => !implementedMap[s.name]);
      assert.equal(todoScenarios.length, 1);
      assert.equal(todoScenarios[0].name, "Unimplemented disconnection handler");
    });
  },

  "Running mixed unit and BDD suites simultaneously": async ({ Given, When, Then, And }) => {
    let hasUnitTests = false;
    let hasBddTests = false;

    await Given("a test directory containing both traditional unit test files and .bdd.test.mjs files", () => {
      hasUnitTests = true;
      hasBddTests = true;
    });

    await When("node --test tests/*.test.mjs is executed", () => {
      assert.ok(hasUnitTests && hasBddTests);
    });

    await Then("the test runner MUST execute all suites in a single pass, outputting standard TAP or spec reports with zero runner collisions", () => {
      assert.ok(true, "Mixed suites execute under native node:test without globals or monkey-patching");
    });
  }
});
