# Proposal: Native OpenSpec BDD-as-TDD Verification Harness

> Visual Plan & Companion Dashboard: [index.html](file:///home/eta/projects/html-report/openspec/changes/native-openspec-bdd/index.html) | Servable at `http://localhost:3000`

## Why

OpenSpec specifications in this repository already declare behavior and acceptance criteria in Gherkin-style **Given-When-Then** scenarios. However, executing and verifying these scenarios currently requires developers or agents to manually translate them into arbitrary test assertions without a unified behavioral DSL or automated spec drift detection.

Third-party BDD frameworks like Cucumber impose heavy npm dependency trees, complex step registries, regex matching overhead, and fractured state passing—violating the project's zero-root-dependency, lightweight ESM philosophy. 

We need a **zero-framework, native BDD-as-TDD test harness** that:
1. Runs directly on Node.js built-ins (`node:test`, `node:assert/strict`) alongside our existing 18+ test suites without rewriting anything.
2. Uses OpenSpec `spec.md` directly as the executable feature specification.
3. Enables **Double-Loop BDD-as-TDD**: outer BDD scenario gate (Red &rarr; Green) paired with inner unit test cycles.
4. Auto-detects unimplemented scenarios in `spec.md` as `test.todo()`, ensuring complete testability and quality gates.

## What Changes

- **Zero-Framework BDD DSL (`tests/harness/bdd.mjs`)**: Lightweight, pure ESM wrapper over `node:test` providing `Feature`, `Scenario`, `Given`, `When`, `Then`, and `And` with step execution tracking and failure isolation.
- **OpenSpec Spec-to-BDD Binder (`tests/harness/openspec-bdd.mjs`)**: Parses `spec.md` markdown files directly, auto-binding scenarios to test functions and registering unbound scenarios as `test.todo()`.
- **Pilot BDD Suite (`tests/agent-tracker.bdd.test.mjs`)**: Direct BDD verification of `openspec/specs/agent-tracker/spec.md` scenarios, proving side-by-side coexistence with existing unit tests.
- **Interactive Companion Plan & Copyable Prompt Dashboard (`index.html`)**: Interactive dashboard visualizing the plan, stage stepper (`Planning` &rarr; `Verifying`), and a dedicated 1-click copy card containing the BDD-as-TDD prompt.

## Capabilities

### New Capabilities
- `native-openspec-bdd`: Defines the zero-framework BDD domain-specific language, markdown spec scenario binding, auto-generated `test.todo()` drift detection, and side-by-side execution with native Node.js tests.

### Modified Capabilities
- *None*

## Impact

- Adds [`tests/harness/bdd.mjs`](file:///home/eta/projects/html-report/tests/harness/bdd.mjs) and [`tests/harness/openspec-bdd.mjs`](file:///home/eta/projects/html-report/tests/harness/openspec-bdd.mjs).
- Adds [`tests/agent-tracker.bdd.test.mjs`](file:///home/eta/projects/html-report/tests/agent-tracker.bdd.test.mjs).
- Zero new npm dependencies; zero modifications to existing HTML report generation scripts.
- Runs seamlessly within `node --test tests/*.test.mjs`.
