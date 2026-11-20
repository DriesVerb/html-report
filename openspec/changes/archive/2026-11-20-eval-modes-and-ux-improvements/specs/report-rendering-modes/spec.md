# Delta Specification: report-rendering-modes

## ADDED Requirements

### Requirement: Print-Mode A4 Pagination, Chart Print Resize & Dedicated Print Starter
Print-mode and `@media print` reports SHALL enforce A4 portrait `@page` margins, repeat `thead` while keeping `tfoot` and table rows intact across page breaks, invoke `resizeChartsForPrint()` on `exportReportPdf()` and `beforeprint`/`afterprint`/`matchMedia("print")`, exclude `#print-cover-page` headings from `initTOC()`, and provide a dedicated `--mode print` starter (`print-starter.mjs`) with `#print-cover-page`, KPIs, `table-xs` ledger table, and attestation sign-off.

#### Scenario: Print build includes A4 pagination CSS and Chart.js print resize hooks
- **WHEN** `buildReport()` compiles a report with `mode: "print"` or `exportReportPdf()` / `beforeprint` fires
- **THEN** the HTML contains `@page` A4 portrait rules, `display: table-header-group`, `display: table-row-group`, and `.break-after-page`, and `resizeChartsForPrint()` invokes `.resize()` on every active `window.reportCharts` instance.

#### Scenario: Scaffolding a project with `--mode print` emits the dedicated print starter
- **WHEN** `generateStarterFragment({ slug: "q4-pack", title: "Q4 Pack", mode: "print" })` runs
- **THEN** the generated fragment contains `#print-cover-page` (`hidden print:flex`), an executive summary, a `table-xs` ledger table, and an `#attestation` sign-off block without `#print-cover-page` headings leaking into `initTOC()`.
