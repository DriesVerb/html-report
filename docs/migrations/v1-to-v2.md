# 🚀 Migration Guide: v1.x to v2.0.0

This guide details the planned breaking changes and automated migration workflow when upgrading from `html-report` v1.x to v2.0.0.

---

## 📋 Overview of Breaking Changes

In `v2.0.0`, several legacy CLI flags and programmatic options that were deprecated throughout `v1.x` are formally retired:

### 1. CLI Flag Retirements

| v1.x Legacy Flag | v2.0.0 Replacement | Rationale |
| :--- | :--- | :--- |
| `--dashboard-mode` | `--mode dashboard` or `--dashboard` | Harmonized with canonical mode system |
| `--print-mode` | `--mode print` or `--print` (`-p`) | Harmonized with canonical mode system |
| `--live-stream` | `--mode live-report` or `--live` (`-l`) | Harmonized with Datastar streaming standard |
| `--offline-bundle` | `--offline` | Shortened canonical flag |

### 2. Programmatic API Retirements

| v1.x Legacy Option | v2.0.0 Replacement |
| :--- | :--- |
| `buildReport({ dashboardMode: true })` | `buildReport({ mode: "dashboard" })` |
| `buildReport({ offlineBundle: true })` | `buildReport({ offline: true })` |

### 3. Programmatic Import Paths

In `v2.0.0`, direct deep script paths (e.g. `import ... from "html-report/skills/html-report/scripts/build-report.mjs"`) are deprecated in favor of official package subpaths:

```javascript
// ✅ Recommended in v1.x and required in v2.0.0
import { buildReport } from "html-report/build";
import { runHarness } from "html-report/harness";
import { serveReport } from "html-report/serve";
import { buildPwa } from "html-report/pwa";
```

---

## 🤖 Turnkey AI Migration Prompt

Copy and paste the block below directly into your AI coding assistant (Antigravity, Claude Code, Cursor, Copilot, Codex) to execute this migration automatically:

```text
<AI_MIGRATION_PROMPT>
You are an expert AI refactoring engineer upgrading this repository's `html-report` integration from v1.x to v2.0.0.
Follow these exact instructions:

1. DEPENDENCY UPDATE:
   - Check `package.json` for "html-report" dependency.
   - Update its version constraint to `^2.0.0`.

2. MECHANICAL CLI FLAG REPLACEMENTS:
   - Search across all package scripts, shell files (*.sh), and workflows (*.yaml, *.yml):
     - Replace `--dashboard-mode` with `--mode dashboard`
     - Replace `--print-mode` with `--mode print`
     - Replace `--live-stream` with `--mode live-report`
     - Replace `--offline-bundle` with `--offline`

3. PROGRAMMATIC API REPLACEMENTS:
   - Search across all JavaScript / TypeScript files:
     - Replace `dashboardMode: true` with `mode: "dashboard"`
     - Replace `offlineBundle: true` with `offline: true`
     - Replace deep imports `html-report/skills/html-report/scripts/...` with canonical subpaths:
       - `html-report/build` for buildReport
       - `html-report/harness` for runHarness
       - `html-report/serve` for serveReport
       - `html-report/pwa` for buildPwa

4. AUDIT & VERIFICATION:
   - Run the compatibility checker: `node skills/html-report/scripts/harness.mjs --check-compatibility`
   - Run the test suite: `npm test` or `node --test`
   - Verify all reports compile without warnings.
</AI_MIGRATION_PROMPT>
```

---

## 🧪 Manual Verification Steps

If executing the upgrade manually:

1. Run the compatibility audit:
   ```bash
   node skills/html-report/scripts/harness.mjs --check-compatibility
   ```
2. Verify zero warnings are emitted during compilation:
   ```bash
   node skills/html-report/scripts/harness.mjs run my-fragment.html
   ```
3. Check the report footer in the browser: confirm it displays `v2.0.0 (SemVer 2.0.0)`.
