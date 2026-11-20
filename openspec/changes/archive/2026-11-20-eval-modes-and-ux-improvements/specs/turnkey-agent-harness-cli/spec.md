# Delta Specification: turnkey-agent-harness-cli

## ADDED Requirements

### Requirement: Reactive `<main>` Root Preservation & Port 3031 / AI Bridge CLI Alignment
`lintFragment()` and `stripOuterBoilerplate()` SHALL preserve reactive attributes (`data-signals`, `x-data`, `x-init`, `data-store`, `data-on-`) on `<main>` roots, `harness.mjs` / `cli.mjs` / `server-policy.mjs` and dashboard docs SHALL default to port `3031`, and `harness.mjs` SHALL forward `--ai`, `--ai-local`, and `--ai-port` while preserving studio manifest metadata across rebuilds.

#### Scenario: Reactive Datastar `<main data-signals>` fragment survives lint and boilerplate stripping
- **WHEN** `lintFragment()` or `stripOuterBoilerplate()` processes `<main id="report-main" data-signals='{"tick":0}'><h2 id="live">Live</h2></main>`
- **THEN** `lintFragment()` reports `valid: true` and `stripOuterBoilerplate()` preserves `data-signals='{"tick":0}'`.

#### Scenario: Harness CLI defaults to port 3031 and forwards `--ai-local`
- **WHEN** `parseArgs([])` runs without `--port` or runs with `--ai-local`
- **THEN** `port` defaults to `3031` and `harness.mjs` propagates `ai: true`, `aiLocal: true`, and preserved manifest metadata to `buildReport()`.
