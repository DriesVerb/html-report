# Tasks: Dual-Path Verification Pipeline & Ephemeral Verification Classes

## 1. Ephemeral Verification CSS Lifecycle
- [x] 1.1 Update `checkInsufficientHorizontalSpace()` in [report-runtime.js](file:///home/eta/projects/html-report/skills/html-report/assets/report-runtime.js) to toggle `verify-insufficient-space` alongside `data-insufficient-space="true"` during verification
- [x] 1.2 Update `HTMLReportPublisher.prepare()` in [report-runtime.js](file:///home/eta/projects/html-report/skills/html-report/assets/report-runtime.js) and `--published` pruning in [build-report.mjs](file:///home/eta/projects/html-report/skills/html-report/scripts/build-report.mjs) to strip all `verify-*` classes, `data-insufficient-space`, `data-verify-*` attributes, and `#html-report-verify-styles`

## 2. Deterministic Pipeline Verification
- [x] 2.1 Add structured remediation metadata (`ruleId`, `fixTarget`, `remediation`) to [reporter.mjs](file:///home/eta/projects/html-report/skills/html-report/playwright/harness/reporter.mjs) and core checks ([structure.mjs](file:///home/eta/projects/html-report/skills/html-report/playwright/harness/checks/core/structure.mjs), [responsive.mjs](file:///home/eta/projects/html-report/skills/html-report/playwright/harness/checks/core/responsive.mjs))
- [x] 2.2 Add `--verify` post-assembly flag to [build-report.mjs](file:///home/eta/projects/html-report/skills/html-report/scripts/build-report.mjs) to invoke `verify-report.mjs --quick --json`

## 3. Agentic Verification & Review Packet
- [x] 3.1 Add `--review-packet` / structured section-and-screenshot summary to [verify-report.mjs](file:///home/eta/projects/html-report/skills/html-report/playwright/verify-report.mjs) for Round 1 and Round 2+ agentic assembly review
- [x] 3.2 Document the dual-path verification flow and ephemeral class cleanup in [SKILL.md](file:///home/eta/projects/html-report/skills/html-report/SKILL.md)

## 4. Verification Tests
- [x] 4.1 Add unit and Playwright tests verifying `verify-*` classes are applied during verification and stripped in `--published` output
- [x] 4.2 Add tests verifying `--json` structured remediation hints and `build-report.mjs --verify`
