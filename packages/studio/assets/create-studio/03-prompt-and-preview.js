function updatePromptAndPreview() {
  const hasCharts = document.getElementById("chk-charts")?.checked ?? false;
  const hasMermaid = document.getElementById("chk-mermaid")?.checked ?? false;
  const hasGridjs = document.getElementById("chk-gridjs")?.checked ?? false;
  const hasLeaflet = document.getElementById("chk-leaflet")?.checked ?? false;
  const hasKatex = document.getElementById("chk-katex")?.checked ?? false;
  const hasCalendar = document.getElementById("chk-fullcalendar")?.checked ?? false;
  const hasShowdown = document.getElementById("chk-showdown")?.checked ?? false;
  const hasHljs = document.getElementById("chk-hljs")?.checked ?? false;
  const hasDayjs = document.getElementById("chk-dayjs")?.checked ?? false;
  const hasQuill = document.getElementById("chk-quill")?.checked ?? false;
  const hasAiAgent = document.getElementById("chk-ai-agent")?.checked ?? false;
  const hasMcpTools = document.getElementById("chk-mcp-tools")?.checked ?? false;
  const aiConfigPanel = document.getElementById("ai-turnkey-config");
  if (aiConfigPanel) aiConfigPanel.classList.toggle("hidden", !hasAiAgent);
  const aiPortRaw = document.getElementById("ai-bridge-port")?.value?.trim();
  const aiPort = aiPortRaw && Number(aiPortRaw) > 0 ? String(Number(aiPortRaw)) : "3031";
  const aiPurpose = document.getElementById("ai-bridge-purpose")?.value?.trim() || "";
  const aiFloatingAssistant = document.getElementById("ai-floating-assistant")?.checked ?? true;

  let userGoals = "";
  if (boardGoalMode === "complex" && quillEditor) {
    const root = quillEditor.root;
    const paragraphs = Array.from(root.children);
    const lines = paragraphs.map((p) => {
      const tag = p.tagName.toLowerCase();
      const text = p.innerText.trim();
      if (!text) return "";
      if (tag === "h1") return "# " + text;
      if (tag === "h2") return "## " + text;
      if (tag === "h3") return "### " + text;
      if (tag === "ul" || p.classList.contains("ql-bullet") || p.getAttribute("data-list") === "bullet") return "• " + text;
      if (tag === "ol" || p.classList.contains("ql-ordered") || p.getAttribute("data-list") === "ordered") return "- " + text;
      return text;
    }).filter(Boolean);
    userGoals = lines.join("\n") || quillEditor.getText().trim();
  } else {
    userGoals = document.getElementById("input-board-goals")?.value.trim() || "";
    try {
      localStorage.setItem("html-report-create-goals-simple", document.getElementById("input-board-goals")?.value || "");
    } catch (_) {}
  }

  const userAudience = document.getElementById("input-board-audience")?.value.trim() || "";

  let skillName = "html-report";
  let humanTargetName = "Analytical Report";
  let heroTitle = "Quarterly Strategic Performance Report";

  if (currentTarget === "print") {
    skillName = "html-print";
    humanTargetName = "Printable Document / Compliance PDF";
    heroTitle = "Formal Executive Audit & Compliance Document";
  } else if (currentTarget === "dashboard") {
    skillName = "html-dashboard";
    humanTargetName = "Real-Time Telemetry Dashboard";
    heroTitle = "Live Telemetry & System Monitoring Cockpit";
  } else if (currentTarget === "presentation") {
    skillName = "html-presentation";
    humanTargetName = "Interactive Slide Deck (Reveal.js)";
    heroTitle = "Strategic Roadmap & Product Keynote Deck";
  }

  if (userGoals) {
    const cleanGoal = userGoals.replace(/\s+/g, " ").trim();
    const firstClause = cleanGoal.split(/[\n.!?;]+/)[0].trim();
    if (firstClause && firstClause.length <= 80) {
      heroTitle = firstClause;
    } else if (cleanGoal.length <= 80) {
      heroTitle = cleanGoal;
    } else {
      const slice = cleanGoal.slice(0, 80);
      const lastSpace = slice.lastIndexOf(" ");
      heroTitle = (lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim();
    }
  }

  // Content Addons list
  const addonNames = [];
  if (hasCharts) addonNames.push("Interactive Charts (Chart.js)");
  if (hasMermaid) addonNames.push("Process Flows (Mermaid)");
  if (hasGridjs) addonNames.push("Data Tables (Grid.js)");
  if (hasLeaflet) addonNames.push("Geographic Maps (Leaflet)");
  if (hasKatex) addonNames.push("Scientific Math (KaTeX)");
  if (hasCalendar) addonNames.push("Calendars (FullCalendar)");
  if (hasShowdown) addonNames.push("Markdown Reader (Showdown)");
  if (hasHljs) addonNames.push("Code Highlighting (Highlight.js)");
  if (hasDayjs) addonNames.push("Date Calculation (Day.js)");
  if (hasQuill) addonNames.push("WYSIWYG Rich Text Editor (Quill v2.0)");

  // UPDATE SIMULATED WIREFRAME MOCKUP
  const winTitle = document.getElementById("mockup-window-title");
  const hBadge = document.getElementById("mockup-hero-badge");
  const hTitle = document.getElementById("mockup-hero-title");
  const liveIndicator = document.getElementById("mockup-live-indicator");
  const installBtn = document.getElementById("mockup-install-btn");

  if (winTitle) winTitle.textContent = humanTargetName;
  if (hBadge) hBadge.textContent = `@${skillName}`;
  if (hTitle) hTitle.textContent = heroTitle;
  
  const themeNameEl = document.getElementById("mockup-theme-name");
  const themeSwatchesEl = document.getElementById("mockup-theme-swatches");
  const isCustomThemeActive = userCustomTheme && currentTheme === userCustomTheme.name;

  if (themeNameEl) themeNameEl.textContent = currentTheme;
  if (themeSwatchesEl) {
    themeSwatchesEl.setAttribute("data-theme", currentTheme);
  }

  if (liveIndicator) liveIndicator.classList.toggle("hidden", currentMode === "static");
  if (installBtn) installBtn.classList.toggle("hidden", currentApp === "none");

  const wChart = document.getElementById("mockup-chart-widget");
  const wMermaid = document.getElementById("mockup-mermaid-widget");
  const wTable = document.getElementById("mockup-table-widget");
  const wEditor = document.getElementById("mockup-editor-widget");
  const wDock = document.getElementById("mockup-agent-dock");
  const wRefs = document.getElementById("mockup-references-widget");
  const wRefsBadge = document.getElementById("mockup-references-badge");
  const wRefsText = document.getElementById("mockup-references-text");

  if (wChart) wChart.classList.toggle("hidden", !hasCharts);
  if (wMermaid) wMermaid.classList.toggle("hidden", !hasMermaid);
  if (wTable) wTable.classList.toggle("hidden", !hasGridjs);
  if (wEditor) wEditor.classList.toggle("hidden", !hasQuill);
  if (wDock) wDock.classList.toggle("hidden", !hasAiAgent);
  if (wRefs) {
    wRefs.classList.toggle("hidden", collectedFiles.length === 0);
    if (wRefsBadge) wRefsBadge.textContent = collectedFiles.length;
    if (wRefsText) wRefsText.textContent = `${collectedFiles.length} Reference File${collectedFiles.length === 1 ? "" : "s"} Grounded`;
  }

  // SYNTHESIZE AI PROMPT (Front and Center for coding agents!)
  let promptText = `Invoked via /html-create (Creation Studio) -> Routing to Specialized Facade: @${skillName}\n`;
  promptText += `Skill Command: /${skillName}\n\n`;
  promptText += `Task: Build a ${humanTargetName}\n`;

  if (userGoals) {
    promptText += `\nObjective & Scope (What the board needs to show):\n${userGoals}\n`;
  }
  if (userAudience) {
    promptText += `\nTarget Audience:\n${userAudience}\n`;
  }

  if (collectedFiles.length > 0) {
    promptText += `\nReference Documents, Images & Data-Sets:\n`;
    collectedFiles.forEach((f) => {
      let line = `• ${f.name}`;
      if (f.category) line += ` (${f.category})`;
      if (f.note && f.note.trim()) {
        line += ` - Context Note: "${f.note.trim()}"`;
      }
      if (f.path) {
        line += ` [Path: ${f.path}]`;
      }
      promptText += `${line}\n`;
    });
  }

  promptText += `\nDeliverable Architecture:\n`;
  promptText += `- Purpose & Format: ${humanTargetName.toUpperCase()}\n`;
  promptText += `- Serving Mode: ${currentMode === "static" ? "Static File (Zero Backend, file:/// compatible, no Datastar server hooks)" : "Server-Connected (Live Backend on localhost:3031 with Datastar SSE)"}\n`;
  promptText += `- Behavioral Mode: ${currentBehavioral === "passive" ? "Passive / Printable Document (@page A4/Letter PDF)" : "Interactive / Reactive Application (Alpine.js, Chart.js, client-side fetch)"}\n`;
  promptText += `- Operational Mode: ${currentMode === "static" ? "STATIC_STANDALONE (Zero server required, single self-contained HTML file)" : "LIVE_CONNECTED (Server-backed SSE stream on localhost:3031)"}\n`;
  promptText += `- App Packaging: ${currentApp === "none" ? "Standard Browser Page" : currentApp === "live-app" ? "Downloadable App (Standalone Window, Live Connected)" : "Downloadable Offline-First App (100% Offline Service Worker Cache)"}\n`;
  promptText += `- Startup Theme: "${currentTheme}"${isCustomThemeActive ? ` (Custom DaisyUI Theme: "${userCustomTheme.name}")` : " (Default on first load; readers can switch between 32 themes via navbar)"}\n`;

  if (isCustomThemeActive) {
    promptText += `- Custom DaisyUI Theme Specification ("${userCustomTheme.name}"):\n`;
    promptText += `  • Primary: ${userCustomTheme.colors.primary}\n`;
    promptText += `  • Secondary: ${userCustomTheme.colors.secondary}\n`;
    promptText += `  • Accent: ${userCustomTheme.colors.accent}\n`;
    promptText += `  • Neutral: ${userCustomTheme.colors.neutral}\n`;
    promptText += `  • Base-100: ${userCustomTheme.colors["base-100"]}\n`;
  }

  promptText += `- Features & Capabilities:\n`;
  promptText += addonNames.length ? addonNames.map((a) => `  • ${a}`).join("\n") : "  • None (core layout only)";
  if (hasAiAgent) {
    promptText += `\n  • Two-Way Agent Bridge & AI Dock (Pre-baked --ai controls, Cmd+K prompt dock, and live Datastar fragment morphing)`;
    promptText += `\n  • Turnkey AI Connection: port=${aiPort}`;
    promptText += `\n  • Hovering AI Assistant Button (⌘K): ${aiFloatingAssistant ? "Activated (floating chat launcher visible)" : "Disabled (headless live bridge updates only)"}`;
    if (aiPurpose) promptText += `\n  • Board AI Support Description: "${aiPurpose}"`;
  }
  if (hasMcpTools) promptText += `\n  • Enterprise Tools Gateway (Proxy widgets to Postgres / GitLab MCP servers)`;

  const rawExplicitSlug = document.getElementById("input-project-slug")?.value.trim() || "";
  const sanitizedExplicitSlug = rawExplicitSlug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const projectSlug = sanitizedExplicitSlug || (userGoals || heroTitle || `${currentTarget}-project`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || `${currentTarget}-project`;

  const serveCmd = `node skills/html-report/scripts/serve-report.mjs projects/${projectSlug}/index.html --port ${aiPort} --no-open`;

  const purposeText = aiPurpose || `Provide live AI support on the board: answer user questions about the metrics, help explore data, and push live updates back to the HTML board.`;
  const turnkeyPart1El = document.getElementById("ai-turnkey-part1-prompt");
  if (turnkeyPart1El) {
    turnkeyPart1El.value = [
      `/goal Establish AI board support and prepare a Reply Prompt for create.html (pre-scaffold handshake).`,
      ``,
      `What the AI on this board should do:`,
      `${purposeText}`,
      ``,
      `How to maintain a connection to the board:`,
      `- Once the board is scaffolded, keep the Two-Way Agent Bridge running on port ${aiPort} via skills/html-report/scripts/serve-report.mjs --port ${aiPort} --no-open.`,
      `- Hovering AI Assistant (⌘K): ${aiFloatingAssistant ? "Activated (user can open the floating chat dock in the bottom-right corner)" : "Disabled (headless bridge only — push live updates without showing the floating chat button)"}.`,
      `- Stay connected to the board's SSE stream (http://localhost:${aiPort}/events) and handle two-way requests (POST /api/agent and POST /api/agent/prompt) to push live updates back to the HTML file.`,
      ``,
      `Reply Prompt to give back (paste into Step 2 in create.html to unlock):`,
      `The board is NOT scaffolded yet — do not guess unbuilt widget IDs or page schemas. Output a concise, copy-ready Reply Prompt block labeled "REPLY PROMPT FOR CREATE.HTML" containing what html-report needs from you to wire up and maintain the connection after scaffolding:`,
      `1. Connection & Keep-Alive Details: How you will connect to and stay synced with port ${aiPort} (e.g., local agy CLI model/persona, webhook/MCP endpoint, or SSE + POST /api/agent listener) and any required config.`,
      `2. Hovering AI Assistant (⌘K) Integration Schema: The request payload/context you expect from the dock/bridge (e.g., prompt, targetSelector, datasetState, domSnippet), the actions you support, and the response/live-update format you will return (chat text, Datastar HTML fragments, or structured action proposals).`,
      `3. Agent-Side Capabilities & Context: What tools, live data, or workspace context you already have access to on your side that the board can query once live.`
    ].join("\n");
  }

  const turnkeyReplyInput = document.getElementById("ai-turnkey-reply-prompt");
  const turnkeyReply = turnkeyReplyInput ? turnkeyReplyInput.value.trim() : "";
  const isHandshakeLocked = hasAiAgent && !turnkeyReply;

  const turnkeyPart2Status = document.getElementById("ai-turnkey-part2-status");
  const turnkeyLockIcon = document.getElementById("ai-turnkey-lock-icon");
  if (turnkeyPart2Status) {
    if (turnkeyReply) {
      turnkeyPart2Status.textContent = "🔓 Unlocked — Handshake Complete";
      turnkeyPart2Status.className = "badge badge-success badge-xs font-mono text-success-content gap-1";
    } else {
      turnkeyPart2Status.textContent = "🔒 Locked — Waiting for Agent Reply";
      turnkeyPart2Status.className = "badge badge-warning badge-xs font-mono gap-1";
    }
  }
  if (turnkeyLockIcon) {
    turnkeyLockIcon.setAttribute("data-lucide", turnkeyReply ? "unlock" : "lock");
    turnkeyLockIcon.className = turnkeyReply ? "w-3.5 h-3.5 text-success" : "w-3.5 h-3.5 text-warning";
  }

  const promptReadyBadge = document.getElementById("prompt-ready-badge");
  const btnCopyPrompt = document.getElementById("btn-copy-prompt");
  const btnSavePrompt = document.getElementById("btn-save-prompt");
  if (promptReadyBadge) {
    if (isHandshakeLocked) {
      promptReadyBadge.innerHTML = '<i data-lucide="lock" class="w-2.5 h-2.5"></i> Locked — Complete AI Handshake';
      promptReadyBadge.className = "badge badge-warning badge-sm text-3xs font-mono font-bold gap-1 whitespace-nowrap shrink-0";
    } else {
      promptReadyBadge.innerHTML = '<i data-lucide="check" class="w-2.5 h-2.5"></i> Live &amp; Ready';
      promptReadyBadge.className = "badge badge-success badge-sm text-3xs font-mono font-bold text-success-content gap-1 whitespace-nowrap shrink-0";
    }
  }
  if (btnCopyPrompt) {
    btnCopyPrompt.disabled = isHandshakeLocked;
    btnCopyPrompt.title = isHandshakeLocked ? "Paste the Agent Reply in Step 3 (The Lock) to unlock" : "";
  }
  if (btnSavePrompt) {
    btnSavePrompt.disabled = isHandshakeLocked;
    btnSavePrompt.title = isHandshakeLocked ? "Paste the Agent Reply in Step 3 (The Lock) to unlock" : "";
  }

  const scaffoldAddonKeys = [];
  if (hasCharts) scaffoldAddonKeys.push("charts");
  if (hasMermaid) scaffoldAddonKeys.push("mermaid");
  if (hasGridjs) scaffoldAddonKeys.push("gridjs");
  if (hasLeaflet) scaffoldAddonKeys.push("leaflet");
  if (hasKatex) scaffoldAddonKeys.push("katex");
  if (hasCalendar) scaffoldAddonKeys.push("fullcalendar");
  if (hasShowdown) scaffoldAddonKeys.push("showdown");
  if (hasHljs) scaffoldAddonKeys.push("hljs");
  if (hasDayjs) scaffoldAddonKeys.push("dayjs");
  if (hasQuill) scaffoldAddonKeys.push("quill");

  const selectedWidgets = getSelectedWidgets();
  const scaffoldMode = currentMode === "live" && currentTarget === "report" ? "live-report" : currentTarget;
  const scaffoldCmdParts = [
    "node skills/html-report/scripts/scaffold-project.mjs",
    `--project ${projectSlug}`,
    `--title "${heroTitle.replace(/"/g, '\\"')}"`,
    `--mode ${scaffoldMode}`,
    `--theme ${currentTheme}`
  ];
  if (scaffoldAddonKeys.length > 0) scaffoldCmdParts.push(`--addons ${scaffoldAddonKeys.join(",")}`);
  if (selectedWidgets.length > 0) scaffoldCmdParts.push(`--widgets ${selectedWidgets.join(",")}`);
  if (hasAiAgent) {
    scaffoldCmdParts.push("--ai");
    scaffoldCmdParts.push(`--ai-port ${aiPort}`);
    if (!aiFloatingAssistant) scaffoldCmdParts.push("--no-ai-dock");
    if (aiPurpose) scaffoldCmdParts.push(`--ai-purpose "${aiPurpose.replace(/"/g, '\\"')}"`);
  }
  if (currentApp !== "none") scaffoldCmdParts.push("--pwa");

  if (hasAiAgent && turnkeyReply) {
    promptText += `\n\nTurnkey Agent Reply (Scaffold Info & Two-Way Agent Bridge):\n`;
    promptText += `---\n${turnkeyReply}\n---`;
  }

  promptText += `\n\nAI Agent Scaffolding Instructions:\n`;
  promptText += `1. Activate skill /${skillName}.\n`;
  promptText += `2. Run the project scaffolding pipeline to create projects/${projectSlug}/ (fragment.html, index.html, report.manifest.json, AGENTS.md):\n`;
  promptText += `   ${scaffoldCmdParts.join(" ")}\n`;
  promptText += `3. Edit projects/${projectSlug}/fragment.html (<main id="report-main">) and rebuild to projects/${projectSlug}/index.html using build-report.mjs --project ${projectSlug}.\n`;
  if (userGoals) {
    promptText += `4. Structure data widgets and metrics directly fulfilling: "${userGoals}".\n`;
  } else {
    promptText += `4. Populate realistic, domain-specific metrics and data visualizations.\n`;
  }
  if (userAudience) {
    promptText += `5. Calibrate typography, layout contrast, and analytical depth for ${userAudience}.\n`;
  }
  if (collectedFiles.length > 0) {
    promptText += `${userAudience ? 6 : 5}. Ground visualizations, data schemas, and domain terminology directly on the provided reference files:\n`;
    collectedFiles.forEach((f) => {
      const fileRef = f.path ? `${f.name} (Path: ${f.path})` : f.name;
      if (f.note && f.note.trim()) {
        promptText += `   • ${fileRef}: Ground on context note ("${f.note.trim()}").\n`;
      } else {
        promptText += `   • ${fileRef}: Ground relevant visualizations/structure on this reference.\n`;
      }
    });
  }
  if (hasAiAgent) {
    const bridgeStepNum = (userAudience ? 6 : 5) + (collectedFiles.length > 0 ? 1 : 0);
    promptText += `${bridgeStepNum}. Start and verify the Two-Way Agent Bridge server on port ${aiPort}:\n`;
    promptText += `   ${serveCmd}\n`;
  }

  const promptBox = document.getElementById("prompt-output-box");
  if (promptBox) promptBox.value = promptText;

  if (studioInitialized && !isSyncingWorkspaceState && activeWorkspaceSlug && lastSyncedWorkspaceSnapshot !== null) {
    const nextSnap = getWorkspaceConfigSnapshot();
    const isNowDirty = nextSnap !== lastSyncedWorkspaceSnapshot;
    if (isNowDirty !== workspaceDirty) {
      workspaceDirty = isNowDirty;
      setWorkspaceLifecycleState(isNowDirty ? "dirty" : "created", { slug: activeWorkspaceSlug });
    } else {
      updateWorkspaceActionButtons();
    }
  }

  if (window.lucide) window.lucide.createIcons();
}

function copyTurnkeyPart1Prompt(btn) {
  const box = document.getElementById("ai-turnkey-part1-prompt");
  if (!box) return;
  navigator.clipboard.writeText(box.value).then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="check" class="w-3 h-3 text-success"></i> Copied Part 1!';
    setTimeout(() => {
      btn.innerHTML = original;
      if (window.lucide) window.lucide.createIcons();
    }, 2000);
  });
}

function clearTurnkeyReplyPrompt() {
  const box = document.getElementById("ai-turnkey-reply-prompt");
  if (!box) return;
  box.value = "";
  updatePromptAndPreview();
}

function copyPromptToClipboard(btn) {
  const box = document.getElementById("prompt-output-box");
  if (!box) return;
  navigator.clipboard.writeText(box.value).then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5 text-success"></i> Copied!';
    setTimeout(() => {
      btn.innerHTML = original;
      if (window.lucide) window.lucide.createIcons();
    }, 2000);
  });
}

function downloadPromptMarkdown() {
  const box = document.getElementById("prompt-output-box");
  if (!box) return;
  const blob = new Blob([box.value], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "report-creation-spec.md";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function collectStudioPayload() {
  const explicitSlug = document.getElementById("input-project-slug")?.value.trim() || "";
  const userGoals = document.getElementById("input-board-goals")?.value.trim() || "";
  const userAudience = document.getElementById("input-board-audience")?.value.trim() || "";
  const heroTitleEl = document.getElementById("mockup-hero-title");
  const heroTitle = heroTitleEl ? heroTitleEl.textContent.trim() : "";

  const addonMap = [
    ["chk-charts", "charts"],
    ["chk-mermaid", "mermaid"],
    ["chk-gridjs", "gridjs"],
    ["chk-leaflet", "leaflet"],
    ["chk-katex", "katex"],
    ["chk-fullcalendar", "fullcalendar"],
    ["chk-showdown", "showdown"],
    ["chk-hljs", "hljs"],
    ["chk-dayjs", "dayjs"],
    ["chk-quill", "quill"]
  ];
  const addons = addonMap.filter(([id]) => document.getElementById(id)?.checked).map(([, key]) => key);
  const widgets = getSelectedWidgets();
  const hasAiAgent = document.getElementById("chk-ai-agent")?.checked ?? false;
  const aiPortRaw = document.getElementById("ai-bridge-port")?.value?.trim();
  const aiPort = aiPortRaw && Number(aiPortRaw) > 0 ? Number(aiPortRaw) : 3031;
  const aiPurpose = document.getElementById("ai-bridge-purpose")?.value?.trim() || "";
  const aiDock = document.getElementById("ai-floating-assistant")?.checked ?? true;
  const isCustomThemeActive = userCustomTheme && currentTheme === userCustomTheme.name;

  return {
    projectSlug: explicitSlug,
    title: heroTitle,
    userGoals,
    userAudience,
    target: currentTarget,
    operationalMode: currentMode,
    servingMode: currentMode,
    behavioralMode: currentBehavioral,
    appPackaging: currentApp === "none" ? "browser" : currentApp,
    theme: currentTheme,
    customTheme: isCustomThemeActive ? userCustomTheme : null,
    addons,
    widgets,
    referenceFiles: collectedFiles.map((f) => ({
      name: f.name,
      path: f.path || "",
      note: f.note || "",
      category: f.category || ""
    })),
    ai: hasAiAgent,
    aiPort,
    aiPurpose,
    aiDock
  };
}

async function parseJsonResponseSafe(res) {
  const contentType = res.headers.get("content-type") || "";
  const rawText = await res.text();
  let data = null;
  if (rawText && (contentType.includes("application/json") || /^\s*[\[{]/.test(rawText))) {
    try {
      data = JSON.parse(rawText);
    } catch (_) {
      data = null;
    }
  }
  return { data, rawText };
}
