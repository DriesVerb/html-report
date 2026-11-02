# structured-remediation Specification

## Purpose
Provides machine-parseable error diagnostic structures, deterministic auto-fix transforms, and spoon-fed remediation guidance tailored for smaller or less capable models whenever validation or verification fails.

## Requirements

### Requirement: Deterministic Pre-Flight Auto-Fix Engine
The harness CLI SHALL provide mechanical auto-fix transforms for common agent formatting errors prior to invoking compilation or browser verification.

#### Scenario: Accidental wrapper tag stripping
- **WHEN** user fragment contains outer `<!DOCTYPE html>`, `<html>`, `<head>`, or `<body>` wrappers
- **THEN** the harness strips the outer wrappers automatically, logs the fix, and proceeds to assembly

#### Scenario: Missing heading ID synthesis
- **WHEN** user fragment contains `<h1>`, `<h2>`, or `<h3>` tags without `id` attributes
- **THEN** the harness generates URL-slugified unique `id` attributes based on heading text content and injects them automatically

### Requirement: Structured Diagnostic Payloads for Agents
The harness SHALL emit a machine-readable JSON diagnostic payload whenever a validation or verification stage fails, including explicit remediation instructions.

#### Scenario: Layout overflow diagnostic output
- **WHEN** Playwright detects horizontal scrollbar overflow on an element
- **THEN** the harness outputs a JSON object specifying error type `HORIZONTAL_OVERFLOW`, the culprit CSS selector, viewport width, and a literal copy-paste instruction for the agent

#### Scenario: Pre-flight syntax diagnostic output
- **WHEN** the semantic fragment fails AST linting and auto-fix cannot resolve the issue
- **THEN** the harness outputs a JSON object listing every offending element, line offset, and required fix
