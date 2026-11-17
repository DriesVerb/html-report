# publish-clean-export Delta Specification

> **Change:** `2026-11-16-two-package-core-studio-split` | **Base Spec:** [`openspec/specs/publish-clean-export/spec.md`](../../../../specs/publish-clean-export/spec.md)

## MODIFIED Requirements

### Requirement: Deterministic Clean Download
Because `packages/core` compiles reports clean-by-default (viewer-only chrome without `#edit-dock`, `#all-settings-modal`, or AI Bridge unless `--editable` / `--ai` is requested), `publish-report.mjs` and `build-report.mjs --published` SHALL produce clean published deliverables directly from source assembly with `editable: false` and `ai: false`, retaining `#settings-gear-btn`, `#settings-section-appearance`, and `#settings-section-download` while eliminating redundant HTML comment-marker stripping pipelines across three separate modules.

#### Scenario: Publishing an editable Studio workspace via publish-report.mjs or /api/publish
- **GIVEN** a project workspace (`fragment.html` + `report.manifest.json`) that includes Edit Mode and AI dock during live authoring in `packages/studio`
- **WHEN** `publish-report.mjs` or `POST /api/publish` produces the published deliverable
- **THEN** it invokes `buildReport({ ..., editable: false, ai: false, published: true })` from `@html-report/core/build`
- **AND** emits a deterministic single `.html` (when asset-free) or `.zip` bundle (when local `refs/` assets exist) containing zero authoring chrome and preserving all reader features.
