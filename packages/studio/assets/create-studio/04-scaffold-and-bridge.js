function setWorkspaceLifecycleState(state, { slug = "", detail = "" } = {}) {
  const box = document.getElementById("workspace-lifecycle-status");
  const badge = document.getElementById("workspace-state-badge");
  const slugEl = document.getElementById("workspace-state-slug");
  const detailEl = document.getElementById("workspace-state-detail");

  const step6Box = document.getElementById("step-output-workspace-summary");
  const step6Badge = document.getElementById("step-output-workspace-badge");
  const step6SlugEl = document.getElementById("step-output-workspace-slug");
  const step6DetailEl = document.getElementById("step-output-workspace-detail");

  if (box) box.className = "p-2.5 rounded-lg border text-xs flex items-start justify-between gap-3";
  if (badge) badge.className = "badge badge-xs font-mono font-bold";
  if (step6Box) step6Box.className = "p-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2.5";
  if (step6Badge) step6Badge.className = "badge badge-xs font-mono font-bold";

  let boxClasses = ["border-base-300", "bg-base-100/70"];
  let step6BoxClasses = ["border-base-300", "bg-base-200/50"];
  let badgeClasses = ["badge-ghost"];
  let badgeText = "Draft — Not Created Yet";
  let showSlug = false;
  let resolvedDetailHtml = detail || (agentBridgePreflightOk
    ? "Name your project folder and click <strong>Create Workspace</strong> above so attached files stage straight into <code class=\"font-mono\">projects/&lt;slug&gt;/refs/</code>, or copy/send the prompt."
    : "Name your project folder and click <strong>Create Workspace</strong> above so attached files stage straight into <code class=\"font-mono\">projects/&lt;slug&gt;/refs/</code>, or copy/save the AI prompt.");
  let resolvedStep6Html = detail || "Create your workspace in <a href=\"#workspace-setup-section\" class=\"link link-primary font-semibold\">Step 1: Project Workspace</a>, or copy/save the AI prompt below.";

  if (state === "created") {
    boxClasses = ["border-success/40", "bg-success/10"];
    step6BoxClasses = ["border-success/40", "bg-success/10"];
    badgeClasses = ["badge-success", "text-success-content"];
    badgeText = "Workspace Created";
    showSlug = Boolean(slug);
    resolvedDetailHtml = detail || (agentBridgePreflightOk
      ? `Starter files are saved in <code class="font-mono">projects/${escapeHtml(slug)}/</code>. Attached files stage straight into <code class="font-mono">refs/</code>, and you can click <strong>Send to Agent</strong> or <strong>Copy AI Prompt</strong> below.`
      : `Starter files are saved in <code class="font-mono">projects/${escapeHtml(slug)}/</code>. Attached files stage straight into <code class="font-mono">refs/</code>. Open the live preview or click <strong>Copy AI Prompt</strong> below.`);
    resolvedStep6Html = `Synced with <code class="font-mono">projects/${escapeHtml(slug)}/</code>. All Steps 1–5 choices are up to date.`;
  } else if (state === "dirty") {
    boxClasses = ["border-warning/40", "bg-warning/10"];
    step6BoxClasses = ["border-warning/40", "bg-warning/10"];
    badgeClasses = ["badge-warning", "text-warning-content"];
    badgeText = "Unsaved Changes";
    showSlug = Boolean(slug);
    resolvedDetailHtml = detail || `Configuration changed since last sync. Click <strong>Update Workspace</strong> to sync <code class="font-mono">projects/${escapeHtml(slug)}/</code> in-place without creating a duplicate folder.`;
    resolvedStep6Html = `Configuration changed since last sync for <code class="font-mono">projects/${escapeHtml(slug)}/</code>. Click <strong>Update Workspace</strong> to sync in-place.`;
  } else if (state === "dispatched") {
    boxClasses = ["border-accent/40", "bg-accent/10"];
    step6BoxClasses = ["border-accent/40", "bg-accent/10"];
    badgeClasses = ["badge-accent", "text-accent-content"];
    badgeText = "Sent to Agent";
    showSlug = Boolean(slug);
    resolvedDetailHtml = detail || `Workspace <code class="font-mono">projects/${escapeHtml(slug)}/</code> is live and your instructions were sent to the AI Agent Bridge.`;
    resolvedStep6Html = resolvedDetailHtml;
  } else if (state === "error") {
    boxClasses = ["border-error/40", "bg-error/10"];
    step6BoxClasses = ["border-error/40", "bg-error/10"];
    badgeClasses = ["badge-error", "text-error-content"];
    badgeText = "Workspace Not Created";
    resolvedDetailHtml = escapeHtml(detail || "Could not create the workspace folder yet. Your draft choices are still safe.");
    resolvedStep6Html = resolvedDetailHtml;
  } else if (state === "offline") {
    boxClasses = ["border-warning/40", "bg-warning/10"];
    step6BoxClasses = ["border-warning/40", "bg-warning/10"];
    badgeClasses = ["badge-warning", "text-warning-content"];
    badgeText = "Local Server Needed for Auto-Create";
    resolvedDetailHtml = detail || "Automatic workspace creation isn't available right now (offline or outdated server). You can still use <strong>Copy AI Prompt</strong> or <strong>Download Starter HTML</strong> below.";
    resolvedStep6Html = resolvedDetailHtml;
  }

  if (box) box.classList.add(...boxClasses);
  if (badge) {
    badge.classList.add(...badgeClasses);
    badge.textContent = badgeText;
  }
  if (slugEl) {
    slugEl.textContent = slug ? `projects/${slug}/` : "";
    slugEl.classList.toggle("hidden", !showSlug);
  }
  if (detailEl) detailEl.innerHTML = resolvedDetailHtml;

  if (step6Box) step6Box.classList.add(...step6BoxClasses);
  if (step6Badge) {
    step6Badge.classList.add(...badgeClasses);
    step6Badge.textContent = badgeText;
  }
  if (step6SlugEl) {
    step6SlugEl.textContent = slug ? `projects/${slug}/` : "";
    step6SlugEl.classList.toggle("hidden", !showSlug);
  }
  if (step6DetailEl) step6DetailEl.innerHTML = resolvedStep6Html;

  updateWorkspaceActionButtons();
}

function showScaffoldError(message, title = "Workspace not created") {
  const errBanner = document.getElementById("scaffold-error-banner");
  const errTitle = document.getElementById("scaffold-error-title");
  const errMsg = document.getElementById("scaffold-error-message");
  if (errTitle) errTitle.textContent = title;
  if (errMsg) errMsg.textContent = message;
  if (errBanner) errBanner.classList.remove("hidden");
}

function clearScaffoldError() {
  const errBanner = document.getElementById("scaffold-error-banner");
  if (errBanner) errBanner.classList.add("hidden");
}

async function ensureAgentCsrfToken(forceRefresh = false) {
  if (!forceRefresh && agentBridgeCsrfToken) return agentBridgeCsrfToken;
  if (window.location.protocol === "file:") return null;
  try {
    const res = await fetch("/api/agent/csrf-token", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.ok && data.csrfToken) {
      agentBridgeCsrfToken = data.csrfToken;
      return agentBridgeCsrfToken;
    }
  } catch (_) {}
  return null;
}

async function scaffoldProjectNow(btn, { updateExisting = false } = {}) {
  const payload = collectStudioPayload();
  const typedSlug = slugifyClient(payload.projectSlug || "");
  const isUpdate = Boolean(
    updateExisting ||
    (activeWorkspaceSlug && (!typedSlug || typedSlug === activeWorkspaceSlug))
  );
  if (isUpdate && activeWorkspaceSlug) {
    payload.projectSlug = activeWorkspaceSlug;
    payload.updateExisting = true;
  }
  const originalHtml = btn ? btn.innerHTML : "";
  clearScaffoldError();
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = isUpdate
      ? '<span class="loading loading-spinner loading-xs"></span> Updating Workspace...'
      : '<span class="loading loading-spinner loading-xs"></span> Creating Workspace...';
  }
  try {
    if (window.location.protocol === "file:") {
      throw new Error("You opened this page directly as a file. Automatic workspace creation requires the local app (port 3031/3032). Use 'Copy AI Prompt' or 'Download Starter HTML' instead.");
    }
    const csrfToken = await ensureAgentCsrfToken();
    const headers = { "Content-Type": "application/json" };
    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
    const res = await fetch("/api/create/scaffold", {
      method: "POST",
      headers,
      body: JSON.stringify(csrfToken ? { ...payload, csrfToken } : payload)
    });
    const { data, rawText } = await parseJsonResponseSafe(res);
    if (res.status === 404) {
      throw new Error("The running local server doesn't support Create Workspace yet (404). Please refresh in a moment or restart the local server, or use 'Copy AI Prompt' / 'Download Starter HTML'.");
    }
    if (!res.ok || !data || !data.ok) {
      const detail = (data && data.error) || (rawText ? rawText.slice(0, 160).trim() : `HTTP ${res.status}`);
      throw new Error(detail);
    }
    lastScaffoldedProject = data;
    activeWorkspaceSlug = data.slug;
    workspaceDirty = false;
    isSyncingWorkspaceState = true;
    try {
      const slugInput = document.getElementById("input-project-slug");
      if (slugInput && !slugInput.value.trim()) {
        slugInput.value = data.slug;
      }
      // Update collectedFiles paths if pre-workspace uploads were staged into projects/<slug>/refs/
      if (Array.isArray(data.stagedRefs) && data.stagedRefs.length > 0) {
        data.stagedRefs.forEach((ref) => {
          if (!ref || !ref.stagedPath) return;
          const match = collectedFiles.find((f) =>
            (ref.originalPath && f.path === ref.originalPath) ||
            (!f.path && f.name === ref.name) ||
            (f.name === ref.name && f.path && f.path.startsWith("projects/_uploads/"))
          );
          if (match) {
            match.path = ref.stagedPath;
            match.uploadStatus = "workspace";
          }
        });
        renderCollectedFiles();
      }
      if (typeof syncProjectWorkspaceFiles === "function") {
        await syncProjectWorkspaceFiles(data.slug, { silent: true });
      }
      updatePromptAndPreview();
    } finally {
      isSyncingWorkspaceState = false;
    }
    lastSyncedWorkspaceSnapshot = getWorkspaceConfigSnapshot();

    const banner = document.getElementById("scaffold-result-banner");
    const titleEl = document.getElementById("scaffold-result-title");
    const pathEl = document.getElementById("scaffold-result-path");
    const linkEl = document.getElementById("scaffold-result-open-link");
    if (banner && titleEl && pathEl && linkEl) {
      const refsCount = Array.isArray(data.stagedRefs) ? data.stagedRefs.filter((r) => r.stagedPath).length : 0;
      titleEl.textContent = isUpdate ? `Workspace updated: "${data.slug}"` : `Workspace created: "${data.slug}"`;
      pathEl.textContent = `${data.projectDir}/fragment.html${refsCount ? ` · ${refsCount} ref(s) staged in refs/` : ""}`;
      linkEl.href = data.entryUrl;
      banner.classList.remove("hidden");
    }
    setWorkspaceLifecycleState("created", { slug: data.slug });
    if (typeof window.loadWorkspaceProjects === "function") {
      window.loadWorkspaceProjects({ refresh: true });
    }
    if (window.lucide) window.lucide.createIcons();
    return data;
  } catch (err) {
    const msg = err && err.name === "TypeError"
      ? "Could not reach the local server (port 3031/3032). Use 'Copy AI Prompt' or 'Download Starter HTML' below, or start the local server."
      : (err && err.message ? err.message : "Unknown error");
    setWorkspaceLifecycleState("error", { detail: "No workspace folder was created on disk. Your configuration above is preserved." });
    showScaffoldError(msg);
    const statusEl = document.getElementById("agent-bridge-dispatch-status");
    if (statusEl) {
      statusEl.textContent = `Workspace creation error: ${msg}`;
      statusEl.className = "text-3xs font-mono px-1 text-error";
      statusEl.classList.remove("hidden");
    }
    return null;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

function setSendToAgentVisibility(btn, visible) {
  if (!btn) return;
  btn.classList.toggle("hidden", !visible);
  btn.hidden = !visible;
  btn.disabled = !visible;
}

async function checkAgentBridgePreflight() {
  const btn = document.getElementById("btn-send-to-agent");
  const statusEl = document.getElementById("agent-bridge-dispatch-status");
  if (!btn) return;
  if (window.location.protocol === "file:") {
    agentBridgePreflightOk = false;
    agentBridgeCsrfToken = null;
    setSendToAgentVisibility(btn, false);
    return;
  }
  try {
    const res = await fetch("/api/agent/preflight", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const hasVerifiedProvider = Boolean(
      data &&
      data.providerAvailable === true &&
      (data.authenticated === true || data.inferenceVerified === true)
    );
    const hasSecureBridgeFlag = Boolean(
      data &&
      data.ok &&
      data.bridgeReachable !== false &&
      data.secureBridge === true &&
      hasVerifiedProvider
    );

    let token = hasSecureBridgeFlag ? (data.csrfToken || null) : null;
    if (hasSecureBridgeFlag && !token) {
      token = await ensureAgentCsrfToken();
    }
    const secureBridgeReady = Boolean(hasSecureBridgeFlag && token);
    agentBridgeCsrfToken = secureBridgeReady ? token : null;
    agentBridgePreflightOk = secureBridgeReady;
    setSendToAgentVisibility(btn, secureBridgeReady);

    if (secureBridgeReady) {
      btn.title = "Send synthesized prompt & project metadata to verified local Agent Bridge (/api/agent/prompt)";
      if (statusEl && statusEl.classList.contains("hidden")) {
        statusEl.textContent = `Secure two-way bridge active${data.activeProviderName ? ` (${data.activeProviderName})` : ""}`;
        statusEl.className = "text-3xs font-mono px-1 text-success";
        statusEl.classList.remove("hidden");
      }
    } else {
      btn.title = "Hidden unless a secure, authenticated two-way agent bridge is active";
    }
  } catch (_) {
    agentBridgePreflightOk = false;
    agentBridgeCsrfToken = null;
    setSendToAgentVisibility(btn, false);
    btn.title = "Hidden unless a secure, authenticated two-way agent bridge is active";
  }
}

async function sendPromptToAgentBridge(btn) {
  const box = document.getElementById("prompt-output-box");
  const statusEl = document.getElementById("agent-bridge-dispatch-status");
  const prompt = box ? box.value.trim() : "";
  if (!prompt || !agentBridgePreflightOk) return;

  const originalHtml = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="loading loading-spinner loading-xs"></span> Sending...';
  }

  try {
    const csrfToken = await ensureAgentCsrfToken();
    if (!csrfToken) {
      throw new Error("Secure bridge CSRF verification failed.");
    }
    if (!lastScaffoldedProject) {
      await scaffoldProjectNow(null);
    }
    const studioPayload = collectStudioPayload();
    const projectMeta = lastScaffoldedProject
      ? {
          slug: lastScaffoldedProject.slug,
          entryUrl: lastScaffoldedProject.entryUrl,
          fragmentPath: lastScaffoldedProject.fragmentPath,
          manifestPath: lastScaffoldedProject.manifestPath,
          target: studioPayload.target,
          operationalMode: studioPayload.operationalMode,
          theme: studioPayload.theme,
          widgets: studioPayload.widgets,
          referenceFiles: studioPayload.referenceFiles
        }
      : {
          slug: studioPayload.projectSlug,
          target: studioPayload.target,
          operationalMode: studioPayload.operationalMode,
          theme: studioPayload.theme,
          widgets: studioPayload.widgets,
          referenceFiles: studioPayload.referenceFiles
        };

    const res = await fetch("/api/agent/prompt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken
      },
      body: JSON.stringify({
        csrfToken,
        prompt,
        project: projectMeta,
        context: {
          source: "create.html",
          projectSlug: projectMeta.slug,
          activeTheme: studioPayload.theme,
          target: studioPayload.target,
          widgets: studioPayload.widgets
        }
      })
    });
    const { data } = await parseJsonResponseSafe(res);
    if (statusEl) {
      if (res.ok && (!data || data.ok !== false)) {
        statusEl.textContent = `Dispatched to Agent Bridge${projectMeta.slug ? ` (project: ${projectMeta.slug})` : ""}`;
        statusEl.className = "text-3xs font-mono px-1 text-success";
        setWorkspaceLifecycleState("dispatched", { slug: projectMeta.slug || "" });
      } else {
        statusEl.textContent = `Bridge dispatch notice (${res.status}): ${(data && (data.error || data.message)) || "Unavailable"}`;
        statusEl.className = "text-3xs font-mono px-1 text-warning";
      }
      statusEl.classList.remove("hidden");
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = `Bridge dispatch failed: ${err.message}`;
      statusEl.className = "text-3xs font-mono px-1 text-error";
      statusEl.classList.remove("hidden");
    }
  } finally {
    if (btn) {
      setSendToAgentVisibility(btn, agentBridgePreflightOk);
      btn.innerHTML = originalHtml;
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

async function syncConfigFromServer() {
  if (window.location.protocol === "file:") {
    if (!lastScaffoldedProject) setWorkspaceLifecycleState("offline");
    return;
  }
  try {
    const res = await fetch("/api/create/config", { cache: "no-store" });
    if (!res.ok) {
      if (!lastScaffoldedProject) setWorkspaceLifecycleState("offline");
      return;
    }
    const { data } = await parseJsonResponseSafe(res);
    if (!data) {
      if (!lastScaffoldedProject) setWorkspaceLifecycleState("offline");
      return;
    }
    if (Array.isArray(data.capabilities) && data.capabilities.includes("scaffold")) {
      clearScaffoldError();
      if (!lastScaffoldedProject) setWorkspaceLifecycleState("draft");
    } else if (!lastScaffoldedProject) {
      setWorkspaceLifecycleState("offline", {
        detail: "The running local server is an older version without Create Workspace support. Refresh after updating or use Copy AI Prompt / Download Starter HTML below."
      });
    }
    if (Array.isArray(data.themes) && data.themes.length > 0) {
      const customName = userCustomTheme ? userCustomTheme.name : null;
      DAISYUI_THEMES.length = 0;
      if (customName) DAISYUI_THEMES.push(customName);
      for (const t of data.themes) {
        if (!DAISYUI_THEMES.includes(t)) DAISYUI_THEMES.push(t);
      }
      initNavbarThemeDropdown();
      initInitialThemeDropdown();
    }
  } catch (_) {
    if (!lastScaffoldedProject) setWorkspaceLifecycleState("offline");
  }
}

window.addEventListener("html-report:server-reconnected", () => {
  syncConfigFromServer();
  checkAgentBridgePreflight();
  if (typeof window.loadWorkspaceProjects === "function") {
    window.loadWorkspaceProjects({ refresh: true });
  }
});

function resetStudioToDefault(btn) {
  // 1. Reset Step 1: Purpose & Deliverable, Behavioral, Goals, Audience, Reference Files
  const reportCard = document.querySelector('[data-target="report"]');
  if (reportCard) selectWizardTarget("report", reportCard);

  const staticCard = document.querySelector('[data-mode="static"]');
  if (staticCard) selectWizardMode("static", staticCard);

  const interactiveBtn = document.querySelector('[data-behavioral="interactive"]');
  if (interactiveBtn) selectWizardBehavioral("interactive", interactiveBtn);

  const noneAppCard = document.getElementById("app-card-none");
  if (noneAppCard) selectWizardApp("none", noneAppCard);

  const slugInput = document.getElementById("input-project-slug");
  if (slugInput) slugInput.value = "";
  lastScaffoldedProject = null;
  activeWorkspaceSlug = null;
  workspaceDirty = false;
  lastSyncedWorkspaceSnapshot = null;
  workspaceFilesCache = null;
  const scaffoldBanner = document.getElementById("scaffold-result-banner");
  if (scaffoldBanner) scaffoldBanner.classList.add("hidden");
  clearScaffoldError();
  setWorkspaceLifecycleState("draft");

  const goalsInput = document.getElementById("input-board-goals");
  if (goalsInput) {
    goalsInput.value = "";
    goalsInput.classList.remove("hidden");
  }
  const audienceInput = document.getElementById("input-board-audience");
  if (audienceInput) audienceInput.value = "";

  if (typeof boardGoalMode !== "undefined") boardGoalMode = "simple";
  const btnSimple = document.getElementById("btn-mode-simple");
  const btnComplex = document.getElementById("btn-mode-complex");
  if (btnSimple) { btnSimple.classList.add("btn-primary"); btnSimple.classList.remove("btn-ghost"); }
  if (btnComplex) { btnComplex.classList.remove("btn-primary"); btnComplex.classList.add("btn-ghost"); }
  const richIndicator = document.getElementById("rich-goals-indicator");
  if (richIndicator) richIndicator.classList.add("hidden");
  if (typeof quillInstance !== "undefined" && quillInstance) {
    quillInstance.setText("");
  }
  try {
    localStorage.removeItem("html-report-create-goals-mode");
    localStorage.removeItem("html-report-create-goals-simple");
    localStorage.removeItem("html-report-create-goals-complex");
  } catch (_) {}

  collectedFiles = [];
  const filePicker = document.getElementById("file-picker-input");
  if (filePicker) filePicker.value = "";
  renderCollectedFiles();

  // 2. Reset Step 3: Content Capabilities checkboxes
  [
    "chk-charts", "chk-mermaid", "chk-gridjs", "chk-leaflet",
    "chk-katex", "chk-fullcalendar", "chk-showdown", "chk-hljs",
    "chk-dayjs", "chk-quill", "chk-ai-agent", "chk-mcp-tools"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
  document.querySelectorAll(".widget-preset-chk").forEach((el) => { el.checked = false; });
  const resetPort = document.getElementById("ai-bridge-port");
  if (resetPort) resetPort.value = "3031";
  const resetPurpose = document.getElementById("ai-bridge-purpose");
  if (resetPurpose) resetPurpose.value = "";
  const resetFloatingAssistant = document.getElementById("ai-floating-assistant");
  if (resetFloatingAssistant) resetFloatingAssistant.checked = true;
  const resetReplyPrompt = document.getElementById("ai-turnkey-reply-prompt");
  if (resetReplyPrompt) resetReplyPrompt.value = "";
  const resetAiPanel = document.getElementById("ai-turnkey-config");
  if (resetAiPanel) resetAiPanel.classList.add("hidden");

  // 3. Reset Step 5: Custom Theme & Default Theme
  if (userCustomTheme) {
    const customIdx = DAISYUI_THEMES.indexOf(userCustomTheme.name);
    if (customIdx !== -1) DAISYUI_THEMES.splice(customIdx, 1);
    userCustomTheme = null;
  }
  const customStyleEl = document.getElementById("daisyui-custom-themes");
  if (customStyleEl) customStyleEl.textContent = "";

  const customNameInput = document.getElementById("custom-theme-name-input");
  if (customNameInput) customNameInput.value = "user";
  const customDefaults = [
    ["picker-primary", "text-primary", "#4f46e5"],
    ["picker-secondary", "text-secondary", "#ec4899"],
    ["picker-accent", "text-accent", "#f59e0b"],
    ["picker-neutral", "text-neutral", "#1e293b"],
    ["picker-base", "text-base", "#ffffff"]
  ];
  customDefaults.forEach(([pickerId, textId, val]) => {
    const p = document.getElementById(pickerId);
    const t = document.getElementById(textId);
    if (p) p.value = val;
    if (t) t.value = val;
  });
  const customBadge = document.getElementById("custom-theme-badge");
  if (customBadge) customBadge.textContent = "Custom Theme";
  const customAccordion = document.getElementById("custom-theme-accordion");
  if (customAccordion) customAccordion.removeAttribute("open");

  initNavbarThemeDropdown();
  initInitialThemeDropdown();
  changeDefaultTheme("light");
  if (typeof syncThemeColorMeta === "function") {
    setTimeout(syncThemeColorMeta, 50);
  }

  // 4. Refresh prompt & mockup
  updatePromptAndPreview();

  // 5. Button feedback
  if (btn) {
    if (!btn.dataset.origHtml) btn.dataset.origHtml = btn.innerHTML;
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg><span class="text-success">Reset to Default!</span>';
    clearTimeout(btn._resetTimer);
    btn._resetTimer = setTimeout(() => {
      btn.innerHTML = btn.dataset.origHtml;
    }, 1500);
  }
}
