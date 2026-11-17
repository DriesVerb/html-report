# Delta Specification: deterministic-assembly (Review Learnings)

## ADDED Requirements

### Requirement: Precision Addon Detection & Explicit Pinning
`detectAddons()` SHALL match only HTML/JS library signatures rather than bare prose tokens, and `buildReport()` / `build-report.mjs` SHALL support `--only-addons <list|none>` and `--no-auto-addons` to bypass content auto-detection when desired.

#### Scenario: Prose report mentions library names without loading unused CDNs
- **WHEN** `buildReport()` processes prose containing words such as `"marked"`, `"showdown"`, `"Leaflet"`, `"KaTeX"`, or `"Chart.js"` without DOM/script signatures
- **THEN** `activeAddons` is empty (`[]`) and only the Core 4 shell scripts are emitted.

### Requirement: Direct Mermaid Source File Inclusion
`buildReport()` and `harness.mjs` SHALL resolve external `.mmd` and `.mermaid` files referenced via `data-mermaid-src` / `data-src` on `.mermaid` containers or `<!-- {{MERMAID:...}} -->` / `<!-- @mermaid ... -->` directives before addon detection and rendering.

#### Scenario: Report embeds standalone diagram file without source duplication
- **WHEN** a fragment references `<div class="mermaid" data-mermaid-src="./diagrams/flow.mmd"></div>`
- **THEN** `buildReport()` inlines the `.mmd` source, strips optional code fences, activates the `mermaid` addon, and throws an actionable error if the referenced file does not exist.

### Requirement: Screen-Hidden Print Cover Verification
`template-shell.html` SHALL hide `#print-cover-page` and `.print-only-summary` by default in `@media screen`, and both `core:structure` and `core:print-pdf` SHALL fail verification if `#print-cover-page` is visible during normal screen viewing.

#### Scenario: Screen-visible print cover fails automated verification
- **WHEN** a report renders `#print-cover-page` with a visible computed `display` in `@media screen`
- **THEN** `core:structure` and `core:print-pdf` fail with a remediation targeting `#print-cover-page`.

### Requirement: Unambiguous Verification Selection & Non-Filtering `--pdf`
Passing `--pdf <file>` to `verify-report.mjs` SHALL generate the PDF while keeping standard Core + auto-detected checks active, and `--with-core` SHALL keep Core baseline checks enabled when combined with `--check-*` or `--cdns`.
