# native-openspec-bdd Specification

## Purpose
Provides a zero-framework, native Node.js BDD domain-specific language and OpenSpec markdown scenario binder that enables Double-Loop BDD-as-TDD verification running side-by-side with existing unit tests.

## Requirements

### Requirement: Zero-Framework BDD Domain-Specific Language
The test harness SHALL provide native ESM BDD primitives (`Feature`, `Scenario`, `Given`, `When`, `Then`, `And`) implemented directly on top of Node.js `node:test` and `node:assert/strict` without third-party frameworks.

#### Scenario: Executing a structured BDD scenario
- **GIVEN** a test suite importing `Feature` and `Scenario` from the BDD harness
- **WHEN** a scenario executes sequential `Given`, `When`, and `Then` step functions
- **THEN** the harness MUST run the scenario under native `node:test`, verify assertions, and preserve step execution order.

#### Scenario: Step assertion failure diagnostics
- **GIVEN** a scenario with a failing assertion inside a `Then` step
- **WHEN** the assertion throws an error
- **THEN** the harness MUST fail the test with actionable step context identifying the failed step name.

---

### Requirement: OpenSpec Markdown Scenario Discovery & Binding
The test harness SHALL provide an OpenSpec scenario loader that parses any OpenSpec `spec.md` markdown file, discovers declared `#### Scenario:` titles, and binds them to executable test implementations.

#### Scenario: Executing bound OpenSpec scenarios
- **GIVEN** an OpenSpec `spec.md` containing defined scenarios
- **WHEN** a test file binds matching scenario titles using `bindOpenSpec()`
- **THEN** the harness MUST execute each bound scenario as a distinct test case under `node:test`.

#### Scenario: Auto-registering unbound scenarios as pending todos
- **GIVEN** an OpenSpec `spec.md` with declared scenarios that have not yet been implemented in the test file
- **WHEN** `bindOpenSpec()` loads the specification
- **THEN** the harness MUST register each unimplemented scenario as `test.todo()`, visibly signaling pending tasks without failing the overall suite.

---

### Requirement: Double-Loop Coexistence with Standard Test Suites
The BDD harness SHALL execute seamlessly alongside all existing `node:test` suites when invoked with standard wildcards (`node --test tests/*.test.mjs`) without polluting global scope or breaking unit test runners.

#### Scenario: Running mixed unit and BDD suites simultaneously
- **GIVEN** a test directory containing both traditional unit test files and `.bdd.test.mjs` files
- **WHEN** `node --test tests/*.test.mjs` is executed
- **THEN** the test runner MUST execute all suites in a single pass, outputting standard TAP or spec reports with zero runner collisions.
