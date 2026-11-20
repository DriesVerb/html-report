// ==========================================
// WORKSPACE PROJECTS DIRECTORY & DUAL VIEW MODE
// ==========================================
let workspaceProjects = [];
let currentCategoryFilter = "all";
let projectsSearchQuery = "";

const BUNDLED_SHOWCASE_PROJECTS = [];

function getCategoryBadgeClass(category) {
  switch (category) {
    case "Workspace Project": return "badge-success text-success-content";
    case "OpenSpec Journey": return "badge-primary text-primary-content";
    case "Analytical Report": return "badge-secondary text-secondary-content";
    case "Creation Studio": return "badge-accent text-accent-content";
    case "Performance Benchmark": return "badge-warning text-warning-content";
    case "Dev Prototype": return "badge-info text-info-content";
    case "Research Report": return "badge-neutral text-neutral-content";
    case "Showcase Example": return "badge-outline badge-primary";
    case "Experiment": return "badge-accent badge-outline";
    default: return "badge-ghost";
  }
}

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

const NAVBAR_DROPDOWNS = [
  { dropdownId: "toc-dropdown", menuId: "report-toc-list", btnId: "toc-dropdown-btn" },
  { dropdownId: "navbar-projects-dropdown", menuId: "navbar-projects-menu", btnId: "navbar-projects-btn" },
  { dropdownId: "studio-settings-dropdown", menuId: "studio-settings-panel", btnId: "studio-settings-gear-btn" },
  { dropdownId: "initial-theme-dropdown", menuId: "initial-theme-menu", btnId: "initial-theme-btn" }
];

window.closeAllNavbarDropdowns = function (exceptDropdownId = null) {
  NAVBAR_DROPDOWNS.forEach(({ dropdownId, menuId, btnId }) => {
    if (dropdownId === exceptDropdownId) return;
    const dd = document.getElementById(dropdownId);
    const menu = document.getElementById(menuId);
    const btn = document.getElementById(btnId);
    if (dd) {
      dd.classList.remove("dropdown-open");
      dd.removeAttribute("open");
      if (document.activeElement && dd.contains(document.activeElement) && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }
    }
    if (menu) menu.classList.add("hidden");
    if (btn) btn.setAttribute("aria-expanded", "false");
  });
};

window.toggleNavbarDropdown = function (dropdownId, menuId, btnId, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const dd = document.getElementById(dropdownId);
  const menu = document.getElementById(menuId);
  const btn = document.getElementById(btnId);
  if (!dd || !menu) return;

  const isCurrentlyOpen = dd.classList.contains("dropdown-open");
  window.closeAllNavbarDropdowns(isCurrentlyOpen ? null : dropdownId);

  if (isCurrentlyOpen) {
    dd.classList.remove("dropdown-open");
    dd.removeAttribute("open");
    menu.classList.add("hidden");
    if (btn) btn.setAttribute("aria-expanded", "false");
    if (document.activeElement && dd.contains(document.activeElement) && typeof document.activeElement.blur === "function") {
      document.activeElement.blur();
    }
  } else {
    dd.classList.add("dropdown-open");
    menu.classList.remove("hidden");
    if (btn) btn.setAttribute("aria-expanded", "true");
    if (dropdownId === "navbar-projects-dropdown") {
      window.renderDropdownProjectsList(document.getElementById("dropdown-projects-search")?.value || "");
    }
  }
};

const handleOutsideStudioDropdown = (event) => {
  const clickedInsideAny = NAVBAR_DROPDOWNS.some(({ dropdownId }) => {
    const dd = document.getElementById(dropdownId);
    return dd && dd.contains(event.target);
  });
  if (!clickedInsideAny) {
    window.closeAllNavbarDropdowns();
  }
};

document.addEventListener("mousedown", handleOutsideStudioDropdown);
document.addEventListener("click", handleOutsideStudioDropdown);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    window.closeAllNavbarDropdowns();
  }
});

window.closeProjectsDropdown = function () {
  window.closeAllNavbarDropdowns();
};

window.renderDropdownProjectsList = function (searchQuery = "") {
  const container = document.getElementById("dropdown-projects-list");
  if (!container) return;

  let list = workspaceProjects;
  if (searchQuery) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter((p) =>
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.path && p.path.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="py-6 text-center text-xs text-base-content/60">
        No projects match search
      </div>
    `;
    return;
  }

  container.innerHTML = "";
  list.slice(0, 10).forEach((p) => {
    const item = document.createElement("a");
    item.href = p.url;
    item.target = "_blank";
    item.rel = "noopener noreferrer";
    item.className = "flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-base-200 transition text-left group pt-2 first:pt-1";

    const left = document.createElement("div");
    left.className = "min-w-0 flex-1";

    const title = document.createElement("div");
    title.className = "text-xs font-semibold text-base-content truncate group-hover:text-primary transition-colors";
    title.textContent = p.title || p.path;
    title.title = p.title || p.path;

    const sub = document.createElement("div");
    sub.className = "flex items-center gap-1.5 text-3xs text-base-content/60 font-mono truncate mt-0.5";
    const subBadge = document.createElement("span");
    subBadge.className = `badge badge-3xs ${getCategoryBadgeClass(p.category)} font-mono`;
    subBadge.textContent = p.category || "HTML Report";
    const subPath = document.createElement("span");
    subPath.className = "truncate";
    subPath.textContent = p.path || "";
    sub.appendChild(subBadge);
    sub.appendChild(subPath);

    left.appendChild(title);
    left.appendChild(sub);

    const icon = document.createElement("div");
    icon.className = "shrink-0 text-base-content/40 group-hover:text-primary transition-colors";
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>`;

    item.appendChild(left);
    item.appendChild(icon);
    container.appendChild(item);
  });
};

window.filterDropdownProjectsList = function (query) {
  window.renderDropdownProjectsList(query);
};

window.switchView = function (viewName, updateHash = true) {
  const wizardView = document.getElementById("view-wizard");
  const projectsView = document.getElementById("view-projects");
  const navProjectsBtn = document.getElementById("navbar-projects-btn");
  const tocDropdown = document.getElementById("toc-dropdown");
  const quickViewLabel = document.getElementById("studio-quick-view-label");
  const bottomBar = document.getElementById("sticky-bottom-prompt-bar");

  if (viewName === "projects") {
    if (wizardView) wizardView.classList.add("hidden");
    if (projectsView) projectsView.classList.remove("hidden");
    if (bottomBar) bottomBar.classList.add("hidden");
    if (navProjectsBtn) {
      navProjectsBtn.classList.remove("btn-ghost");
      navProjectsBtn.classList.add("btn-primary");
    }
    if (tocDropdown) tocDropdown.classList.add("hidden");
    if (quickViewLabel) quickViewLabel.textContent = "Return to Creation Studio";
    if (updateHash && window.location.hash !== "#projects") {
      history.pushState(null, "", "#projects");
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    loadWorkspaceProjects();
  } else {
    const wasProjectsVisible = projectsView && !projectsView.classList.contains("hidden");
    if (wizardView) wizardView.classList.remove("hidden");
    if (projectsView) projectsView.classList.add("hidden");
    if (bottomBar) bottomBar.classList.remove("hidden");
    if (navProjectsBtn) {
      navProjectsBtn.classList.add("btn-ghost");
      navProjectsBtn.classList.remove("btn-primary");
    }
    if (tocDropdown) tocDropdown.classList.remove("hidden");
    if (quickViewLabel) quickViewLabel.textContent = "Browse Projects Directory";
    if (updateHash && window.location.hash === "#projects") {
      history.pushState(null, "", window.location.pathname + window.location.search);
    }
    if (wasProjectsVisible && (!window.location.hash || window.location.hash === "#projects")) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }
  if (window.lucide) {
    try { window.lucide.createIcons(); } catch (_) {}
  }
};

window.toggleProjectsView = function () {
  const projectsView = document.getElementById("view-projects");
  const isProjectsVisible = projectsView && !projectsView.classList.contains("hidden");
  window.switchView(isProjectsVisible ? "wizard" : "projects");
};

window.loadWorkspaceProjects = async function (options = {}) {
  const offlineBanner = document.getElementById("projects-offline-banner");
  const url = options && options.refresh ? "/api/projects?refresh=1" : "/api/projects";
  try {
    if (window.location.protocol === "file:") {
      throw new Error("Offline file mode");
    }
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data.ok && Array.isArray(data.projects)) {
      workspaceProjects = data.projects;
      if (offlineBanner) offlineBanner.classList.add("hidden");
    } else {
      throw new Error("Invalid response");
    }
  } catch (_) {
    // Zero-node / offline fallback
    let saved = [];
    try {
      const raw = localStorage.getItem("studio_local_projects");
      if (raw) saved = JSON.parse(raw);
    } catch (_) {}
    workspaceProjects = [...saved, ...BUNDLED_SHOWCASE_PROJECTS];
    if (offlineBanner) offlineBanner.classList.remove("hidden");
  }

  // Update badge in navbar and dropdown
  const badge = document.getElementById("navbar-projects-badge");
  if (badge) {
    badge.textContent = workspaceProjects.length;
  }
  const dropdownBadge = document.getElementById("dropdown-projects-badge");
  if (dropdownBadge) {
    dropdownBadge.textContent = workspaceProjects.length;
  }

  renderDropdownProjectsList();
  renderCategoryFilters();
  renderProjectsGrid();
};

window.addEventListener("html-report:projects-changed", () => {
  window.loadWorkspaceProjects({ refresh: true });
});

window.renderCategoryFilters = function () {
  const container = document.getElementById("projects-category-filters");
  if (!container) return;

  const categories = new Set(["all"]);
  workspaceProjects.forEach((p) => {
    if (p.category) categories.add(p.category);
  });
  if (currentCategoryFilter !== "all" && !categories.has(currentCategoryFilter)) {
    currentCategoryFilter = "all";
  }

  container.innerHTML = "";
  categories.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    const isActive = cat === currentCategoryFilter;
    btn.className = `btn btn-xs ${isActive ? "btn-primary" : "btn-ghost border border-base-300"} capitalize font-mono text-3xs`;
    const count = cat === "all" ? workspaceProjects.length : workspaceProjects.filter((p) => p.category === cat).length;
    btn.textContent = `${cat === "all" ? "All" : cat} (${count})`;
    btn.onclick = () => window.setProjectCategoryFilter(cat);
    container.appendChild(btn);
  });
};

window.setProjectCategoryFilter = function (category) {
  currentCategoryFilter = category;
  window.renderCategoryFilters();
  window.renderProjectsGrid();
};

window.filterProjectsList = function () {
  const input = document.getElementById("projects-search-input");
  const clearBtn = document.getElementById("projects-search-clear");
  projectsSearchQuery = (input ? input.value : "").trim().toLowerCase();
  if (clearBtn) {
    if (projectsSearchQuery) clearBtn.classList.remove("hidden");
    else clearBtn.classList.add("hidden");
  }
  window.renderProjectsGrid();
};

window.clearProjectsSearch = function () {
  const input = document.getElementById("projects-search-input");
  const clearBtn = document.getElementById("projects-search-clear");
  if (input) input.value = "";
  if (clearBtn) clearBtn.classList.add("hidden");
  projectsSearchQuery = "";
  window.renderProjectsGrid();
};

let projectPendingDeletion = null;

window.deleteProject = function (project) {
  if (!project || !project.path) return;
  projectPendingDeletion = project;

  const modal = document.getElementById("modal-delete-project");
  const titleEl = document.getElementById("delete-modal-project-title");
  const pathEl = document.getElementById("delete-modal-project-path");
  const confirmBtn = document.getElementById("btn-confirm-delete-project");

  if (titleEl) titleEl.textContent = project.title || project.path;
  if (pathEl) pathEl.textContent = project.path;

  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      <span>Confirm Delete</span>
    `;
    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = `<span class="loading loading-spinner loading-xs"></span> <span>Deleting...</span>`;
      await window.executeDeleteProject(projectPendingDeletion);
    };
  }

  if (modal && typeof modal.showModal === "function") {
    modal.showModal();
  } else {
    // Fallback for non-supporting viewports
    if (confirm(`Permanently delete project?\n\n${project.title || project.path}`)) {
      window.executeDeleteProject(project);
    }
  }
};

window.executeDeleteProject = async function (project) {
  const modal = document.getElementById("modal-delete-project");
  try {
    const res = await fetch("/api/projects", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: project.path })
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || "Failed to delete project");
    }

    if (modal && typeof modal.close === "function") modal.close();

    // Clean up from local in-memory array
    workspaceProjects = workspaceProjects.filter((p) => p.path !== project.path);
    try {
      const raw = localStorage.getItem("studio_local_projects");
      if (raw) {
        const saved = JSON.parse(raw).filter((p) => p.path !== project.path);
        localStorage.setItem("studio_local_projects", JSON.stringify(saved));
      }
    } catch (_) {}

    // Reload fresh list from server
    await window.loadWorkspaceProjects({ refresh: true });
  } catch (err) {
    if (modal && typeof modal.close === "function") modal.close();
    alert("Error deleting project: " + err.message);
  } finally {
    projectPendingDeletion = null;
  }
};

window.renderProjectsGrid = function () {
  const grid = document.getElementById("projects-grid");
  const emptyState = document.getElementById("projects-empty-state");
  const countSummary = document.getElementById("projects-count-summary");
  if (!grid) return;

  let filtered = workspaceProjects;
  if (currentCategoryFilter !== "all") {
    filtered = filtered.filter((p) => p.category === currentCategoryFilter);
  }
  if (projectsSearchQuery) {
    filtered = filtered.filter((p) =>
      (p.title && p.title.toLowerCase().includes(projectsSearchQuery)) ||
      (p.path && p.path.toLowerCase().includes(projectsSearchQuery)) ||
      (p.category && p.category.toLowerCase().includes(projectsSearchQuery)) ||
      (p.description && p.description.toLowerCase().includes(projectsSearchQuery))
    );
  }

  if (countSummary) {
    countSummary.textContent = `Showing ${filtered.length} of ${workspaceProjects.length} projects`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = "";
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");
  grid.innerHTML = "";

  filtered.forEach((p) => {
    const card = document.createElement("div");
    card.className = "card bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-shadow rounded-xl p-4 flex flex-col justify-between";

    const topRow = document.createElement("div");
    topRow.className = "flex items-center justify-between gap-2";

    const badge = document.createElement("span");
    badge.className = `badge badge-xs font-mono font-semibold ${getCategoryBadgeClass(p.category)}`;
    badge.textContent = p.category || "HTML Report";

    const ver = document.createElement("span");
    ver.className = "badge badge-outline font-mono text-3xs font-semibold";
    ver.textContent = `v${p.version || "0.0.0-beta.1"}`;

    topRow.appendChild(badge);
    topRow.appendChild(ver);

    const body = document.createElement("div");
    body.className = "space-y-1.5 my-3";

    const h3 = document.createElement("h3");
    h3.className = "font-bold text-sm text-base-content line-clamp-2";
    h3.title = p.title || p.path;
    h3.textContent = p.title || p.path;

    const pathEl = document.createElement("p");
    pathEl.className = "font-mono text-3xs text-base-content/60 truncate flex items-center gap-1";
    pathEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>`;
    const pathSpan = document.createElement("span");
    pathSpan.textContent = p.path || "";
    pathEl.appendChild(pathSpan);

    body.appendChild(h3);
    body.appendChild(pathEl);

    if (p.description) {
      const desc = document.createElement("p");
      desc.className = "text-xs text-base-content/70 line-clamp-2";
      desc.textContent = p.description;
      body.appendChild(desc);
    }

    const footer = document.createElement("div");
    footer.className = "flex items-center justify-between pt-2 border-t border-base-200 mt-auto";

    const sizeEl = document.createElement("span");
    sizeEl.className = "text-3xs text-base-content/50 font-mono";
    sizeEl.textContent = formatBytes(p.size);

    const actions = document.createElement("div");
    actions.className = "flex items-center gap-1.5";

    const openBtn = document.createElement("a");
    openBtn.href = p.url;
    openBtn.target = "_blank";
    openBtn.rel = "noopener noreferrer";
    openBtn.className = "btn btn-xs btn-primary gap-1";
    openBtn.innerHTML = `<span>Open</span> <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>`;

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-xs btn-outline btn-error gap-1 hover:text-white";
    deleteBtn.title = "Delete this project and its folder";
    deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> <span>Delete</span>`;
    deleteBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.deleteProject(p);
    };

    actions.appendChild(openBtn);
    actions.appendChild(deleteBtn);

    footer.appendChild(sizeEl);
    footer.appendChild(actions);

    card.appendChild(topRow);
    card.appendChild(body);
    card.appendChild(footer);
    grid.appendChild(card);
  });
};
