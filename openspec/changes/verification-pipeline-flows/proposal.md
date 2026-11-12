# Proposal: Dual-Path Verification Pipeline & Ephemeral Verification Classes

## Context & Problem
Currently, verification in `html-report` is split informally between deterministic Playwright checks (`verify-report.mjs`) and ad-hoc agent/user inspection of rendered reports. Three gaps exist:
1. **No explicit pipeline routing between Deterministic and Agentic verification**: Assembly edits can originate from either first-time builds or second-round fixes (triggered by deterministic failures, visual/content review, or Edit Mode feedback), but the pipeline does not model both paths or return structured remediation metadata.
2. **No structured remediation handoff**: `verify-report.mjs --json` reports error strings rather than structured `{ ruleId, fixTarget, selector, remediation }` diagnostics that tell an agent or developer whether to edit `fragment.html` or `build-report.mjs` flags.
3. **Verification CSS classes/attributes leak into final builds**: Diagnostic markers (such as `data-insufficient-space="true"` from `checkInsufficientHorizontalSpace()` or visual highlight classes like `verify-*`) are useful during verification and agentic screenshot review, but must **not** remain in the final published HTML.

## Vision & Goals
- **Unified Dual-Path Pipeline**: Model both **Deterministic Verification** (fast, rule-based Playwright/build gates) and **Agentic Verification** (Assembly Review Packet with screenshots + DOM summary + edit-round convergence).
- **First-Time & Second-Round Convergence**: Support both first-time assembly verification and multi-round edit loops converging back through `build-report.mjs` → `verify-report.mjs`.
- **Ephemeral Verification Lifecycle**: Allow verification CSS classes/attributes (`verify-*`, `data-insufficient-space`, verification overlay `<style>`) to be baked into the HTML during verification, and strip them cleanly in the final round (`build-report.mjs --published` and `HTMLReportPublisher.prepare()`).

## Related Artifacts
- [design.md](file:///home/eta/projects/html-report/openspec/changes/verification-pipeline-flows/design.md)
- [tasks.md](file:///home/eta/projects/html-report/openspec/changes/verification-pipeline-flows/tasks.md)
- [spec.md](file:///home/eta/projects/html-report/openspec/changes/verification-pipeline-flows/specs/verification-pipeline/spec.md)
