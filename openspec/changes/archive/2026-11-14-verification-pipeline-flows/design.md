# Technical Design: Dual-Path Verification Pipeline & Ephemeral Verification Classes

See [proposal.md](file:///home/eta/projects/html-report/openspec/changes/verification-pipeline-flows/proposal.md) for motivation.

## Architecture Overview

### 1. Dual-Path Pipeline Verification
After `build-report.mjs` assembles `fragment.html` + `template-shell.html` + addons, verification branches into two complementary paths that converge on the same edit-and-rebuild loop:

- **Deterministic Path (`verify-report.mjs` + `build-report.mjs --verify`)**
  - Runs headless Playwright checks (`core:structure`, `core:responsive`, `core:console-errors`, `core:print-pdf`, CDN styleguides).
  - Enriches `--json` diagnostics with structured remediation entries:
    ```json
    {
      "ruleId": "core:structure:duplicate-navbar",
      "fixTarget": "fragment",
      "selector": "main .navbar",
      "remediation": "Remove duplicate navbar/sticky control bar from fragment.html and rebuild."
    }
    ```
- **Agentic Path (Assembly Review Packet)**
  - Pairs rendered viewport/print screenshots (`--screenshots`) with `--json` telemetry and section/heading inventory.
  - Supports **Round 1** (initial content & layout review) and **Round 2+** (verifying fixes for deterministic failures, Edit Mode requests, or prior layout bugs).

### 2. Ephemeral Verification CSS Classes & Attributes
During verification builds (`--verify` or Playwright `verify-report.mjs` runs):
- Diagnostic classes/attributes (e.g. `verify-insufficient-space`, `verify-highlight`, `data-insufficient-space="true"`) and an optional `<style id="html-report-verify-styles">` overlay can be baked into the HTML so screenshots and human/agent reviewers can immediately spot overflow, clipping, or layout issues.
- In the **final round** (`build-report.mjs --published` and `HTMLReportPublisher.prepare()` in `report-runtime.js`):
  - Strip all `verify-*` CSS classes from every element's `class` attribute.
  - Remove `data-insufficient-space` and `data-verify-*` attributes.
  - Remove `<style id="html-report-verify-styles">` if present.
  - Guarantee the final shipped HTML contains zero verification-only styling or attributes.

## Related Artifacts
- [proposal.md](file:///home/eta/projects/html-report/openspec/changes/verification-pipeline-flows/proposal.md)
- [tasks.md](file:///home/eta/projects/html-report/openspec/changes/verification-pipeline-flows/tasks.md)
- [spec.md](file:///home/eta/projects/html-report/openspec/changes/verification-pipeline-flows/specs/verification-pipeline/spec.md)
