# Tasks

## 1. Zero-Dep Pre-Flight Linter & Auto-Fix Engine

- [x] 1.1 Implement pure Node pre-flight linter in `skills/html-report/scripts/harness.mjs` checking for missing heading IDs and outer boilerplate. Verify with mock fragments.
- [x] 1.2 Implement mechanical auto-fix transforms (stripping `<html>`/`<body>` wrappers, slugifying missing `id`s on `h1-h3`). Verify auto-fix output on malformed fragments.
- [x] 1.3 Write automated unit tests in `tests/harness-linter.test.mjs` asserting pre-flight detection and auto-fix behavior without external dependencies.

## 2. Deterministic Pure-Node FSM Lifecycle Engine

- [x] 2.1 Implement core Finite State Machine lifecycle runner in `skills/html-report/scripts/harness.mjs` (`IDLE` -> `VALIDATING` -> `AUTO_FIXING` -> `ASSEMBLING` -> `VERIFYING` -> `COMPLETED`/`FAILED`). Verify CLI help and status transitions.
- [x] 2.2 Wire single-command execution chaining assembly (`build-report.mjs`) and automated Playwright verification (`verify-report.mjs --quick`). Verify end-to-end execution on sample fragment.
- [x] 2.3 Add automated unit tests in `tests/harness-lifecycle.test.mjs` verifying valid state transitions and CLI exit codes.

## 3. "Small Model First" Remediation Protocol & Bounded Retries

- [x] 3.1 Implement error diagnostic parser in `harness.mjs` converting Playwright overflow errors into structured JSON with prescriptive `instruction_for_agent` fields. Verify with error fixture.
- [x] 3.2 Add bounded retry supervisor logic enforcing maximum 3 retry attempts before transitioning to terminal `FAILED` state. Verify in test runner.

## 4. Agnostic Skill Guidelines & Documentation

- [x] 4.1 Update `skills/html-report/SKILL.md` to establish `node skills/html-report/scripts/harness.mjs run` as the unified single-entrypoint workflow. Verify instructions clarity.
- [x] 4.2 Document the FSM state machine architecture and small-model remediation contract in `skills/html-report/references/harness-architecture.md`. Verify reference links.
