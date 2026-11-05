# 🏷️ Semantic Versioning Specification & Public API Contract

`html-report` adheres strictly to [**Semantic Versioning 2.0.0**](https://semver.org/) (`MAJOR.MINOR.PATCH`).  
This document defines the stability guarantees, public API boundaries, deprecation lifecycle, and automated migration policies for downstream libraries and toolchains.

---

## 🎯 Version Format & Guarantees

Every release of `html-report` follows the standard format:

$$\text{v}\mathbf{MAJOR}.\mathbf{MINOR}.\mathbf{PATCH}$$

| Level | When Incremented | Backward Compatibility | Downstream Action Required |
| :--- | :--- | :--- | :--- |
| **`PATCH`** (`1.0.x`) | Bug fixes, performance optimizations, CDN SRI updates, documentation | 100% Backward Compatible | Safe instant update (`npm update`) |
| **`MINOR`** (`1.x.0`) | New optional CLI flags, new CDN addons, backward-compatible API functions | 100% Backward Compatible | Safe instant update; optional new features |
| **`MAJOR`** (`x.0.0`) | Breaking changes, removal of deprecated flags/APIs, altered template contracts | May require changes | Follow migration guide or run turnkey AI prompt |

---

## 🛡️ Public API Boundary

The following components constitute the **guaranteed Public API** of `html-report`. Changes to these components dictate version increments:

### 1. CLI Commands & Flags
* **Entrypoints**: `npx html-report` (`harness.mjs`), `html-report-build` (`build-report.mjs`), `html-report-serve` (`serve-report.mjs`), `html-report-pwa` (`generate-pwa.mjs`).
* **Canonical Flags**:
  * `--content, -c`, `--title, -t`, `--output, -o`
  * `--mode, -m` (`report`, `print`, `presentation`, `dashboard`, `working-report`, `live-report`, `pwa`)
  * `--pwa`, `--theme`, `--custom-theme`, `--live, -l`, `--print, -p`
  * `--check-compatibility`, `--version, -v`, `--help, -h`
* *Contract Guarantee*: Existing flags will never be removed or renamed in `PATCH` or `MINOR` releases without deprecation grace periods.

### 2. Programmatic Node.js ESM Exports
Downstream libraries can import canonical modules via subpaths:
```javascript
import { harness, runHarness } from "html-report/harness";
import { buildReport } from "html-report/build";
import { startServer, serveReport } from "html-report/serve";
import { buildPwa, generatePwaAssets } from "html-report/pwa";
import { compileTheme, compileThemeFile } from "html-report/theme";
import { checkCompatibility, getPackageVersion } from "html-report/compatibility";
```
* *Contract Guarantee*: Function names, exported signatures, and return structures will remain stable across minor versions.

### 3. Template Shell Token Contracts
The deterministic compiler guarantees standard slot replacements in `skills/html-report/assets/template-shell.html`:
* `<!-- {{TITLE}} -->`: Document `<title>` and navbar heading.
* `<!-- {{HEAD_EXTRAS}} -->`: CDN stylesheets, addons, and PWA manifest links.
* `<!-- {{CONTENT}} -->`: Injected semantic `<main>` content fragment.
* `<!-- {{VERSION}} -->`: Dynamic SemVer version number in footer.
* `<!-- {{CUSTOM_THEMES}} -->`: Compiled OKLCH custom CSS.
* `<!-- {{RUNTIME_SCRIPT}} -->`: Inlined report runtime and event listeners.

### 4. Client Runtime & Telemetry Protocols
* **DaisyUI Themes**: Catalog of 32 standard themes with `light` default.
* **Datastar Live SSE Signals**: `$theme`, `$activeTab`, and live checklist morph targets (`#task-${id}`).
* **PWA Lifecycle**: `beforeinstallprompt` registration, theme-color dynamic update, and service worker offline caching.

---

## ⏳ Deprecation Lifecycle Policy

We respect downstream maintainers' time. When an API or CLI flag must be retired or replaced:

1. **Announcement (`MINOR` bump)**:
   * The feature is marked `@deprecated` in documentation and `MIGRATION.md`.
   * The runtime interceptor (`skills/html-report/scripts/compatibility.mjs`) logs a high-visibility warning to `stderr` with the replacement flag, link to the migration guide, and sunset release target.
   * **The old flag continues to function normally.**
2. **Sunset Window**:
   * Deprecated features remain functional for at least one minor release cycle before removal.
3. **Retirement (`MAJOR` bump)**:
   * The deprecated feature is formally removed or transformed into a structured remediation error.
   * A dedicated migration guide is published in `docs/migrations/v<X>-to-v<Y>.md` with a copy-paste AI agent migration prompt.

---

## 🤖 AI-First Migration Assistance

When breaking changes occur, downstream library maintainers are never left stranded. Every breaking release includes:

1. **Automated Migration Guides (`docs/migrations/`)**: Clear before/after examples and rationale.
2. **Turnkey `<AI_MIGRATION_PROMPT>`**: A standardized, copy-pastable prompt designed for Antigravity, Claude Code, Cursor, or Codex to mechanically refactor downstream consumer code in one turn.
3. **Compatibility Audit CLI**:
   ```bash
   npx html-report --check-compatibility [optional-dir]
   ```
   Scans consumer codebases for deprecated flags and API usages, printing exact file/line findings and recommended codemods.
