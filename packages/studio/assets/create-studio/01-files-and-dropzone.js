let currentTarget = "report";
let currentMode = "static"; // "static" (Static File) or "live" (Server-Connected)
let currentBehavioral = "interactive"; // "interactive" | "passive"
let currentApp = "none";    // "none", "live-app", or "offline-app"
let currentTheme = "light";
let userCustomTheme = null; // Single managed custom theme: { name: "user", colors: { ... } }

// Collected Reference Documents, Images & Data-Sets
let collectedFiles = [];

// Set of known file types with dedicated icons & styling
const KNOWN_FILE_TYPES = {
  // Images & Diagrams
  png: { icon: "image", category: "Image", colorClass: "text-success" },
  jpg: { icon: "image", category: "Image", colorClass: "text-success" },
  jpeg: { icon: "image", category: "Image", colorClass: "text-success" },
  gif: { icon: "image", category: "Image", colorClass: "text-success" },
  svg: { icon: "image", category: "Vector Image", colorClass: "text-success" },
  webp: { icon: "image", category: "Image", colorClass: "text-success" },
  bmp: { icon: "image", category: "Image", colorClass: "text-success" },
  ico: { icon: "image", category: "Icon", colorClass: "text-success" },

  // Datasets & Spreadsheets
  csv: { icon: "file-spreadsheet", category: "CSV Dataset", colorClass: "text-accent" },
  tsv: { icon: "file-spreadsheet", category: "TSV Dataset", colorClass: "text-accent" },
  xlsx: { icon: "file-spreadsheet", category: "Excel Sheet", colorClass: "text-accent" },
  xls: { icon: "file-spreadsheet", category: "Excel Sheet", colorClass: "text-accent" },
  parquet: { icon: "file-spreadsheet", category: "Parquet Data", colorClass: "text-accent" },

  // Documents
  pdf: { icon: "file-text", category: "PDF Document", colorClass: "text-error" },
  md: { icon: "file-text", category: "Markdown Doc", colorClass: "text-info" },
  markdown: { icon: "file-text", category: "Markdown Doc", colorClass: "text-info" },
  txt: { icon: "file-text", category: "Text Document", colorClass: "text-info" },
  doc: { icon: "file-text", category: "Word Document", colorClass: "text-info" },
  docx: { icon: "file-text", category: "Word Document", colorClass: "text-info" },
  rtf: { icon: "file-text", category: "Rich Text", colorClass: "text-info" },

  // Code & Schemas
  json: { icon: "file-code", category: "JSON Schema", colorClass: "text-secondary" },
  yaml: { icon: "file-code", category: "YAML Config", colorClass: "text-secondary" },
  yml: { icon: "file-code", category: "YAML Config", colorClass: "text-secondary" },
  xml: { icon: "file-code", category: "XML Document", colorClass: "text-secondary" },
  js: { icon: "file-code", category: "JavaScript", colorClass: "text-secondary" },
  mjs: { icon: "file-code", category: "JavaScript", colorClass: "text-secondary" },
  ts: { icon: "file-code", category: "TypeScript", colorClass: "text-secondary" },
  html: { icon: "file-code", category: "HTML Document", colorClass: "text-secondary" },
  css: { icon: "file-code", category: "CSS Stylesheet", colorClass: "text-secondary" },
  py: { icon: "file-code", category: "Python Script", colorClass: "text-secondary" },
  sql: { icon: "file-code", category: "SQL Query", colorClass: "text-secondary" },
  sh: { icon: "file-code", category: "Shell Script", colorClass: "text-secondary" }
};

// Default icon when file type is not in the set of known file types
const DEFAULT_FILE_TYPE = {
  icon: "file",
  category: "File",
  colorClass: "text-base-content/60"
};

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getFileInfo(fileName) {
  if (!fileName || !fileName.includes(".")) {
    return DEFAULT_FILE_TYPE;
  }
  const ext = (fileName.split(".").pop() || "").toLowerCase().trim();
  return KNOWN_FILE_TYPES[ext] || DEFAULT_FILE_TYPE;
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return null;
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function addCollectedFile(fileName, options = {}) {
  if (!fileName || !fileName.trim()) return null;
  const cleanName = fileName.trim();
  const incomingPath = options.path ? String(options.path).trim() : null;
  const existing = collectedFiles.find((f) => {
    if (incomingPath && f.path) return f.path === incomingPath;
    return !f.path && !incomingPath && f.name.toLowerCase() === cleanName.toLowerCase();
  });
  if (existing) {
    if (incomingPath) existing.path = incomingPath;
    if (options.uploadStatus) existing.uploadStatus = options.uploadStatus;
    existing.isNoteOpen = true;
    renderCollectedFiles();
    updatePromptAndPreview();
    setTimeout(() => {
      const input = document.getElementById(`note-input-${existing.id}`);
      if (input) input.focus();
    }, 50);
    return existing;
  }

  const info = getFileInfo(cleanName);
  const id = "ref-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7);

  const entry = {
    id,
    name: cleanName,
    path: incomingPath,
    uploadStatus: options.uploadStatus || (incomingPath ? "workspace" : "local"),
    sizeFormatted: options.sizeFormatted || null,
    icon: options.icon || info.icon,
    category: options.category || info.category,
    colorClass: options.colorClass || info.colorClass,
    note: options.note || "",
    isNoteOpen: false
  };
  collectedFiles.push(entry);

  renderCollectedFiles();
  updatePromptAndPreview();
  return entry;
}

async function stageBrowserFile(browserFile, collectedId) {
  if (!browserFile || window.location.protocol === "file:") return;
  const entry = collectedFiles.find((f) => f.id === collectedId);
  if (!entry) return;

  entry.uploadStatus = "uploading";
  renderCollectedFiles();

  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = String(reader.result || "");
        const idx = res.indexOf(",");
        resolve(idx >= 0 ? res.slice(idx + 1) : res);
      };
      reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
      reader.readAsDataURL(browserFile);
    });

    const targetSlug = typeof getActiveOrTypedSlug === "function" ? getActiveOrTypedSlug() : "";
    const uploadPayload = {
      name: browserFile.name,
      contentBase64: base64,
      sizeBytes: browserFile.size
    };
    if (targetSlug) {
      uploadPayload.projectSlug = targetSlug;
    }

    const resp = await fetch("/api/create/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(uploadPayload)
    });
    const data = await resp.json();
    const current = collectedFiles.find((f) => f.id === collectedId);
    if (!current) return;
    if (resp.ok && data && data.ok && data.path) {
      current.path = data.path;
      current.uploadStatus = data.scope === "workspace" ? "workspace" : "staged";
      workspaceFilesCache = null;
    } else {
      current.uploadStatus = "local";
    }
  } catch {
    const current = collectedFiles.find((f) => f.id === collectedId);
    if (current) current.uploadStatus = "local";
  }
  renderCollectedFiles();
  updatePromptAndPreview();
}

let workspaceFilesCache = null;
let workspaceFilesCacheProject = null;

async function syncProjectWorkspaceFiles(slug, { silent = false } = {}) {
  const cleanSlug = typeof slugifyClient === "function" ? slugifyClient(slug || "") : String(slug || "").trim();
  if (!cleanSlug || window.location.protocol === "file:") return [];
  try {
    const resp = await fetch(`/api/create/workspace-files?project=${encodeURIComponent(cleanSlug)}`, { cache: "no-store" });
    const data = await resp.json();
    if (!resp.ok || !data || !data.ok || !Array.isArray(data.projectFiles)) return [];

    let changed = false;
    const prevSyncFlag = isSyncingWorkspaceState;
    if (silent) isSyncingWorkspaceState = true;
    try {
      data.projectFiles.forEach((pf) => {
        if (!pf || !pf.path) return;
        const existing = collectedFiles.find((f) =>
          f.path === pf.path ||
          (f.name.toLowerCase() === String(pf.name || "").toLowerCase() && (!f.path || f.path.startsWith("projects/_uploads/")))
        );
        if (existing) {
          if (existing.path !== pf.path || existing.uploadStatus !== "workspace") {
            existing.path = pf.path;
            existing.uploadStatus = "workspace";
            changed = true;
          }
        } else {
          const info = getFileInfo(pf.name);
          collectedFiles.push({
            id: "ref-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
            name: pf.name,
            path: pf.path,
            uploadStatus: "workspace",
            sizeFormatted: formatFileSize(pf.sizeBytes),
            icon: info.icon,
            category: info.category,
            colorClass: info.colorClass,
            note: "",
            isNoteOpen: false
          });
          changed = true;
        }
      });

      if (changed) {
        renderCollectedFiles();
        updatePromptAndPreview();
      }
    } finally {
      isSyncingWorkspaceState = prevSyncFlag;
    }
    return data.projectFiles;
  } catch {
    return [];
  }
}

function toggleWorkspaceFilePicker(forceState) {
  const panel = document.getElementById("workspace-files-picker");
  if (!panel) return;
  const shouldOpen = typeof forceState === "boolean" ? forceState : panel.classList.contains("hidden");
  panel.classList.toggle("hidden", !shouldOpen);
  if (shouldOpen) {
    const searchInput = document.getElementById("workspace-files-search");
    loadWorkspaceFiles(searchInput ? searchInput.value : "");
    if (searchInput) setTimeout(() => searchInput.focus(), 50);
  }
}

async function loadWorkspaceFiles(query = "") {
  const listEl = document.getElementById("workspace-files-list");
  if (!listEl) return;

  if (window.location.protocol === "file:") {
    listEl.innerHTML = `<div class="py-3 px-2 text-center text-3xs text-base-content/60">Workspace browsing requires the local server (<code class="font-mono">node skills/html-report/scripts/open-create.mjs</code>).</div>`;
    return;
  }

  const targetSlug = typeof getActiveOrTypedSlug === "function" ? getActiveOrTypedSlug() : "";
  try {
    if (!workspaceFilesCache || query || workspaceFilesCacheProject !== targetSlug) {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (targetSlug) params.set("project", targetSlug);
      const qs = params.toString();
      const url = `/api/create/workspace-files${qs ? `?${qs}` : ""}`;
      const resp = await fetch(url, { cache: "no-store" });
      const data = await resp.json();
      if (!resp.ok || !data || !data.ok) throw new Error(data?.error || "Failed to list workspace files");
      if (!query) {
        workspaceFilesCache = data.files || [];
        workspaceFilesCacheProject = targetSlug;
      }
      renderWorkspaceFilesList(data.files || []);
    } else {
      renderWorkspaceFilesList(workspaceFilesCache);
    }
  } catch {
    listEl.innerHTML = `<div class="py-3 px-2 text-center text-3xs text-base-content/60">Local server unavailable. Start via <code class="font-mono">open-create.mjs</code> to browse workspace files.</div>`;
  }
}

function renderWorkspaceFilesList(files) {
  const listEl = document.getElementById("workspace-files-list");
  if (!listEl) return;
  if (!files || files.length === 0) {
    listEl.innerHTML = `<div class="py-3 text-center text-3xs text-base-content/50">No matching workspace files found.</div>`;
    return;
  }
  listEl.innerHTML = files.slice(0, 80).map((f) => {
    const info = getFileInfo(f.name);
    const size = formatFileSize(f.sizeBytes);
    const safePath = escapeHtml(f.path).replace(/'/g, "&#39;");
    const safeName = escapeHtml(f.name).replace(/'/g, "&#39;");
    return `
      <button type="button" class="workspace-file-option w-full flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-base-200/70 rounded text-left transition" data-file-path="${escapeHtml(f.path)}" onclick="selectWorkspaceFile('${safePath}', '${safeName}', ${Number(f.sizeBytes) || 0})">
        <div class="flex items-center gap-2 min-w-0">
          <i data-lucide="${info.icon}" class="w-3.5 h-3.5 shrink-0 ${info.colorClass}"></i>
          <span class="font-mono text-3xs text-base-content truncate">${escapeHtml(f.path)}</span>
          ${f.inProjectWorkspace ? `<span class="badge badge-success badge-outline badge-2xs text-3xs font-mono shrink-0">In Project</span>` : ""}
        </div>
        ${size ? `<span class="badge badge-ghost badge-2xs text-3xs font-mono text-base-content/50 shrink-0">${size}</span>` : ""}
      </button>
    `;
  }).join("");
  if (window.lucide) window.lucide.createIcons();
}

function selectWorkspaceFile(filePath, fileName, sizeBytes) {
  addCollectedFile(fileName, {
    path: filePath,
    uploadStatus: "workspace",
    sizeFormatted: formatFileSize(sizeBytes),
    sizeBytes
  });
  toggleWorkspaceFilePicker(false);
}

function handleFilePickerSelect(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const entry = addCollectedFile(file.name, {
      sizeFormatted: formatFileSize(file.size),
      sizeBytes: file.size
    });
    if (entry) stageBrowserFile(file, entry.id);
  }
  event.target.value = "";
}

function removeCollectedFile(id) {
  collectedFiles = collectedFiles.filter((f) => f.id !== id);
  renderCollectedFiles();
  updatePromptAndPreview();
}

function toggleFileNote(id) {
  const file = collectedFiles.find((f) => f.id === id);
  if (!file) return;
  file.isNoteOpen = !file.isNoteOpen;
  renderCollectedFiles();
  if (file.isNoteOpen) {
    setTimeout(() => {
      const input = document.getElementById(`note-input-${file.id}`);
      if (input) input.focus();
    }, 50);
  }
}

function updateFileNote(id, noteVal) {
  const file = collectedFiles.find((f) => f.id === id);
  if (!file) return;
  file.note = noteVal;
  updatePromptAndPreview();
}

function renderCollectedFiles() {
  const container = document.getElementById("collected-files-list");
  const countBadge = document.getElementById("collected-files-count");
  if (!container) return;

  if (countBadge) {
    if (collectedFiles.length > 0) {
      countBadge.textContent = `${collectedFiles.length} file${collectedFiles.length === 1 ? "" : "s"}`;
      countBadge.classList.remove("hidden");
      countBadge.classList.add("badge-primary");
      countBadge.classList.remove("badge-ghost");
    } else {
      countBadge.classList.add("hidden");
    }
  }

  if (collectedFiles.length === 0) {
    container.classList.add("hidden");
    container.innerHTML = "";
    return;
  }

  container.classList.remove("hidden");
  container.innerHTML = collectedFiles.map((file) => {
    const hasNote = Boolean(file.note && file.note.trim());
    return `
      <div class="p-2.5 rounded-lg bg-base-100 border border-base-300 shadow-2xs space-y-2 collected-file-item" data-file-id="${file.id}">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-6 h-6 rounded bg-base-200/80 flex items-center justify-center shrink-0 ${file.colorClass}">
              <i data-lucide="${file.icon}" class="w-3.5 h-3.5"></i>
            </div>
            <div class="min-w-0 flex flex-col gap-0.5">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-bold text-xs text-base-content font-mono truncate max-w-[220px]" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                ${file.sizeFormatted ? `<span class="badge badge-ghost badge-2xs text-3xs font-mono text-base-content/60">${file.sizeFormatted}</span>` : `<span class="badge badge-ghost badge-2xs text-3xs font-mono text-base-content/60">${file.category}</span>`}
                ${file.uploadStatus === "uploading" ? `<span class="badge badge-info badge-outline badge-2xs text-3xs font-mono">staging...</span>` : ""}
                ${file.path && file.path.includes("/refs/") ? `<span class="badge badge-success badge-outline badge-2xs text-3xs font-mono">workspace</span>` : (file.path && file.path.startsWith("projects/_uploads/") ? `<span class="badge badge-warning badge-outline badge-2xs text-3xs font-mono">pre-workspace staging</span>` : "")}
              </div>
              ${file.path ? `<span class="text-3xs font-mono text-success truncate max-w-[260px] collected-file-path" title="${escapeHtml(file.path)}">${escapeHtml(file.path)}</span>` : ""}
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button type="button" class="btn btn-2xs ${hasNote ? "btn-primary btn-outline" : "btn-ghost border border-base-300"} gap-1 text-3xs btn-note-toggle font-normal" onclick="toggleFileNote('${file.id}')" title="${hasNote ? 'Edit context note' : 'Add context note'}">
              <i data-lucide="${hasNote ? 'edit-2' : 'plus'}" class="w-3 h-3"></i>
              <span>Note</span>
            </button>
            <button type="button" class="btn btn-ghost btn-2xs text-base-content/50 hover:text-error hover:bg-error/10 btn-remove-file p-1" onclick="removeCollectedFile('${file.id}')" title="Remove file">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        ${hasNote && !file.isNoteOpen ? `
          <div class="flex items-center gap-1.5 text-3xs text-base-content/80 bg-base-200/40 px-2 py-1 rounded border border-base-300/50">
            <i data-lucide="message-square" class="w-3 h-3 text-primary shrink-0"></i>
            <span class="truncate italic flex-1 file-note-preview" title="${escapeHtml(file.note)}">Note: "${escapeHtml(file.note)}"</span>
            <button type="button" class="text-3xs text-primary font-medium hover:underline shrink-0" onclick="toggleFileNote('${file.id}')">Edit</button>
          </div>
        ` : ""}

        ${file.isNoteOpen ? `
          <div class="pt-1.5 border-t border-base-200">
            <div class="flex items-center gap-1.5">
              <input type="text" id="note-input-${file.id}" class="input input-bordered input-xs flex-1 text-xs placeholder:text-base-content/40 focus:outline-primary h-7 min-h-0 note-input" placeholder="Add context note (how should the AI use this file?)" value="${escapeHtml(file.note || '')}" oninput="updateFileNote('${file.id}', this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();toggleFileNote('${file.id}');}" />
              <button type="button" class="btn btn-xs btn-primary text-3xs h-7 min-h-0 px-2.5 shrink-0" onclick="toggleFileNote('${file.id}')">Done</button>
            </div>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");

  if (window.lucide) window.lucide.createIcons();
}

function initFileDropZone() {
  const dropZone = document.getElementById("file-drop-zone");
  if (!dropZone) return;

  ["dragenter", "dragover"].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add("border-primary", "bg-primary/5");
    });
  });

  ["dragleave", "drop"].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("border-primary", "bg-primary/5");
    });
  });

  dropZone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    if (!dt || !dt.files || dt.files.length === 0) return;
    for (let i = 0; i < dt.files.length; i++) {
      const file = dt.files[i];
      const entry = addCollectedFile(file.name, {
        sizeFormatted: formatFileSize(file.size),
        sizeBytes: file.size
      });
      if (entry) stageBrowserFile(file, entry.id);
    }
  });
}
