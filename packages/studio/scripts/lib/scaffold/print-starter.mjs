/**
 * @file lib/scaffold/print-starter.mjs
 * Dedicated print-mode (--mode print) semantic fragment starter with
 * #print-cover-page, A4 page-break guards, repeatable-header table, and sign-off block.
 */

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPrintTableSection(dataset) {
  const columns = dataset && dataset.columns.length > 0
    ? dataset.columns.slice(0, 5)
    : ["Item", "Description", "Region", "Status", "Amount"];
  const rows = dataset && dataset.rows.length > 0
    ? dataset.rows.slice(0, 15).map((r) => columns.map((_, idx) => escapeHtml(r[idx] ?? "")))
    : [
        ["ITEM-01", "Core Platform Subscription", "Global", "Verified", "$1,200.00"],
        ["ITEM-02", "Compliance & Audit Pack", "US-East", "Verified", "$450.00"],
        ["ITEM-03", "Managed Backup Retention", "EU-Central", "Verified", "$320.00"]
      ];

  const headerCells = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
  const bodyRows = rows
    .map((cells) => `          <tr>${cells.map((v) => `<td>${v}</td>`).join("")}</tr>`)
    .join("\n");

  return `  <!-- Print Ledger Table (thead repeats automatically across A4 pages) -->
  <section id="line-items" class="space-y-3">
    <h2 id="itemized-ledger" class="text-lg font-bold border-l-4 border-primary pl-3">Itemized Ledger</h2>
    <div class="overflow-x-auto w-full">
      <table class="table table-zebra table-xs w-full border border-base-300">
        <thead class="bg-base-200 text-base-content">
          <tr>${headerCells}</tr>
        </thead>
        <tbody>
${bodyRows}
        </tbody>
      </table>
    </div>
  </section>`;
}

/**
 * Generates a print-ready semantic <main> fragment for --mode print scaffolding.
 */
export function renderPrintStarterFragment({
  title = "Printable Document",
  mode = "print",
  slug = "print-doc",
  goals = "",
  audience = "",
  dataset = null
} = {}) {
  const safeTitle = escapeHtml(title);
  const safeSlug = escapeHtml(slug);
  const subtitle = goals
    ? escapeHtml(goals)
    : `Formal printable deliverable scaffolded from <code>projects/${safeSlug}/</code>.`;
  const audienceBadge = audience
    ? `<span class="badge badge-ghost badge-sm font-mono shrink-0">Audience: ${escapeHtml(audience)}</span>`
    : "";

  return `<main id="report-main" class="container mx-auto px-4 sm:px-6 py-6 max-w-4xl space-y-6">
  <!-- Print-Only Cover Page (hidden on screen, flex on @media print) -->
  <section id="print-cover-page" class="hidden print:flex flex-col justify-between min-h-[245mm] p-10 border border-base-300 rounded-box break-after-page print:break-after-page">
    <div class="space-y-4">
      <div class="flex items-center justify-between border-b border-base-300 pb-4">
        <span class="font-mono text-xs uppercase tracking-widest text-primary font-bold">Formal Deliverable</span>
        <span class="badge badge-outline font-mono text-xs">${escapeHtml(mode.toUpperCase())} // ${safeSlug}</span>
      </div>
      <div class="pt-16 space-y-4">
        <h1 id="print-cover-title" class="text-4xl font-extrabold tracking-tight leading-tight">${safeTitle}</h1>
        <p class="text-base text-base-content/80 max-w-2xl">${subtitle}</p>
      </div>
    </div>
    <div class="flex items-center justify-between border-t border-base-300 pt-4 text-xs text-base-content/70 font-mono">
      <span>Project: ${safeSlug}</span>
      <span>Page 1 — Cover Sheet</span>
    </div>
  </section>

  <!-- Document Header -->
  <section id="overview" class="space-y-3 break-inside-avoid print:break-inside-avoid">
    <div class="flex flex-wrap items-start justify-between gap-4 border-b border-base-300 pb-4">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2 mb-2">
          <span class="badge badge-primary badge-outline badge-sm font-mono shrink-0">${escapeHtml(mode)}</span>
          ${audienceBadge}
        </div>
        <h1 id="report-title" class="text-2xl sm:text-3xl font-extrabold tracking-tight">${safeTitle}</h1>
        <p class="text-xs sm:text-sm text-base-content/70 mt-1">${subtitle}</p>
      </div>
      <div class="text-left sm:text-right text-xs space-y-1 shrink-0 font-mono text-base-content/70">
        <p>DOC #${safeSlug.toUpperCase()}</p>
        <p>A4 Portrait</p>
      </div>
    </div>
  </section>

  <!-- Executive KPI Summary -->
  <section id="kpi-overview" class="space-y-3 break-inside-avoid print:break-inside-avoid">
    <h2 id="key-metrics" class="text-lg font-bold border-l-4 border-primary pl-3">Executive Summary</h2>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
      <div class="stat bg-base-100 border border-base-300 rounded-box p-4 break-inside-avoid print:break-inside-avoid min-w-0">
        <div class="stat-title text-xs">Primary Metric</div>
        <div class="stat-value text-2xl text-primary font-mono">--</div>
        <div class="stat-desc text-xs">Replace with domain figure</div>
      </div>
      <div class="stat bg-base-100 border border-base-300 rounded-box p-4 break-inside-avoid print:break-inside-avoid min-w-0">
        <div class="stat-title text-xs">Secondary Metric</div>
        <div class="stat-value text-2xl text-secondary font-mono">--</div>
        <div class="stat-desc text-xs">Replace with domain figure</div>
      </div>
      <div class="stat bg-base-100 border border-base-300 rounded-box p-4 break-inside-avoid print:break-inside-avoid min-w-0">
        <div class="stat-title text-xs">Verification Status</div>
        <div class="stat-value text-2xl text-accent font-mono">Ready</div>
        <div class="stat-desc text-xs">Print-optimized A4 layout</div>
      </div>
    </div>
  </section>

${renderPrintTableSection(dataset)}

  <!-- Signature & Attestation Block -->
  <section id="attestation" class="card bg-base-100 border border-base-300 break-inside-avoid print:break-inside-avoid">
    <div class="card-body p-5 space-y-4">
      <h2 id="sign-off" class="card-title text-base font-bold">Attestation &amp; Sign-Off</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
        <div class="space-y-2">
          <div class="h-8 border-b border-base-content/40"></div>
          <p class="text-xs font-semibold">Prepared By</p>
          <p class="text-xs text-base-content/70 font-mono">Date: _____________________</p>
        </div>
        <div class="space-y-2">
          <div class="h-8 border-b border-base-content/40"></div>
          <p class="text-xs font-semibold">Approved By</p>
          <p class="text-xs text-base-content/70 font-mono">Date: _____________________</p>
        </div>
      </div>
    </div>
  </section>
</main>
`;
}
