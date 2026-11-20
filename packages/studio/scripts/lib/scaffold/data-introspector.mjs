/**
 * @file lib/scaffold/data-introspector.mjs
 * Slug generation, workspace reference file staging, and bounded CSV/TSV/JSON
 * dataset introspection for project scaffolding.
 */

import fs from "node:fs";
import path from "node:path";

const MAX_INTROSPECT_BYTES = 65536;
const MAX_INTROSPECT_ROWS = 20;

export function slugifyProject(raw = "") {
  return String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function collectDiskWorkspaceRefs(projectDir, slug, existingStaged = []) {
  const refsDir = path.join(projectDir, "refs");
  if (!fs.existsSync(refsDir)) return [];
  const seen = new Set(existingStaged.map((r) => r.stagedPath).filter(Boolean));
  const discovered = [];
  const walkRefs = (dir) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkRefs(full);
      } else if (entry.isFile()) {
        const relInsideRefs = path.relative(refsDir, full).replace(/\\/g, "/");
        const stagedPath = `projects/${slug}/refs/${relInsideRefs}`;
        if (seen.has(stagedPath)) continue;
        seen.add(stagedPath);
        discovered.push({
          name: entry.name,
          originalPath: stagedPath,
          stagedPath,
          note: "",
          diskPath: full
        });
      }
    }
  };
  walkRefs(refsDir);
  return discovered;
}

export function resolveUniqueSlug(baseSlug, workspaceRoot, { avoidCollision = false } = {}) {
  if (!avoidCollision) return baseSlug;
  const projectsRoot = path.resolve(workspaceRoot, "projects");
  const hasScaffoldedProject = (candidateSlug) => {
    const dir = path.join(projectsRoot, candidateSlug);
    return (
      fs.existsSync(path.join(dir, "index.html")) ||
      fs.existsSync(path.join(dir, "fragment.html")) ||
      fs.existsSync(path.join(dir, "report.manifest.json"))
    );
  };
  if (!hasScaffoldedProject(baseSlug)) {
    return baseSlug;
  }
  let counter = 2;
  while (counter < 1000) {
    const suffix = `-${counter}`;
    const trimmedBase = baseSlug.slice(0, Math.max(1, 60 - suffix.length)).replace(/-+$/, "");
    const candidate = `${trimmedBase}${suffix}`;
    if (!hasScaffoldedProject(candidate)) {
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
    let outsideWorkspace = false;
    for (const cand of candidates) {
      const inside = isPathInside(resolvedWs, cand);
      if (inside && fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        sourcePath = cand;
        break;
      }
      if (!inside && fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        outsideWorkspace = true;
      }
    }

    if (!sourcePath) {
      const reason = outsideWorkspace ? "outside_workspace" : "not_found";
      const warning = outsideWorkspace
        ? `Reference file "${refObj.path || refObj.name}" is outside workspaceRoot (${resolvedWs}); copy it into projects/_uploads/ or projects/${slug}/refs/ first.`
        : `Reference file "${refObj.path || refObj.name}" was not found inside workspaceRoot (${resolvedWs}).`;
      staged.push({
        name: refObj.name,
        originalPath: refObj.path || null,
        stagedPath: null,
        note: refObj.note,
        category: refObj.category,
        diskPath: null,
        reason,
        warning
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

export function parseNumericValue(val) {
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  if (typeof val !== "string") return null;
  const cleaned = val.trim().replace(/[$,%\s]/g, "").replace(/,/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function detectColumnStats(columns, rows) {
  const numericColumns = [];
  const columnSummaries = {};
  for (let colIdx = 0; colIdx < columns.length; colIdx++) {
    const sampleValues = rows.map((r) => r[colIdx]).filter((v) => v !== undefined && v !== null && String(v).trim() !== "");
    if (sampleValues.length === 0) continue;
    const numericValues = sampleValues.map((v) => parseNumericValue(v)).filter((v) => v !== null);
    if (numericValues.length / sampleValues.length >= 0.5) {
      const colName = columns[colIdx];
      numericColumns.push(colName);
      let sum = 0;
      let min = numericValues[0];
      let max = numericValues[0];
      for (const n of numericValues) {
        sum += n;
        if (n < min) min = n;
        if (n > max) max = n;
      }
      const count = numericValues.length;
      columnSummaries[colName] = {
        count,
        sum: Number(sum.toFixed(6)),
        avg: Number((sum / count).toFixed(6)),
        min,
        max
      };
    }
  }
  const labelColumn = columns.find((c) => !numericColumns.includes(c)) || columns[0] || "item";
  return { numericColumns, labelColumn, columnSummaries };
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
    const allRows = lines.slice(1).map((line) => {
      const parsed = parseDelimitedLine(line, delimiter);
      return columns.map((_, idx) => (parsed[idx] !== undefined ? parsed[idx] : ""));
    });
    const rows = allRows.slice(0, MAX_INTROSPECT_ROWS);
    const { numericColumns, labelColumn, columnSummaries } = detectColumnStats(columns, allRows);
    return {
      fileName,
      stagedPath,
      format: ext.slice(1),
      rowCount: allRows.length,
      columns,
      numericColumns,
      labelColumn,
      columnSummaries,
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
      const toRow = (rec) => columns.map((c) => {
        const val = rec?.[c];
        return val === undefined || val === null ? "" : (typeof val === "object" ? JSON.stringify(val) : String(val));
      });
      const allRows = records.map(toRow);
      const rows = allRows.slice(0, MAX_INTROSPECT_ROWS);
      const { numericColumns, labelColumn, columnSummaries } = detectColumnStats(columns, allRows);
      return {
        fileName,
        stagedPath,
        format: "json",
        rowCount: allRows.length,
        columns,
        numericColumns,
        labelColumn,
        columnSummaries,
        rows
      };
    }

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const allEntries = Object.entries(parsed);
      if (allEntries.length === 0) return null;
      const columns = ["key", "value"];
      const allRows = allEntries.map(([k, v]) => [String(k), typeof v === "object" ? JSON.stringify(v) : String(v ?? "")]);
      const rows = allRows.slice(0, MAX_INTROSPECT_ROWS);
      const { numericColumns, labelColumn, columnSummaries } = detectColumnStats(columns, allRows);
      return {
        fileName,
        stagedPath,
        format: "json",
        rowCount: allRows.length,
        columns,
        numericColumns,
        labelColumn,
        columnSummaries,
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
