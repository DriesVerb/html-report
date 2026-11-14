#!/usr/bin/env node
/**
 * @file scaffold-project.mjs
 * Project Scaffolding Pipeline for html-report.
 * Creates the basis for a new project under projects/<slug>/ and streamlines
 * assembly and future rebuilds:
 *   - projects/<slug>/fragment.html        (Semantic <main id="report-main"> source)
 *   - projects/<slug>/index.html           (Compiled Deliverable with deterministic agent hooks)
 *   - projects/<slug>/report.manifest.json (Machine-readable project & pipeline manifest)
 *   - projects/<slug>/AGENTS.md            (Agent-facing working guide & rebuild commands)
 *
 * Zero external npm dependencies.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReport, normalizeMode, CANONICAL_MODES } from "./build-report.mjs";
import { WIDGET_PRESETS } from "./domain-model.mjs";
import { generatePwaAssets } from "./pwa-builder.mjs";
import { isDirectCliExecution } from "./preflight.mjs";

const __scaffoldDirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__scaffoldDirname, "../../..");
const MAX_INTROSPECT_BYTES = 65536;
const MAX_INTROSPECT_ROWS = 20;

export function slugifyProject(raw = "") {
  return String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeJsonEmbed(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

export function resolveUniqueSlug(baseSlug, workspaceRoot, { avoidCollision = false } = {}) {
  if (!avoidCollision) return baseSlug;
  const projectsRoot = path.resolve(workspaceRoot, "projects");
  if (!fs.existsSync(path.join(projectsRoot, baseSlug))) {
    return baseSlug;
  }
  let counter = 2;
  while (counter < 1000) {
    const suffix = `-${counter}`;
    const trimmedBase = baseSlug.slice(0, Math.max(1, 60 - suffix.length)).replace(/-+$/, "");
    const candidate = `${trimmedBase}${suffix}`;
    if (!fs.existsSync(path.join(projectsRoot, candidate))) {
      return candidate;
    }
    counter++;
  }
  return `${baseSlug.slice(0, 48)}-${Date.now().toString(36)}`;
}

function isPathInside(parentDir, childPath) {
  const rel = path.relative(path.resolve(parentDir), path.resolve(childPath));
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export function stageReferenceFiles(referenceFiles = [], projectDir, workspaceRoot, slug) {
  if (!Array.isArray(referenceFiles) || referenceFiles.length === 0) return [];
  const resolvedWs = path.resolve(workspaceRoot);
  const refsDir = path.join(projectDir, "refs");
  const staged = [];
  const usedNames = new Set();

  for (const rawRef of referenceFiles) {
    const refObj = typeof rawRef === "string"
      ? { name: path.basename(rawRef), path: rawRef, note: "" }
      : {
          name: String(rawRef?.name || path.basename(rawRef?.path || "reference")),
          path: typeof rawRef?.path === "string" ? rawRef.path : "",
          note: typeof rawRef?.note === "string" ? rawRef.note : "",
          category: typeof rawRef?.category === "string" ? rawRef.category : undefined
        };

    const candidates = [];
    if (refObj.path) {
      candidates.push(path.resolve(resolvedWs, refObj.path));
    }
    const safeName = path.basename(refObj.name).replace(/[^a-zA-Z0-9._-]/g, "_") || "reference";
    candidates.push(path.resolve(resolvedWs, "projects", "_uploads", safeName));
    if (!refObj.path && refObj.name) {
      candidates.push(path.resolve(resolvedWs, refObj.name));
    }

    let sourcePath = null;
    for (const cand of candidates) {
      if (isPathInside(resolvedWs, cand) && fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        sourcePath = cand;
        break;
      }
    }

    if (!sourcePath) {
      staged.push({
        name: refObj.name,
        originalPath: refObj.path || null,
        stagedPath: null,
        note: refObj.note,
        category: refObj.category,
        diskPath: null
      });
      continue;
    }

    fs.mkdirSync(refsDir, { recursive: true });
    let targetName = safeName;
    if (usedNames.has(targetName)) {
      const ext = path.extname(safeName);
      const stem = path.basename(safeName, ext);
      let idx = 2;
      while (usedNames.has(`${stem}-${idx}${ext}`)) idx++;
      targetName = `${stem}-${idx}${ext}`;
    }
    usedNames.add(targetName);

    const destPath = path.join(refsDir, targetName);
    if (path.resolve(sourcePath) !== path.resolve(destPath)) {
      fs.copyFileSync(sourcePath, destPath);
    }

    staged.push({
      name: refObj.name,
      originalPath: path.relative(resolvedWs, sourcePath).replace(/\\/g, "/"),
      stagedPath: `projects/${slug}/refs/${targetName}`,
      note: refObj.note,
      category: refObj.category,
      diskPath: destPath
    });
  }

  return staged;
}

function parseDelimitedLine(line, delimiter) {
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

function parseNumericValue(val) {
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  if (typeof val !== "string") return null;
  const cleaned = val.trim().replace(/[$,%\s]/g, "").replace(/,/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function detectColumnStats(columns, rows) {
  const numericColumns = [];
  for (let colIdx = 0; colIdx < columns.length; colIdx++) {
    const sampleValues = rows.map((r) => r[colIdx]).filter((v) => v !== undefined && v !== null && String(v).trim() !== "");
    if (sampleValues.length === 0) continue;
    const numCount = sampleValues.filter((v) => parseNumericValue(v) !== null).length;
    if (numCount / sampleValues.length >= 0.5) {
      numericColumns.push(columns[colIdx]);
    }
  }
  const labelColumn = columns.find((c) => !numericColumns.includes(c)) || columns[0] || "item";
  return { numericColumns, labelColumn };
}

export function introspectDataFile(filePath, stagedPath = null) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const ext = path.extname(filePath).toLowerCase();
  if (![".csv", ".tsv", ".json"].includes(ext)) return null;

  let text = "";
  try {
    const fd = fs.openSync(filePath, "r");
    try {
      const buf = Buffer.allocUnsafe(MAX_INTROSPECT_BYTES);
      const bytesRead = fs.readSync(fd, buf, 0, MAX_INTROSPECT_BYTES, 0);
      text = buf.subarray(0, bytesRead).toString("utf-8").replace(/^\uFEFF/, "");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }

  const fileName = path.basename(filePath);

  if (ext === ".csv" || ext === ".tsv") {
    const delimiter = ext === ".tsv" ? "\t" : ",";
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return null;
    const columns = parseDelimitedLine(lines[0], delimiter).filter(Boolean);
    if (columns.length === 0) return null;
    const rows = lines.slice(1, MAX_INTROSPECT_ROWS + 1).map((line) => {
      const parsed = parseDelimitedLine(line, delimiter);
      return columns.map((_, idx) => (parsed[idx] !== undefined ? parsed[idx] : ""));
    });
    const { numericColumns, labelColumn } = detectColumnStats(columns, rows);
    return {
      fileName,
      stagedPath,
      format: ext.slice(1),
      columns,
      numericColumns,
      labelColumn,
      rows
    };
  }

  if (ext === ".json") {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }

    let records = null;
    if (Array.isArray(parsed)) {
      records = parsed;
    } else if (parsed && typeof parsed === "object") {
      for (const candidateKey of ["data", "rows", "items", "records", "results"]) {
        if (Array.isArray(parsed[candidateKey])) {
          records = parsed[candidateKey];
          break;
        }
      }
      if (!records) {
        const firstArray = Object.values(parsed).find((v) => Array.isArray(v) && v.length > 0 && typeof v[0] === "object");
        if (firstArray) records = firstArray;
      }
    }

    if (records && records.length > 0 && typeof records[0] === "object" && records[0] !== null && !Array.isArray(records[0])) {
      const slice = records.slice(0, MAX_INTROSPECT_ROWS);
      const colSet = new Set();
      for (const rec of slice) {
        if (rec && typeof rec === "object") {
          for (const k of Object.keys(rec)) colSet.add(k);
        }
      }
      const columns = [...colSet];
      if (columns.length === 0) return null;
      const rows = slice.map((rec) => columns.map((c) => {
        const val = rec?.[c];
        return val === undefined || val === null ? "" : (typeof val === "object" ? JSON.stringify(val) : String(val));
      }));
      const { numericColumns, labelColumn } = detectColumnStats(columns, rows);
      return {
        fileName,
        stagedPath,
        format: "json",
        columns,
        numericColumns,
        labelColumn,
        rows
      };
    }

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed).slice(0, MAX_INTROSPECT_ROWS);
      if (entries.length === 0) return null;
      const columns = ["key", "value"];
      const rows = entries.map(([k, v]) => [String(k), typeof v === "object" ? JSON.stringify(v) : String(v ?? "")]);
      const { numericColumns, labelColumn } = detectColumnStats(columns, rows);
      return {
        fileName,
        stagedPath,
        format: "json",
        columns,
        numericColumns,
        labelColumn,
        rows
      };
    }
  }

  return null;
}

export function introspectReferenceDatasets(stagedRefs = []) {
  const datasets = [];
  for (const ref of stagedRefs) {
    if (!ref.diskPath) continue;
    const ds = introspectDataFile(ref.diskPath, ref.stagedPath);
    if (ds) datasets.push(ds);
  }
  return datasets;
}

function renderKpiRowWidget({ isDashboard = false, dataset = null } = {}) {
  if (dataset && dataset.columns.length > 0) {
    const primaryMetric = dataset.numericColumns[0] || null;
    const secondaryMetric = dataset.numericColumns[1] || null;
    let primaryDisplay = String(dataset.rows.length);
    let primaryTitle = "Sample Rows";
    let primaryDesc = `From ${escapeHtml(dataset.fileName)}`;

    if (primaryMetric) {
      const colIdx = dataset.columns.indexOf(primaryMetric);
      const nums = dataset.rows.map((r) => parseNumericValue(r[colIdx])).filter((v) => v !== null);
      const total = nums.reduce((acc, n) => acc + n, 0);
      primaryTitle = escapeHtml(primaryMetric);
      primaryDisplay = Number.isInteger(total) ? total.toLocaleString("en-US") : total.toFixed(2);
      primaryDesc = `Sum across ${nums.length} row(s)`;
    }

    let secondaryTitle = escapeHtml(dataset.labelColumn || "Dimensions");
    let secondaryDisplay = String(new Set(dataset.rows.map((r) => r[dataset.columns.indexOf(dataset.labelColumn)])).size);
    let secondaryDesc = `Distinct ${escapeHtml(dataset.labelColumn)} values`;

    if (secondaryMetric) {
      const colIdx = dataset.columns.indexOf(secondaryMetric);
      const nums = dataset.rows.map((r) => parseNumericValue(r[colIdx])).filter((v) => v !== null);
      const avg = nums.length ? nums.reduce((acc, n) => acc + n, 0) / nums.length : 0;
      secondaryTitle = escapeHtml(secondaryMetric);
      secondaryDisplay = avg.toFixed(2);
      secondaryDesc = `Average (${nums.length} rows)`;
    }

    return `  <!-- Preset: kpi-row -->
  <section id="kpi-overview" class="space-y-4">
    <h2 id="key-metrics" class="text-xl font-bold">Key Metrics</h2>
    <div class="stats stats-vertical lg:stats-horizontal shadow-sm w-full border border-base-300 bg-base-100">
      <div class="stat">
        <div class="stat-title">${primaryTitle}</div>
        <div class="stat-value text-primary">${primaryDisplay}</div>
        <div class="stat-desc">${primaryDesc}</div>
      </div>
      <div class="stat">
        <div class="stat-title">${secondaryTitle}</div>
        <div class="stat-value text-secondary">${secondaryDisplay}</div>
        <div class="stat-desc">${secondaryDesc}</div>
      </div>
      <div class="stat">
        <div class="stat-title">Records Loaded</div>
        <div class="stat-value text-accent">${dataset.rows.length}</div>
        <div class="stat-desc">${escapeHtml(dataset.fileName)} (${dataset.columns.length} cols)</div>
      </div>
    </div>
  </section>`;
  }

  return `  <!-- Preset: kpi-row -->
  <section id="kpi-overview" class="space-y-4">
    <h2 id="key-metrics" class="text-xl font-bold">Key Metrics</h2>
    <div class="stats stats-vertical lg:stats-horizontal shadow-sm w-full border border-base-300 bg-base-100">
      <div class="stat">
        <div class="stat-title">Primary KPI</div>
        <div class="stat-value text-primary">--</div>
        <div class="stat-desc">Replace with domain metric</div>
      </div>
      <div class="stat">
        <div class="stat-title">Secondary KPI</div>
        <div class="stat-value text-secondary">--</div>
        <div class="stat-desc">Replace with domain metric</div>
      </div>
      <div class="stat">
        <div class="stat-title">Status</div>
        <div class="stat-value text-accent">${isDashboard ? "Live" : "Ready"}</div>
        <div class="stat-desc">Deterministic scaffold</div>
      </div>
    </div>
  </section>`;
}

function renderChartPairWidget({ dataset = null } = {}) {
  let labels = ["Q1", "Q2", "Q3", "Q4"];
  let seriesALabel = "Primary Metric";
  let seriesAData = [42, 58, 74, 91];
  let seriesBLabel = "Secondary Trend";
  let seriesBData = [28, 39, 51, 68];
  let sourceNote = "Placeholder series (attach CSV/JSON or replace with domain metrics)";

  if (dataset && dataset.columns.length > 0 && dataset.rows.length > 0) {
    const labelIdx = Math.max(0, dataset.columns.indexOf(dataset.labelColumn));
    const numA = dataset.numericColumns[0];
    const numB = dataset.numericColumns[1] || dataset.numericColumns[0];
    const numAIdx = numA ? dataset.columns.indexOf(numA) : -1;
    const numBIdx = numB ? dataset.columns.indexOf(numB) : -1;

    labels = dataset.rows.map((r, idx) => String(r[labelIdx] || `Row ${idx + 1}`));
    if (numAIdx !== -1) {
      seriesALabel = numA;
      seriesAData = dataset.rows.map((r) => parseNumericValue(r[numAIdx]) ?? 0);
    }
    if (numBIdx !== -1) {
      seriesBLabel = numB;
      seriesBData = dataset.rows.map((r) => parseNumericValue(r[numBIdx]) ?? 0);
    } else {
      seriesBLabel = `${seriesALabel} (Cumulative)`;
      let running = 0;
      seriesBData = seriesAData.map((v) => {
        running += v;
        return running;
      });
    }
    sourceNote = `Pre-wired from ${escapeHtml(dataset.fileName)} (${escapeHtml(dataset.labelColumn)} vs ${escapeHtml(seriesALabel)})`;
  }

  return `  <!-- Preset: chart-pair -->
  <section id="analytics-charts" class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 id="visual-analytics" class="text-xl font-bold">Visual Analytics</h2>
      <span class="badge badge-ghost badge-sm font-mono">${sourceNote}</span>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="card bg-base-100 border border-base-300 shadow-sm p-5">
        <h3 id="chart-primary-heading" class="text-sm font-bold mb-3">${escapeHtml(seriesALabel)} by ${escapeHtml(dataset?.labelColumn || "Period")}</h3>
        <div class="h-64">
          <canvas id="starter-chart-primary"></canvas>
        </div>
      </div>
      <div class="card bg-base-100 border border-base-300 shadow-sm p-5">
        <h3 id="chart-secondary-heading" class="text-sm font-bold mb-3">${escapeHtml(seriesBLabel)} Trend</h3>
        <div class="h-64">
          <canvas id="starter-chart-secondary"></canvas>
        </div>
      </div>
    </div>
    <script>
      document.addEventListener("DOMContentLoaded", () => {
        if (typeof Chart === "undefined") return;
        const labels = ${safeJsonEmbed(labels)};
        const c1 = document.getElementById("starter-chart-primary");
        if (c1) {
          new Chart(c1, {
            type: "bar",
            data: {
              labels,
              datasets: [{ label: ${safeJsonEmbed(seriesALabel)}, data: ${safeJsonEmbed(seriesAData)}, backgroundColor: "rgba(59, 130, 246, 0.8)" }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
          });
        }
        const c2 = document.getElementById("starter-chart-secondary");
        if (c2) {
          new Chart(c2, {
            type: "line",
            data: {
              labels,
              datasets: [{ label: ${safeJsonEmbed(seriesBLabel)}, data: ${safeJsonEmbed(seriesBData)}, borderColor: "rgba(16, 185, 129, 0.9)", tension: 0.3, fill: false }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
          });
        }
      });
    </script>
  </section>`;
}

function renderGridTableWidget({ dataset = null } = {}) {
  const columns = dataset && dataset.columns.length > 0
    ? dataset.columns
    : ["Segment", "Metric", "Status"];
  const rows = dataset && dataset.rows.length > 0
    ? dataset.rows
    : [
        ["North America", "420000", "On Track"],
        ["EMEA", "315000", "Growing"],
        ["APAC", "210000", "Expanding"]
      ];
  const badgeText = dataset
    ? `Pre-bound to ${escapeHtml(dataset.fileName)} (${rows.length} rows)`
    : "Interactive Grid.js Starter";

  return `  <!-- Preset: grid-table -->
  <section id="data-explorer" class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 id="data-records" class="text-xl font-bold">Data Explorer</h2>
      <span class="badge badge-outline badge-sm font-mono">${badgeText}</span>
    </div>
    <div class="card bg-base-100 border border-base-300 shadow-sm p-4">
      <div id="starter-grid-table" class="overflow-x-auto w-full"></div>
    </div>
    <script>
      document.addEventListener("DOMContentLoaded", () => {
        const target = document.getElementById("starter-grid-table");
        if (!target || typeof gridjs === "undefined") return;
        new gridjs.Grid({
          columns: ${safeJsonEmbed(columns)},
          data: ${safeJsonEmbed(rows)},
          search: true,
          sort: true,
          pagination: { limit: 10 }
        }).render(target);
      });
    </script>
  </section>`;
}

function renderMermaidFlowWidget({ title = "Workflow" } = {}) {
  const safeLabel = String(title).replace(/["[\]<>]/g, "").slice(0, 40) || "Deliverable";
  return `  <!-- Preset: mermaid-flow -->
  <section id="architecture-flow" class="space-y-4">
    <h2 id="process-flow" class="text-xl font-bold">Process &amp; Architecture Flow</h2>
    <div class="card bg-base-100 border border-base-300 shadow-sm p-5 overflow-x-auto">
      <div class="mermaid">
flowchart LR
  Input["Source Inputs"] --> Process["${safeLabel}"]
  Process --> Review["Validation &amp; Insights"]
  Review --> Output["Published Deliverable"]
      </div>
    </div>
  </section>`;
}

function renderTimelineWidget() {
  return `  <!-- Preset: timeline -->
  <section id="milestone-timeline" class="space-y-4">
    <h2 id="delivery-milestones" class="text-xl font-bold">Key Milestones</h2>
    <div class="card bg-base-100 border border-base-300 shadow-sm p-5">
      <ul class="timeline timeline-vertical">
        <li>
          <div class="timeline-start text-xs font-mono text-base-content/60">Phase 1</div>
          <div class="timeline-middle">
            <span class="badge badge-primary badge-xs"></span>
          </div>
          <div class="timeline-end timeline-box text-sm">Data ingestion &amp; schema grounding</div>
          <hr class="bg-primary" />
        </li>
        <li>
          <hr class="bg-primary" />
          <div class="timeline-start text-xs font-mono text-base-content/60">Phase 2</div>
          <div class="timeline-middle">
            <span class="badge badge-secondary badge-xs"></span>
          </div>
          <div class="timeline-end timeline-box text-sm">Analytical breakdown &amp; KPI validation</div>
          <hr />
        </li>
        <li>
          <hr />
          <div class="timeline-start text-xs font-mono text-base-content/60">Phase 3</div>
          <div class="timeline-middle">
            <span class="badge badge-accent badge-xs"></span>
          </div>
          <div class="timeline-end timeline-box text-sm">Executive sign-off &amp; distribution</div>
        </li>
      </ul>
    </div>
  </section>`;
}

export function generateStarterFragment({
  title = "New Project Report",
  mode = "report",
  slug = "new-project",
  ai = false,
  widgets = [],
  datasets = [],
  stagedRefs = [],
  goals = "",
  audience = ""
} = {}) {
  const safeTitle = escapeHtml(title);
  const isDashboard = mode === "dashboard" || mode === "live-report";
  const isPresentation = mode === "presentation";
  const primaryDataset = Array.isArray(datasets) && datasets.length > 0 ? datasets[0] : null;

  const validWidgets = Array.isArray(widgets)
    ? widgets.map((w) => String(w).trim().toLowerCase()).filter((w) => Object.prototype.hasOwnProperty.call(WIDGET_PRESETS, w))
    : [];

  if (isPresentation && validWidgets.length === 0) {
    const goalCopy = goals
      ? `<p class="text-base sm:text-lg text-base-content/75 max-w-2xl">${escapeHtml(goals)}</p>`
      : `<p class="text-base sm:text-lg text-base-content/75 max-w-2xl">Scaffolded project <code>${escapeHtml(slug)}</code> in <strong>${escapeHtml(mode)}</strong> mode with Reveal.js, Fullscreen, and Follow-Along Notes.</p>`;
    return `<main id="report-main" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1 w-full">
  <div id="presentation-shell">
    <div class="presentation-toolbar flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-base-100 border border-base-300 rounded-box shadow-sm print:hidden">
      <div class="flex items-center gap-2 text-xs text-base-content/75 font-mono">
        <span class="badge badge-primary badge-outline badge-xs font-mono">Reveal.js</span>
        <span id="presentation-toolbar-counter">1 / 3</span>
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        <button id="presentation-notes-btn" type="button" class="btn btn-xs btn-ghost border border-base-300 gap-1.5" title="Toggle Follow-Along Speaker Notes (N)" aria-pressed="false">
          <span>Notes</span>
          <kbd class="kbd kbd-xs font-mono hidden sm:inline-flex">N</kbd>
          <span id="presentation-notes-dot" class="hidden w-2 h-2 rounded-full bg-primary" aria-hidden="true"></span>
        </button>
        <button id="presentation-stack-btn" type="button" class="btn btn-xs btn-ghost border border-base-300 gap-1.5" title="Toggle Stacked All-Slides View" aria-pressed="false">
          <span>All Slides</span>
        </button>
        <button id="presentation-fullscreen-btn" type="button" class="btn btn-xs btn-primary gap-1.5" title="Enter Fullscreen Presentation (F)" aria-pressed="false">
          <span>Fullscreen</span>
          <kbd class="kbd kbd-xs bg-primary-content/20 text-primary-content border-none font-mono hidden sm:inline-flex">F</kbd>
        </button>
      </div>
    </div>

    <div class="reveal-stage">
      <div class="reveal" id="presentation-deck">
        <div class="slides">
          <!-- Slide 1: Hero -->
          <section id="slide-overview" data-title="${safeTitle}">
            <div class="slide-body min-h-full w-full max-w-6xl mx-auto flex flex-col justify-center gap-5 sm:gap-6">
              <div class="flex flex-wrap items-center gap-2">
                <span class="badge badge-primary badge-outline badge-sm font-mono">${escapeHtml(mode)}</span>
                ${audience ? `<span class="badge badge-ghost badge-sm font-mono">Audience: ${escapeHtml(audience)}</span>` : ""}
              </div>
              <h1 id="overview-title" class="text-3xl sm:text-5xl font-black tracking-tight text-base-content">${safeTitle}</h1>
              ${goalCopy}
              <div class="flex flex-wrap items-center gap-3 text-xs text-base-content/60 font-mono pt-2">
                <span>Press <kbd class="kbd kbd-xs">F</kbd> Fullscreen</span>
                <span>&bull;</span>
                <span>Press <kbd class="kbd kbd-xs">N</kbd> Speaker Notes</span>
                <span>&bull;</span>
                <span>Use <kbd class="kbd kbd-xs">&larr;</kbd> <kbd class="kbd kbd-xs">&rarr;</kbd> to navigate</span>
              </div>
            </div>
            <aside class="notes">
              <p><strong>Opening:</strong> Welcome everyone to <em>${safeTitle}</em>.</p>
              <ul>
                <li>Press <strong>F</strong> for Top-Layer Fullscreen while keeping Notes visible.</li>
                <li>Press <strong>N</strong> to toggle this floating follow-along Notes popup.</li>
              </ul>
            </aside>
          </section>

          <!-- Slide 2: Key Highlights -->
          <section id="slide-metrics" data-title="Key Highlights">
            <div class="slide-body min-h-full w-full max-w-6xl mx-auto flex flex-col justify-center gap-5 sm:gap-6">
              <div>
                <span class="text-xs font-mono uppercase tracking-wider text-primary font-bold">Executive Snapshot</span>
                <h2 id="key-highlights" class="text-2xl sm:text-3xl font-extrabold mt-1">Key Highlights</h2>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
                <div class="card bg-base-200/60 border border-base-300 shadow-sm">
                  <div class="card-body p-5">
                    <span class="text-xs font-mono text-base-content/60">Primary Metric</span>
                    <div class="text-3xl font-black text-primary mt-1">100%</div>
                    <p class="text-sm text-base-content/70 mt-1">Ready for domain metrics and charts</p>
                  </div>
                </div>
                <div class="card bg-base-200/60 border border-base-300 shadow-sm">
                  <div class="card-body p-5">
                    <span class="text-xs font-mono text-base-content/60">Layout Engine</span>
                    <div class="text-3xl font-black text-secondary mt-1">Reveal.js</div>
                    <p class="text-sm text-base-content/70 mt-1">Embedded stage with safe-zone padding</p>
                  </div>
                </div>
                <div class="card bg-base-200/60 border border-base-300 shadow-sm">
                  <div class="card-body p-5">
                    <span class="text-xs font-mono text-base-content/60">Pipeline Status</span>
                    <div class="text-3xl font-black text-accent mt-1">Scaffolded</div>
                    <p class="text-sm text-base-content/70 mt-1">Edit <code>fragment.html</code> to update</p>
                  </div>
                </div>
              </div>
            </div>
            <aside class="notes">
              <p>Walk through the three core metrics before diving into the vertical sub-slide details.</p>
            </aside>
          </section>

          <!-- Slide 3: Vertical Deep-Dive Stack -->
          <section>
            <section id="slide-next-steps" data-title="Next Steps &amp; Deep Dive">
              <div class="slide-body min-h-full w-full max-w-6xl mx-auto flex flex-col justify-center gap-5 sm:gap-6">
                <span class="badge badge-secondary badge-outline badge-sm font-mono w-fit">Vertical Stack &darr;</span>
                <h2 id="next-steps" class="text-2xl sm:text-3xl font-extrabold">Authoring Best Practices</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div class="p-5 rounded-box bg-base-200/60 border border-base-300 space-y-2">
                    <h3 class="font-bold text-base text-primary">1. Use .slide-body Wrappers</h3>
                    <p class="text-sm text-base-content/75">Keep padding on <code>&lt;section&gt;</code> CSS tokens and apply Tailwind flex/gap utilities inside <code>.slide-body</code>.</p>
                  </div>
                  <div class="p-5 rounded-box bg-base-200/60 border border-base-300 space-y-2">
                    <h3 class="font-bold text-base text-secondary">2. Add Speaker Notes</h3>
                    <p class="text-sm text-base-content/75">Place rich HTML inside <code>&lt;aside class="notes"&gt;</code> or plain text in <code>data-notes</code>.</p>
                  </div>
                </div>
              </div>
              <aside class="notes">
                <p>Press the Down arrow to show the vertical sub-slide detail.</p>
              </aside>
            </section>
            <section id="slide-vertical-detail" data-title="Speaker Notes &amp; Export Parity" data-notes="Remind the audience that Fullscreen and Speaker Notes remain active in --published HTML exports.">
              <div class="slide-body min-h-full w-full max-w-6xl mx-auto flex flex-col justify-center gap-5 sm:gap-6">
                <h3 id="export-parity" class="text-2xl font-bold text-secondary">Standalone &amp; Published Parity</h3>
                <p class="text-base text-base-content/80 max-w-3xl">Both Fullscreen (<code>F</code>) and Follow-Along Speaker Notes (<code>N</code>) work offline over <code>file://</code> and survive <code>--published</code> exports.</p>
              </div>
            </section>
          </section>
        </div>
      </div>
    </div>
  </div>
</main>
`;
  }

  const refSummaryHtml = Array.isArray(stagedRefs) && stagedRefs.some((r) => r.stagedPath)
    ? `\n    <div class="flex flex-wrap gap-1.5 pt-1">${stagedRefs.filter((r) => r.stagedPath).map((r) => `<span class="badge badge-outline badge-xs font-mono">${escapeHtml(r.stagedPath)}</span>`).join("")}</div>`
    : "";
  const goalSubtitle = goals ? `<p class="text-sm text-base-content/80 mt-2">${escapeHtml(goals)}</p>` : "";
  const audienceBadge = audience ? `<span class="badge badge-ghost badge-sm font-mono">Audience: ${escapeHtml(audience)}</span>` : "";

  const heroSection = `  <!-- Hero Header -->
  <section id="overview" class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-base-300 pb-4">
      <div>
        <div class="flex flex-wrap items-center gap-2 mb-2">
          <div class="badge badge-primary badge-outline badge-sm font-mono">${escapeHtml(mode)}</div>
          ${audienceBadge}
        </div>
        <h1 id="report-title" class="text-3xl font-extrabold tracking-tight">${safeTitle}</h1>
        <p class="text-sm text-base-content/70 mt-1">Project scaffold: <code>projects/${escapeHtml(slug)}/</code>${ai ? " · Two-Way Agent Bridge enabled" : ""}</p>${goalSubtitle}${refSummaryHtml}
      </div>
    </div>
  </section>`;

  // Render requested widget presets or sensible defaults (auto-wiring attached datasets if present)
  const effectiveWidgets = validWidgets.length > 0
    ? validWidgets
    : (primaryDataset
        ? ["kpi-row", ...(primaryDataset.numericColumns.length > 0 ? ["chart-pair"] : []), "grid-table"]
        : ["kpi-row"]);

  const widgetBlocks = [];
  for (const w of effectiveWidgets) {
    if (w === "kpi-row") widgetBlocks.push(renderKpiRowWidget({ isDashboard, dataset: primaryDataset }));
    else if (w === "chart-pair") widgetBlocks.push(renderChartPairWidget({ dataset: primaryDataset }));
    else if (w === "grid-table") widgetBlocks.push(renderGridTableWidget({ dataset: primaryDataset }));
    else if (w === "mermaid-flow") widgetBlocks.push(renderMermaidFlowWidget({ title }));
    else if (w === "timeline") widgetBlocks.push(renderTimelineWidget());
  }

  if (validWidgets.length === 0 && !primaryDataset) {
    widgetBlocks.push(`  <!-- Primary Analysis Section -->
  <section id="analysis" class="card bg-base-100 border border-base-300 shadow-sm">
    <div class="card-body">
      <h2 id="core-analysis" class="card-title text-xl font-bold">Core Analysis</h2>
      <p class="text-sm text-base-content/70">Populate this section in <code>projects/${escapeHtml(slug)}/fragment.html</code> with domain charts, Mermaid diagrams, or data tables.</p>
    </div>
  </section>`);
  }

  return `<main id="report-main" class="container mx-auto px-4 sm:px-6 py-8 space-y-8">
${heroSection}

${widgetBlocks.join("\n\n")}
</main>
`;
}

export function generateProjectAgentsMd(manifest) {
  const aiPurposeLine = manifest.aiBridge && manifest.aiConfig?.purpose
    ? `\n- **AI Board Support Purpose**: ${manifest.aiConfig.purpose}`
    : "";
  const aiConfigLines = manifest.aiBridge && manifest.aiConfig
    ? `\n- **Turnkey AI Bridge Port**: \`${manifest.aiConfig.port}\`\n- **Turnkey AI Default Model**: \`${manifest.aiConfig.model}\`\n- **Turnkey AI Default Persona**: \`${manifest.aiConfig.persona}\`${aiPurposeLine}`
    : "";
  const authoringGuideLink = manifest.pipeline?.authoringGuide || "../../skills/html-report/references/agent-authoring-guide.md";
  const verifyCmd = manifest.pipeline?.verifyCommand || `node skills/html-report/playwright/verify-report.mjs ${manifest.files.entry}`;

  return `# Project Agent Guide: ${manifest.title}

- **Project Slug**: \`${manifest.project}\`
- **Archetype / Mode**: \`${manifest.mode}\`
- **Theme**: \`${manifest.theme}\`
- **Two-Way Agent Bridge**: \`${manifest.aiBridge ? "enabled (--ai)" : "disabled"}\`${aiConfigLines}

## Source of Truth & Pipeline

1. **Edit the Semantic Fragment**: [fragment.html](./fragment.html) (\`<main id="report-main">\`). Do **not** hand-edit \`index.html\` directly.
2. **Rebuild the Deliverable**:
   \`\`\`bash
   ${manifest.pipeline.rebuildCommand}
   \`\`\`
   *(or \`npm --prefix projects/${manifest.project} run build\`)*
3. **Live Preview & Two-Way Bridge**:
   \`\`\`bash
   ${manifest.pipeline.serveCommand}
   \`\`\`
   *(or \`npm --prefix projects/${manifest.project} run serve\`)*
4. **Verify the Deliverable**:
   \`\`\`bash
   ${verifyCmd}
   \`\`\`
   *(or \`npm --prefix projects/${manifest.project} run verify\`)*
5. **Machine-Readable Manifest**: See [report.manifest.json](./report.manifest.json) (and the embedded \`#agent-manifest\` JSON in \`index.html\`) for deterministic section and widget selectors.

For full authoring conventions, see [agent-authoring-guide.md](${authoringGuideLink}).
`;
}

export function generateProjectPackageJson(manifest) {
  const pkg = {
    name: `html-report-project-${manifest.project || "board"}`,
    version: "1.0.0",
    private: true,
    type: "module",
    description: `Local runner scripts for html-report project: ${manifest.title}`,
    scripts: {
      build: `cd ../.. && ${manifest.pipeline.rebuildCommand}`,
      serve: `cd ../.. && ${manifest.pipeline.serveCommand}`,
      verify: `cd ../.. && ${manifest.pipeline.verifyCommand || `node skills/html-report/playwright/verify-report.mjs ${manifest.files.entry}`}`,
      preflight: `cd ../.. && ${manifest.pipeline.preflightCommand || "node skills/html-report/scripts/preflight.mjs --json"}`
    }
  };
  return JSON.stringify(pkg, null, 2) + "\n";
}

export function scaffoldProject({
  project,
  topic = null,
  title = null,
  mode = "report",
  theme = "light",
  customTheme = null,
  favicon = "📊",
  addons = [],
  widgets = [],
  referenceFiles = [],
  servingMode = null,
  behavioralMode = null,
  goals = "",
  audience = "",
  ai = false,
  aiPort = 3031,
  aiModel = "Gemini 3.8 Flash (Low)",
  aiPersona = "analyst",
  aiPurpose = "",
  aiDock = true,
  pwa = false,
  content = null,
  force = false,
  avoidCollision = false,
  rootDir = null,
  workspaceRoot = rootDir || process.cwd()
} = {}) {
  const baseSlug = slugifyProject(project || topic || title);
  if (!baseSlug) {
    throw new Error("A valid --project <slug> is required (letters, numbers, hyphens).");
  }

  const slug = resolveUniqueSlug(baseSlug, workspaceRoot, { avoidCollision: Boolean(avoidCollision && !force) });
  const resolvedMode = normalizeMode(mode) || "report";
  const resolvedTitle = (title || topic) && String(title || topic).trim()
    ? String(title || topic).trim()
    : slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const projectDir = path.resolve(workspaceRoot, "projects", slug);
  fs.mkdirSync(projectDir, { recursive: true });

  const stagedRefs = stageReferenceFiles(referenceFiles, projectDir, workspaceRoot, slug);
  const datasets = introspectReferenceDatasets(stagedRefs);

  const normalizedWidgets = Array.isArray(widgets)
    ? [...new Set(widgets.map((w) => String(w || "").trim().toLowerCase()).filter((w) => Object.prototype.hasOwnProperty.call(WIDGET_PRESETS, w)))]
    : [];

  // Ensure addons needed by chosen widget presets or introspected datasets are enabled
  const resolvedAddons = [...new Set(Array.isArray(addons) ? addons.map((a) => String(a).trim().toLowerCase()).filter(Boolean) : [])];
  for (const wKey of normalizedWidgets) {
    for (const reqAddon of WIDGET_PRESETS[wKey].addons || []) {
      if (!resolvedAddons.includes(reqAddon)) resolvedAddons.push(reqAddon);
    }
  }
  if (datasets.length > 0) {
    if (!resolvedAddons.includes("gridjs")) resolvedAddons.push("gridjs");
    if (datasets[0].numericColumns.length > 0 && !resolvedAddons.includes("charts")) {
      resolvedAddons.push("charts");
    }
  }

  const fragmentRel = `projects/${slug}/fragment.html`;
  const entryRel = `projects/${slug}/index.html`;
  const fragmentPath = path.join(projectDir, "fragment.html");
  const entryPath = path.join(projectDir, "index.html");
  const manifestPath = path.join(projectDir, "report.manifest.json");
  const agentsPath = path.join(projectDir, "AGENTS.md");
  const packageJsonPath = path.join(projectDir, "package.json");

  let fragmentHtml;
  if (content) {
    fragmentHtml = content;
    fs.writeFileSync(fragmentPath, fragmentHtml, "utf-8");
  } else if (!fs.existsSync(fragmentPath) || force) {
    fragmentHtml = generateStarterFragment({
      title: resolvedTitle,
      mode: resolvedMode,
      slug,
      ai,
      widgets: normalizedWidgets,
      datasets,
      stagedRefs,
      goals,
      audience
    });
    fs.writeFileSync(fragmentPath, fragmentHtml, "utf-8");
  } else {
    fragmentHtml = fs.readFileSync(fragmentPath, "utf-8");
  }

  const resolvedTheme = theme === "lemon" ? "lemonade" : theme;
  const built = buildReport({
    title: resolvedTitle,
    content: fragmentHtml,
    project: slug,
    contentPath: fragmentRel,
    mode: resolvedMode,
    theme: resolvedTheme,
    customTheme,
    favicon,
    addons: resolvedAddons,
    ai,
    aiPort,
    aiModel,
    aiPersona,
    aiPurpose,
    aiDock,
    pwa,
    source: entryRel,
    workspaceRoot
  });

  // Enrich report.manifest.json with Two-Axis metadata, widget presets, staged refs, and custom theme
  const enrichedManifest = {
    ...built.agentManifest,
    servingMode: servingMode || (resolvedMode === "dashboard" || resolvedMode === "live-report" ? "live" : "static"),
    behavioralMode: behavioralMode || (resolvedMode === "print" ? "passive" : "interactive"),
    ...(normalizedWidgets.length > 0 ? { presetWidgets: normalizedWidgets } : {}),
    ...(stagedRefs.length > 0 ? {
      referenceFiles: stagedRefs.map(({ diskPath, ...rest }) => rest)
    } : {}),
    ...(customTheme ? { customTheme } : {}),
    ...(audience ? { audience } : {}),
    ...(goals ? { goals } : {})
  };

  fs.writeFileSync(entryPath, built.html, "utf-8");
  fs.writeFileSync(manifestPath, JSON.stringify(enrichedManifest, null, 2) + "\n", "utf-8");
  fs.writeFileSync(agentsPath, generateProjectAgentsMd(enrichedManifest), "utf-8");
  fs.writeFileSync(packageJsonPath, generateProjectPackageJson(enrichedManifest), "utf-8");

  if (built.isPwa && built.pwaConfig) {
    generatePwaAssets({
      outputDir: projectDir,
      reportFileName: "index.html",
      title: built.pwaConfig.title,
      shortName: built.pwaConfig.shortName,
      themeColor: built.pwaConfig.themeColor,
      backgroundColor: built.pwaConfig.backgroundColor,
      emoji: built.pwaConfig.emoji,
      writeFiles: true
    });
  }

  // Mirror scaffolded project to REPO_ROOT/projects/<slug>/ when invoked from an external directory
  const resolvedWorkspace = path.resolve(workspaceRoot);
  if (
    !rootDir &&
    !resolvedWorkspace.startsWith(os.tmpdir()) &&
    resolvedWorkspace !== REPO_ROOT &&
    fs.existsSync(path.join(REPO_ROOT, "create.html"))
  ) {
    const repoProjectDir = path.join(REPO_ROOT, "projects", slug);
    try {
      fs.mkdirSync(repoProjectDir, { recursive: true });
      fs.cpSync(projectDir, repoProjectDir, { recursive: true, force: true });
    } catch (_) {}
  }

  return {
    slug,
    projectDir,
    packageJsonPath,
    agentsMdPath: agentsPath,
    stagedRefs: stagedRefs.map(({ diskPath, ...rest }) => rest),
    datasets: datasets.map(({ rows, ...summary }) => ({ ...summary, sampleRowCount: rows.length })),
    files: {
      fragment: fragmentPath,
      entry: entryPath,
      manifest: manifestPath,
      agents: agentsPath,
      packageJson: packageJsonPath
    },
    manifest: enrichedManifest
  };
}

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    project: null,
    title: null,
    mode: "report",
    theme: "light",
    customTheme: null,
    favicon: "📊",
    addons: [],
    widgets: [],
    referenceFiles: [],
    ai: false,
    aiPort: 3031,
    aiModel: "Gemini 3.8 Flash (Low)",
    aiPersona: "analyst",
    aiPurpose: "",
    aiDock: true,
    pwa: false,
    content: null,
    force: false,
    unique: false,
    json: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") opts.help = true;
    else if ((arg === "--project" || arg === "-p") && args[i + 1]) opts.project = args[++i];
    else if ((arg === "--title" || arg === "-t") && args[i + 1]) opts.title = args[++i];
    else if ((arg === "--mode" || arg === "-m") && args[i + 1]) opts.mode = args[++i];
    else if (arg === "--theme" && args[i + 1]) opts.theme = args[++i];
    else if ((arg === "--custom-theme" || arg === "-ct") && args[i + 1]) opts.customTheme = args[++i];
    else if (arg === "--favicon" && args[i + 1]) opts.favicon = args[++i];
    else if (arg === "--addons" && args[i + 1]) {
      opts.addons.push(...args[++i].split(",").map((s) => s.trim()).filter(Boolean));
    }
    else if (arg === "--widgets" && args[i + 1]) {
      opts.widgets.push(...args[++i].split(",").map((s) => s.trim()).filter(Boolean));
    }
    else if (arg === "--ref" && args[i + 1]) {
      opts.referenceFiles.push(args[++i]);
    }
    else if (arg === "--charts") opts.addons.push("charts");
    else if (arg === "--mermaid") opts.addons.push("mermaid");
    else if (arg === "--gridjs") opts.addons.push("gridjs");
    else if (arg === "--katex" || arg === "--math") opts.addons.push("katex");
    else if (arg === "--leaflet") opts.addons.push("leaflet");
    else if (arg === "--hljs" || arg === "--highlight") opts.addons.push("hljs");
    else if (arg === "--dayjs" || arg === "--day") opts.addons.push("dayjs");
    else if (arg === "--showdown") opts.addons.push("showdown");
    else if (arg === "--quill" || arg === "--editor") opts.addons.push("quill");
    else if (arg === "--fullcalendar") opts.addons.push("fullcalendar");
    else if (arg === "--ai" || arg === "--bridge") opts.ai = true;
    else if (arg === "--ai-port" && args[i + 1]) {
      const parsedPort = Number(args[++i]);
      if (Number.isFinite(parsedPort) && parsedPort > 0) opts.aiPort = parsedPort;
      opts.ai = true;
    }
    else if (arg === "--ai-model" && args[i + 1]) {
      opts.aiModel = args[++i];
      opts.ai = true;
    }
    else if (arg === "--ai-persona" && args[i + 1]) {
      opts.aiPersona = args[++i];
      opts.ai = true;
    } else if (arg === "--ai-purpose" && args[i + 1]) {
      opts.aiPurpose = args[++i];
      opts.ai = true;
    } else if (arg === "--ai-dock") {
      opts.aiDock = true;
      opts.ai = true;
    } else if (arg === "--no-ai-dock") {
      opts.aiDock = false;
      opts.ai = true;
    }
    else if (arg === "--pwa") opts.pwa = true;
    else if ((arg === "--content" || arg === "-c") && args[i + 1]) opts.content = args[++i];
    else if (arg === "--force" || arg === "-f") opts.force = true;
    else if (arg === "--unique") opts.unique = true;
    else if (arg === "--json") opts.json = true;
    else if (!arg.startsWith("-") && !opts.project) opts.project = arg;
  }
  return opts;
}

const isDirectCli = isDirectCliExecution(process.argv[1], import.meta.url);

if (isDirectCli) {
  const opts = parseCliArgs(process.argv);
  if (opts.help || !opts.project) {
    console.log(`
html-report Project Scaffolding CLI (scaffold-project.mjs)

Usage:
  node skills/html-report/scripts/scaffold-project.mjs --project <slug> [options]

Options:
  -p, --project <slug>   Project directory slug under projects/<slug>/ (required)
  -t, --title <string>   Report / deliverable title
  -m, --mode <name>      Archetype mode: ${CANONICAL_MODES.join(", ")} (default: report)
      --theme <name>     DaisyUI theme (default: light)
      --addons <list>    Comma-separated addons (charts,mermaid,gridjs,...)
      --widgets <list>   Comma-separated presets (${Object.keys(WIDGET_PRESETS).join(",")})
      --ref <path>       Reference file to stage into refs/ and introspect (repeatable)
      --ai, --bridge     Pre-bake Two-Way AI Agent Bridge controls (--ai)
      --ai-port <port>   Turnkey AI bridge server port (default: 3031)
      --ai-model <name>  Turnkey AI default model (default: "Gemini 3.8 Flash (Low)")
      --ai-persona <id>  Turnkey AI default persona (default: analyst)
      --pwa              Include PWA manifest, service worker, and icon
  -c, --content <file>   Seed fragment.html from an existing HTML file
  -f, --force            Overwrite existing fragment.html
      --unique           Auto-increment slug (-2, -3) if project folder already exists
      --json             Output machine-readable JSON summary
  -h, --help             Show this help
`);
    process.exit(opts.help ? 0 : 1);
  }

  let seededContent = null;
  if (opts.content) {
    const resolvedContent = path.resolve(process.cwd(), opts.content);
    if (!fs.existsSync(resolvedContent)) {
      console.error(`Error: Content file not found: ${resolvedContent}`);
      process.exit(1);
    }
    seededContent = fs.readFileSync(resolvedContent, "utf-8");
  }

  const result = scaffoldProject({
    project: opts.project,
    title: opts.title,
    mode: opts.mode,
    theme: opts.theme,
    customTheme: opts.customTheme,
    favicon: opts.favicon,
    addons: [...new Set(opts.addons)],
    widgets: [...new Set(opts.widgets)],
    referenceFiles: opts.referenceFiles,
    ai: opts.ai,
    aiPort: opts.aiPort,
    aiModel: opts.aiModel,
    aiPersona: opts.aiPersona,
    aiPurpose: opts.aiPurpose,
    aiDock: opts.aiDock,
    pwa: opts.pwa,
    content: seededContent,
    force: opts.force,
    avoidCollision: opts.unique
  });

  if (opts.json) {
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  } else {
    console.log(`[html-report] Scaffolded project "projects/${result.slug}/":`);
    console.log(`  Fragment:  ${result.files.fragment}`);
    console.log(`  Entry:     ${result.files.entry}`);
    console.log(`  Manifest:  ${result.files.manifest}`);
    console.log(`  Agents:    ${result.files.agents}`);
    console.log(`  Rebuild:   ${result.manifest.pipeline.rebuildCommand}`);
  }
}
