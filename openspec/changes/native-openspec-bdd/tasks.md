# Tasks: Native OpenSpec BDD-as-TDD Verification Harness

## 1. Zero-Framework BDD Micro-DSL

- [x] 1.1 Implement `tests/harness/bdd.mjs` providing `Feature`, `Scenario`, `Given`, `When`, `Then`, `And` wrapping `node:test` with step execution tracking and failure contextualization
- [x] 1.2 Verify `tests/harness/bdd.mjs` executes sequential and async steps correctly using a self-test

## 2. OpenSpec Markdown Scenario Discovery & Binder

- [x] 2.1 Implement `tests/harness/openspec-bdd.mjs` with regex-based scenario parsing (`#### Scenario: <title>`) from any `spec.md` file
- [x] 2.2 Implement auto-binding logic that invokes test functions for bound scenarios and registers unbound scenarios as `test.todo()`, and verify with unit tests

## 3. Pilot BDD Verification & Mixed-Suite Coexistence

- [x] 3.1 Create `tests/agent-tracker.bdd.test.mjs` binding scenarios from `openspec/specs/agent-tracker/spec.md` using the native BDD harness
- [x] 3.2 Run full test suite (`node --test tests/*.test.mjs`) to verify zero regressions across all 18+ existing test suites and flawless coexistence

## 4. Companion HTML Report & Copyable BDD-TDD Prompt Dashboard

- [x] 4.1 Generate `openspec/changes/native-openspec-bdd/index.html` presenting the architecture, interactive Mermaid workflows, direct backlinks to markdown artifacts, and a prominent 1-click copyable BDD-as-TDD prompt card
- [x] 4.2 Sync `index.html` with `implementation-progress.html` and verify live reload on `http://localhost:3000`
