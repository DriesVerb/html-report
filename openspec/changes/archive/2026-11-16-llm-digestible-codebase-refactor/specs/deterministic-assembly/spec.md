# Delta Specification: deterministic-assembly (Modular Runtime & Authoring Bundling)

## ADDED Requirements

### Requirement: Modular Client Runtime & Authoring Chunk Assembly
`packages/core/assets/report-runtime.js` and `packages/studio/assets/authoring-plugin.js` SHALL assemble their inlined browser runtimes deterministically from ordered domain modules (`packages/core/assets/runtime/*.js` and `packages/studio/assets/authoring/*.js`), while preserving all CommonJS/ESM named exports for Node.js tests and zero-external-request standalone HTML output.

#### Scenario: Assembled report inlines all modular runtime chunks cleanly
- **WHEN** `buildReport()` compiles a report using the default `report-runtime.js` (and optionally `--editable` with `authoring-plugin.js`)
- **THEN** the emitted HTML contains a single self-contained inline `<script>` block with all runtime capabilities (`HTMLReportSettings`, `HTMLReportMermaid`, `HTMLReportPublisher`, `HTMLReportBoard`, and theme/PWA/presentation hooks)
- **AND** ESM named imports from `@html-report/core/assets/report-runtime.js` and `@html-report/studio/assets/authoring-plugin.js` resolve every exported symbol identically.
