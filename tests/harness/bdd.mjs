/**
 * @fileoverview bdd.mjs
 * Zero-Framework BDD Domain-Specific Language for Node.js.
 * Wraps native node:test and node:assert/strict with Feature, Scenario,
 * Given, When, Then, and And semantics with step contextualization and zero external npm dependencies.
 */

import { describe, it } from "node:test";
import { AsyncLocalStorage } from "node:async_hooks";

const scenarioStorage = new AsyncLocalStorage();

/**
 * Declares a high-level Feature group matching an OpenSpec capability or requirement.
 * @param {string} name Feature title
 * @param {Function} suiteFn Test suite definition function
 */
export function Feature(name, suiteFn) {
  return describe(`Feature: ${name}`, suiteFn);
}

/**
 * Low-level scenario executor that manages step tracking and AsyncLocalStorage.
 * Can be invoked directly or via Scenario().
 * 
 * @param {Function} scenarioFn Async function receiving step context ({ Given, When, Then, And, steps, testContext })
 * @param {object} [testContext] Optional node:test context
 * @returns {Promise<any>}
 */
export async function executeScenario(scenarioFn, testContext = null) {
  const steps = [];

  async function runStep(keyword, desc, fn) {
    const stepRecord = { keyword, desc, timestamp: Date.now(), status: "pending" };
    steps.push(stepRecord);
    try {
      await fn?.(testContext);
      stepRecord.status = "passed";
      stepRecord.durationMs = Date.now() - stepRecord.timestamp;
    } catch (err) {
      stepRecord.status = "failed";
      stepRecord.error = err;
      const decoratedError = new Error(`[BDD Step Failed: "${keyword} ${desc}"] - ${err.message}`);
      decoratedError.originalError = err;
      decoratedError.bddSteps = steps;
      decoratedError.failedStep = stepRecord;
      throw decoratedError;
    }
  }

  const stepCtx = {
    Given: (desc, fn) => runStep("GIVEN", desc, fn),
    When: (desc, fn) => runStep("WHEN", desc, fn),
    Then: (desc, fn) => runStep("THEN", desc, fn),
    And: (desc, fn) => runStep("AND", desc, fn),
    steps,
    testContext
  };

  return scenarioStorage.run(stepCtx, () => scenarioFn(stepCtx, testContext));
}

/**
 * Declares an executable Scenario matching an OpenSpec `#### Scenario:` heading.
 * @param {string} name Scenario title
 * @param {Function} scenarioFn Async or sync function receiving BDD step functions ({ Given, When, Then, And, steps, testContext })
 */
export function Scenario(name, scenarioFn) {
  return it(`Scenario: ${name}`, (t) => executeScenario(scenarioFn, t));
}

/**
 * Returns active BDD scenario context from async local storage.
 * @returns {object}
 */
function getActiveCtx() {
  const ctx = scenarioStorage.getStore();
  if (!ctx) {
    throw new Error("BDD step functions (Given, When, Then, And) must be called within an active Scenario()");
  }
  return ctx;
}

// Standalone alias exports leveraging AsyncLocalStorage
export const Given = (desc, fn) => getActiveCtx().Given(desc, fn);
export const When = (desc, fn) => getActiveCtx().When(desc, fn);
export const Then = (desc, fn) => getActiveCtx().Then(desc, fn);
export const And = (desc, fn) => getActiveCtx().And(desc, fn);
