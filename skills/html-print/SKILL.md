---
name: html-print
description: >-
  Generates pixel-perfect printable HTML documents, paginated A4/Letter PDFs, invoices,
  and formal compliance reports with print-optimized CSS, page-break controls, and
  automated headless PDF export. Use when the user asks for printable documents, PDFs,
  invoices, billing summaries, receipts, or export-to-PDF deliverables.
---

# HTML Print & Paged PDF Skill (`html-print`)

> **Domain:** `Delivery Archetype` | **Beneficiary:** `User-Facing` | **Serving:** `Static File` | **Behavior:** `Passive / Printable`

This specialized skill produces publication-grade printable documents and paged PDFs (invoices, compliance audits, receipts, whitepapers) with deterministic pagination and zero screen-only clutter.

Agents generate **only the semantic `<main>` content fragment**, styled specifically for standard sheet dimensions (A4 / US Letter) and print engines.

---

## Print Optimization Standards

### 1. Page Geometry & CSS Paged Media
The shared template shell automatically applies print rules, but fragments should declare structural boundaries:
```css
@page {
  size: A4 portrait;
  margin: 15mm 15mm 20mm 15mm;
}
@media print {
  body {
    background: #ffffff !important;
    color: #0f172a !important;
    font-size: 10pt;
  }
}
```

### 2. Defensive Page-Break Utility Classes
Use Tailwind / CSS print utilities to avoid awkward splits across pages:
- **Card & Section Preservation**: Add `break-inside-avoid print:break-inside-avoid` to every card, KPI box, chart wrapper, and signature block.
- **Explicit Page Breaks**: Use `break-after-page print:break-after-page` between distinct chapters or invoice sections.
- **Table Integrity**: Ensure tables use `thead { display: table-header-group; }` and rows use `tr { break-inside: avoid; }` so table headers repeat neatly on subsequent sheets.
- **Screen UI Suppression**: Ensure screen-only action buttons, filter inputs, and interactive widgets are flagged with `print:hidden`.
- **Single Navbar Rule**: Never add a second navbar, sticky control bar, or duplicate quick-nav/print toolbar inside `<main id="report-main">`. The shared template shell (`template-shell.html`) already renders the single sticky top navbar with the report title, `PRINT` badge, `Contents` TOC dropdown, theme switcher, and Print/PDF export action.

### 3. Recommended DaisyUI Themes for Print
Always specify high-contrast, ink-conserving themes:
- Default: `corporate` or `light` (crisp borders, neutral slate text, clean white background).
- Avoid dark themes (`dark`, `synthwave`, `dracula`) for print targets unless the user specifically demands an inverted dark-mode PDF.

---

## Assembly & Verification Workflow

### Step 1: Synthesize Print Semantic `<main>` Fragment
Emit the document fragment (e.g. `invoice-fragment.html`):
```html
<main id="report-main" class="container mx-auto px-6 py-4 max-w-4xl space-y-6">
  <!-- Invoice Header -->
  <div class="flex justify-between items-start border-b border-base-300 pb-4 break-inside-avoid">
    <div>
      <h1 class="text-2xl font-bold font-mono tracking-tight text-primary">INVOICE #INV-2026-0042</h1>
      <p class="text-xs text-base-content/70">Issued: November 6, 2026</p>
    </div>
    <div class="text-right text-xs space-y-1">
      <p class="font-semibold">Acme Global Ltd.</p>
      <p class="text-base-content/70">finance@acme.example.com</p>
    </div>
  </div>

  <!-- Line Items Table -->
  <div class="overflow-x-auto break-inside-avoid">
    <table class="table table-zebra table-sm w-full border border-base-300">
      <thead class="bg-base-200">
        <tr><th>Description</th><th class="text-right">Qty</th><th class="text-right">Unit Price</th><th class="text-right">Amount</th></tr>
      </thead>
      <tbody>
        <tr><td>Enterprise Cloud License</td><td class="text-right">1</td><td class="text-right">$1,200.00</td><td class="text-right">$1,200.00</td></tr>
      </tbody>
    </table>
  </div>
</main>
```

### Step 2: Assemble Print Deliverable
Compile with `--mode print`:
```bash
node skills/html-report/scripts/build-report.mjs \
  --title "Invoice INV-2026-0042" \
  --content invoice-fragment.html \
  --mode print \
  --theme corporate \
  --output invoice.html
```

### Step 3: Headless PDF Export & Validation
Generate and verify the PDF deliverable via Playwright:
```bash
node skills/html-report/playwright/verify-report.mjs invoice.html --pdf invoice.pdf --quick
```

---

## Sibling Skill Routing
- **Analytical & BI Summaries**: Use `@html-report` for screen-first dashboards with charts and tables.
- **Real-Time Telemetry & SSE**: Use `@html-dashboard` for live agent monitoring.
- **3D Pitch Decks**: Use `@html-presentation` for slide transitions.
- **Interactive Decision Wizard**: Use `@html-create` to configure prompt parameters.
