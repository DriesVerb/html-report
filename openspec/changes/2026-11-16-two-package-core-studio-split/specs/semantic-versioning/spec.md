# semantic-versioning Delta Specification

> **Change:** `2026-11-16-two-package-core-studio-split` | **Base Spec:** [`openspec/specs/semantic-versioning/spec.md`](../../../../specs/semantic-versioning/spec.md)

## MODIFIED Requirements

### Requirement: Root Package Distribution and Semantic Version Declaration
The root `package.json` SHALL configure npm `"workspaces": ["packages/*"]` alongside `"name": "html-report"`, SemVer-compliant `version`, ESM module type, and backward-compatible subpath `"exports"` (`./build`, `./harness`, `./theme`, `./pwa`, `./generate-pwa`, `./publish`, `./compatibility`, `./serve`, `./scaffold`) and CLI `"bin"` aliases forwarding cleanly to `packages/core` (`@html-report/core`) and `packages/studio` (`@html-report/studio`).

#### Scenario: Existing subpath imports resolve seamlessly across the workspace split
- **WHEN** a downstream consumer imports `"html-report/build"`, `"html-report/harness"`, `"html-report/theme"`, `"html-report/serve"`, or `"html-report/scaffold"`
- **THEN** Node.js resolves each subpath to its canonical module inside `packages/core/` or `packages/studio/` without breaking existing callers.

#### Scenario: Studio package resolves core via workspace dependency
- **WHEN** `packages/studio` imports `"@html-report/core/build"` or `"@html-report/core/publish"`
- **THEN** npm workspaces resolves `"@html-report/core"` to `packages/core/` cleanly with zero external npm dependencies.
