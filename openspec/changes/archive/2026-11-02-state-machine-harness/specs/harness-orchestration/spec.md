# Spec Delta: Harness Orchestration

## Purpose
Provides a zero-dependency, package-manager-free deterministic finite state machine CLI harness that orchestrates semantic fragment validation, auto-fixing, report assembly, verification gates, and lifecycle transitions without manual agent drift.

## ADDED Requirements

### Requirement: Zero-Dependency Pure Node Execution
The harness CLI SHALL execute using only native Node.js standard library APIs without requiring `npm install`, `pnpm`, or external package manager configuration.

#### Scenario: Clean environment invocation
- **WHEN** user or caller executes `node scripts/harness.mjs --help` in an environment without `node_modules`
- **THEN** the harness prints CLI usage and exits 0 in under 50ms without dependency errors

### Requirement: Unified Lifecycle State Transitions
The harness CLI SHALL execute a strictly governed finite state machine (`IDLE` -> `VALIDATING` -> `AUTO_FIXING` -> `ASSEMBLING` -> `VERIFYING` -> `COMPLETED` / `REMEDIATING` / `FAILED`) preventing invalid execution order.

#### Scenario: Successful linear progression
- **WHEN** user or caller invokes the harness with a valid HTML fragment
- **THEN** the harness transitions sequentially through validation, assembly, verification, and terminates in `COMPLETED` with exit code 0

#### Scenario: Pre-flight validation gate
- **WHEN** user provides a fragment containing top-level `<html>` or `<body>` tags or unassigned heading IDs and auto-fix is disabled
- **THEN** the harness halts in `VALIDATING`, transitions to `REMEDIATING`, and does not invoke assembly or verification stages

### Requirement: Automated Playwright Verification Execution
The harness CLI SHALL automatically invoke verification upon successful assembly and enforce responsive integrity across designated breakpoints.

#### Scenario: Automated verification pass
- **WHEN** report assembly produces a valid HTML report
- **THEN** the harness executes Playwright verification and confirms zero horizontal scrollbar overflow and zero browser console errors

#### Scenario: Verification failure routing
- **WHEN** Playwright verification reports horizontal scrollbar overflow or runtime exceptions
- **THEN** the harness transitions to `REMEDIATING` instead of terminating silently or reporting false success

### Requirement: Bounded Retry Supervisor
The harness CLI SHALL track remediation attempts and enforce an explicit maximum retry threshold to prevent infinite agent execution loops.

#### Scenario: Retry limit reached
- **WHEN** remediation attempts reach or exceed the configured threshold (default: 3)
- **THEN** the harness halts, transitions to `FAILED`, and outputs a terminal error payload with exit code 1
