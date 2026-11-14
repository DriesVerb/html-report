# Capability Spec: Verification Pipeline Flows & Ephemeral Verification Classes

## ADDED Requirements

### Requirement: Dual-Path Verification Pipeline (Deterministic & Agentic)
The verification pipeline MUST support both deterministic rule-based verification and agentic assembly review, converging on a shared edit-and-rebuild loop for both first-time assembly and subsequent edit rounds.

#### Scenario: Deterministic verification emits structured remediation
- **WHEN** `verify-report.mjs --json` runs on an assembled report that violates a structural or responsive rule (e.g., duplicate navbar or insufficient horizontal space)
- **THEN** the JSON output MUST include structured diagnostics with `ruleId`, `fixTarget` (`"fragment"` or `"build-flags"`), and `remediation` guidance.

#### Scenario: Agentic review packet pairs screenshots with telemetry
- **WHEN** `verify-report.mjs --screenshots --json` runs for assembly verification
- **THEN** the output MUST provide rendered viewport screenshots alongside DOM/section telemetry so an agent can verify content accuracy and visual layout in Round 1 or Round 2+ edits.

### Requirement: Ephemeral Verification CSS Classes & Attributes
Verification-only CSS classes (such as `verify-insufficient-space` / `verify-*`), `data-insufficient-space` / `data-verify-*` attributes, and verification overlay `<style id="html-report-verify-styles">` MAY be baked into HTML during verification, and MUST be stripped completely in the final published round.

#### Scenario: Verification classes are active during verification
- **WHEN** `checkInsufficientHorizontalSpace()` or a verification pass flags an element with insufficient space
- **THEN** the element MAY carry `verify-insufficient-space` and `data-insufficient-space="true"` for visual inspection and screenshot capture.

#### Scenario: Final published build strips all verification classes and attributes
- **WHEN** `build-report.mjs --published` or `HTMLReportPublisher.prepare()` runs to produce the final deliverable
- **THEN** all `verify-*` CSS classes, `data-insufficient-space` / `data-verify-*` attributes, and `#html-report-verify-styles` MUST be removed from the output HTML.
