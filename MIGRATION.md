# 🔄 Migration Guide Hub

Welcome to the `html-report` Migration Hub. This document tracks breaking changes, deprecated flags, and automated migration guides across releases.

---

## 🧭 Releases & Migration Status

| Target Version | From Version | Status | Migration Guide | AI Migration Prompt |
| :--- | :--- | :--- | :--- | :--- |
| **`v1.0.0`** | Baseline | **Current Stable** | Baseline SemVer 2.0.0 release | None required |
| **`v2.0.0`** | `v1.x` | *Upcoming / Preview* | [v1 to v2 Guide](docs/migrations/v1-to-v2.md) | [AI Prompt](docs/migrations/v1-to-v2.md#ai-migration-prompt) |

---

## 🔍 Pre-Flight Compatibility Audit

Before upgrading or refactoring, scan your downstream repository for deprecated flags or API usages:

```bash
# Scan current directory
node skills/html-report/scripts/harness.mjs --check-compatibility

# Or scan an external project directory
node skills/html-report/scripts/harness.mjs compat ../my-consumer-project/
```

If issues are found, the scanner prints exact line numbers, target replacements, and links to relevant migration guides.

---

## 🤖 How AI Migration Prompts Work

Whenever a breaking release is published, we supply a standardized `<AI_MIGRATION_PROMPT>` block.

### How to use it:
1. Open your AI coding assistant (Antigravity, Claude Code, Cursor, Copilot, Codex).
2. Copy the `<AI_MIGRATION_PROMPT>` block from the migration guide.
3. Paste it directly into your assistant.
4. The AI assistant will automatically scan your repository, perform mechanical codemods, update `package.json`, and run verification tests.

---

## ⚠️ Current v1.x Deprecation Catalog

The following legacy flags are deprecated in `v1.x` and will be retired in `v2.0.0`. They continue to work via backward-compatibility aliases:

| Deprecated Flag / Option | Canonical Replacement | Scheduled Retirement |
| :--- | :--- | :--- |
| `--dashboard-mode` | `--mode dashboard` (or `--dashboard`) | `v2.0.0` |
| `--print-mode` | `--mode print` (or `--print` / `-p`) | `v2.0.0` |
| `--live-stream` | `--mode live-report` (or `--live` / `-l`) | `v2.0.0` |
| `--offline-bundle` | `--offline` | `v2.0.0` |
| `dashboardMode: true` (JS) | `mode: "dashboard"` | `v2.0.0` |
| `offlineBundle: true` (JS) | `offline: true` | `v2.0.0` |
