# Delta Specification: `skill-packaging` (Scaffold Overflow & Port-Fallback Clarity)

## MODIFIED Requirements

### Requirement: Responsive Scaffold Defaults and Explicit Port-Fallback Warning
`scaffold-project.mjs` SHALL emit a responsive CSS Grid KPI container (`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4`) instead of `stats-vertical lg:stats-horizontal`, preserve `--ai-port` and `--ai-persona` in generated rebuild commands, and `serve-report.mjs` SHALL emit a prominent warning banner whenever an explicitly requested `--port` is busy and falls back to an alternate port.

#### Scenario: Scaffolded 4-KPI layout passes Playwright `lg` (`1024px`) verification
- **WHEN** a new project is scaffolded with `scaffold-project.mjs` and populated with 4 KPI cards
- **THEN** `verify-report.mjs` reports `0px` overflow and `0` elements with `[data-insufficient-space="true"]` at `sm` (`640px`) and `lg` (`1024px`).

#### Scenario: Explicit `--port 3031` collision displays a clear fallback notice
- **WHEN** `serve-report.mjs` is invoked with `--port 3031` while port `3031` is already occupied
- **THEN** the startup banner explicitly warns that port `3031` was busy and displays the actual bound port (e.g., `3034`) so users do not connect to an unrelated server on `:3031`.
