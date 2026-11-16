import fs from "node:fs";
import path from "node:path";
import { buildReport } from "@html-report/core/build";
import { compileTheme } from "@html-report/core/theme";
import { getPackageVersion } from "@html-report/core/compatibility";
import { CSRFManager } from "../mcp-server.mjs";
import { AgentInferenceRouter } from "../preflight.mjs";
import { DatastarBridge, escapeHtml } from "../datastar-sse.mjs";
import { getAuthoringPlugin } from "../authoring-plugin.mjs";
import {
  isPathInside,
  isLoopbackAddress,
  findWorkspaceRoot,
  resolveEditTarget,
  applyStyleToStandaloneHtml,
  extractFragmentContext,
  parseSurgicalPatchPayload,
  applySurgicalFragmentPatches,
  buildLocalBridgeReply
} from "../server-utils.mjs";

export function handleAgentBridgeRoutes(req, res, parsedUrl, pathname, ctx) {
  const {
    resolvedPath,
    rootDir,
    targetFileName,
    feedProxies,
    sseClients,
    datastarClients,
    mcpSseClients,
    personaRegistry,
    sessionStore,
    csrfManager,
    allowlistManager,
    workspaceRootForState,
    shouldPersistBoardStateToDisk,
    saveBoardState,
    isValidLocalOrigin,
    applyLocalCorsHeaders,
    enforceLocalBridgeSecurity,
    isSameOriginOrLocalRequest,
    broadcastDatastarFragment,
    broadcastLiveReloadEvent,
    broadcastProjectsChanged,
    broadcastReload,
    markProjectScaffolded,
    rebuildProjectFromFragment,
    resolveInferenceStatus,
    inspectServedReport,
    mcpContext,
    editable
  } = ctx;
  const serverPort = ctx.getServerPort();
  const requestedPort = ctx.getRequestedPort();
  const boardState = ctx.getBoardState();
  let activeReportTheme = ctx.getActiveReportTheme();
  const projectsCache = ctx.getProjectsCache();
  const setProjectsCache = ctx.setProjectsCache;

    if (pathname === "/api/agent/csrf-token" && req.method === "GET") {
      if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return true;
      const tokenData = csrfManager.generateToken();
      res.writeHead(200, applyLocalCorsHeaders(req, {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store"
      }));
      res.end(JSON.stringify({ ok: true, ...tokenData }));
      return true;
    }

    // 1a-3. Turnkey AI Preflight & Health Endpoint (GET /api/agent/preflight & /api/agent/health)
    if ((pathname === "/api/agent/preflight" || pathname === "/api/agent/health") && req.method === "GET") {
      const shouldVerify = parsedUrl.searchParams.get("verify") === "1" || parsedUrl.searchParams.get("probe") === "1";
      const isLocalCaller = isLoopbackAddress(req.socket?.remoteAddress || "")
        && (!req.headers.host || CSRFManager.validateHost(req.headers.host))
        && (req.headers.origin === undefined || isValidLocalOrigin(req.headers.origin));
      const respondPreflight = (providerStatus, verification = null) => {
        const inferenceVerified = verification ? Boolean(verification.inferenceVerified) : Boolean(providerStatus.inferenceVerified);
        const hasVerifiedProvider = Boolean(
          providerStatus.providerAvailable &&
          (providerStatus.authenticated || inferenceVerified)
        );
        const secureBridge = Boolean(isLocalCaller && hasVerifiedProvider);
        const csrfToken = secureBridge ? csrfManager.generateToken().csrfToken : null;
        res.writeHead(200, applyLocalCorsHeaders(req, {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store"
        }));
        res.end(JSON.stringify({
          ok: true,
          bridge: "online",
          uiConfigured: true,
          bridgeReachable: true,
          secureBridge,
          csrfRequired: true,
          csrfEndpoint: "/api/agent/csrf-token",
          ...(csrfToken ? { csrfToken } : {}),
          installed: providerStatus.installed,
          authenticated: providerStatus.authenticated,
          inferenceVerified,
          providerAvailable: providerStatus.providerAvailable,
          activeProvider: providerStatus.activeProvider,
          activeProviderName: providerStatus.activeProviderName,
          localMode: Boolean(providerStatus.localMode),
          availableProviders: providerStatus.availableProviders,
          authenticatedProviders: providerStatus.authenticatedProviders,
          checkedProviders: providerStatus.checkedProviders,
          ...(verification ? { verification } : {}),
          ai: {
            available: providerStatus.providerAvailable,
            installed: providerStatus.installed,
            authenticated: providerStatus.authenticated,
            inferenceVerified,
            providerAvailable: providerStatus.providerAvailable,
            activeProvider: providerStatus.activeProvider,
            activeProviderName: providerStatus.activeProviderName,
            localMode: Boolean(providerStatus.localMode),
            availableProviders: providerStatus.availableProviders,
            authenticatedProviders: providerStatus.authenticatedProviders,
            checkedProviders: providerStatus.checkedProviders
          },
          streamConnected: datastarClients.size > 0,
          streamListeners: datastarClients.size,
          mcpEndpoint: "/mcp",
          modelConfigured: true,
          defaultModel: "Gemini 3.8 Flash (Low)",
          requestedPort,
          port: serverPort,
          portMismatch: requestedPort > 0 && serverPort !== requestedPort,
          version: getPackageVersion()
        }));
      };

      const providerStatus = resolveInferenceStatus();
      if (shouldVerify) {
        const remoteAddr = req.socket?.remoteAddress || "";
        const origin = req.headers.origin || "";
        const isLocalOrigin = !origin || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);
        if (!isLoopbackAddress(remoteAddr) || !isLocalOrigin) {
          respondPreflight(providerStatus, {
            ok: false,
            inferenceVerified: false,
            verificationError: "Live inference probe is restricted to local requests."
          });
          return true;
        }
        if (providerStatus._useBuiltInLocalBridge) {
          respondPreflight(providerStatus, {
            ok: true,
            inferenceVerified: true,
            latencyMs: 0,
            sampleOutput: "Local Context Bridge Ready"
          });
          return true;
        }
        const now = Date.now();
        if (cachedVerifyResult && now < cachedVerifyExpiresAt) {
          respondPreflight(providerStatus, cachedVerifyResult);
          return true;
        }
        AgentInferenceRouter.verifyInference({
          timeoutMs: 12000,
          ...(providerStatus._siblingCmd ? { aiCmd: providerStatus._siblingCmd } : {})
        })
          .then((verification) => {
            cachedVerifyResult = verification;
            cachedVerifyExpiresAt = Date.now() + 30000;
            respondPreflight(providerStatus, verification);
          })
          .catch((err) => respondPreflight(providerStatus, { ok: false, inferenceVerified: false, error: err.message }));
        return true;
      }
      respondPreflight(providerStatus);
      return true;
    }

    // 1b-MCP. Model Context Protocol (MCP) Server & Client Bridge Endpoints

    if (pathname === "/api/agent/personas" || pathname === "/__agent_personas__") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store"
      });
      res.end(JSON.stringify({
        ok: true,
        count: personaRegistry.list().length,
        personas: personaRegistry.list()
      }));
      return true;
    }

    if (pathname === "/api/agent/persona" || pathname === "/__agent_persona__") {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        });
        res.end();
        return true;
      }
      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            const registered = personaRegistry.register(payload);
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            });
            res.end(JSON.stringify({
              ok: true,
              registered: registered.id,
              total: personaRegistry.list().length,
              persona: registered
            }));
          } catch (err) {
            res.writeHead(400, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            });
            res.end(JSON.stringify({ ok: false, error: err.message }));
          }
        });
        return true;
      }
      return true;
    }

    // 1b-3. Bidirectional Agent Loop: Interactive Prompt & Multi-Turn Datastar Streaming
    if (pathname === "/api/agent/prompt") {
      if (req.method === "OPTIONS") {
        if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return true;
        res.writeHead(204, applyLocalCorsHeaders(req, {
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Report-Agent, X-CSRF-Token, datastar-request"
        }));
        res.end();
        return true;
      }

      if (req.method === "POST") {
        if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return true;
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          let payload = {};
          try { payload = JSON.parse(body); } catch (_) {}
          if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: true, csrfToken: payload.csrfToken })) return;

          const sessionId = payload.sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const prompt = payload.prompt || "Analyze current telemetry";
          const targetSelector = payload.targetSelector || "";
          const context = payload.context || {};
          const personaKey = payload.persona || "analyst";
          const persona = personaRegistry.get(personaKey);
          const model = payload.model || persona.defaultModel || "Gemini 3.8 Flash (Low)";

          const session = sessionStore.getOrCreate(sessionId);
          // Build historySnippet from prior turns BEFORE appending the current user prompt (avoids duplication)
          const historySnippet = session.history.slice(-6).map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join("\n");
          sessionStore.addMessage(sessionId, "user", prompt, { context, targetSelector });

          const isStreaming = (req.headers.accept || "").includes("text/event-stream") ||
                              req.headers["datastar-request"] === "true" ||
                              payload.format === "datastar" ||
                              payload.stream === true;

          let contextSnippet = "";
          if (context.elementId || context.domSnippet || context.datasetState) {
            contextSnippet = `\nActive Element Context:\n- Element ID: ${context.elementId || "none"}\n- Theme: ${context.activeTheme || "light"}`;
            if (context.datasetState) {
              contextSnippet += `\n- Telemetry State: ${JSON.stringify(context.datasetState, null, 2)}`;
            }
            if (context.domSnippet) {
              contextSnippet += `\n- DOM Snippet: ${context.domSnippet}`;
            }
          }

          const systemPrompt = `${persona.systemPrompt}\nYou are interacting with a live HTML publication report.\n${historySnippet ? `\nConversation History:\n${historySnippet}\n` : ""}${contextSnippet}\nCRITICAL INSTRUCTION: If user asks to adjust, recalculate, filter, or re-run an analysis, propose a concrete structured action. Always return a concise, high-signal response.`;

          const promptLower = prompt.toLowerCase();
          const isMutatingPrompt = promptLower.includes("recalculate") ||
                                   promptLower.includes("exclude") ||
                                   promptLower.includes("filter") ||
                                   promptLower.includes("adjust") ||
                                   promptLower.includes("dip");

          const handleDispatch = (responseText, action) => {
            sessionStore.addMessage(sessionId, "assistant", responseText, { action });

            if (isStreaming) {
              res.writeHead(200, applyLocalCorsHeaders(req, {
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive"
              }));

              // 1. If targetSelector provided, push Datastar morph fragment into the page element
              if (targetSelector) {
                const cleanId = targetSelector.replace(/^#/, "");
                const targetFragment = `
                  <div id="${cleanId}" class="p-4 rounded-xl border border-primary/50 bg-base-100 shadow-md space-y-2 transition-all">
                    <div class="flex items-center justify-between text-xs pb-1 border-b border-base-200">
                      <span class="badge badge-primary badge-xs font-mono font-bold uppercase">LIVE AGENT MORPH</span>
                      <span class="text-base-content/60 font-mono text-[10px]">${new Date().toLocaleTimeString()}</span>
                    </div>
                    <div class="text-xs text-base-content leading-relaxed">${escapeHtml(responseText)}</div>
                  </div>
                `.trim().replace(/\n/g, " ");

                res.write(`event: datastar-merge-fragments\ndata: fragments ${targetFragment}\n\n`);

                // Also broadcast to other connected datastar tabs
                for (const client of datastarClients) {
                  try {
                    client.write(`event: datastar-merge-fragments\ndata: fragments ${targetFragment}\n\n`);
                  } catch (_) {
                    datastarClients.delete(client);
                  }
                }
              }

              // 2. Push JSON response frame containing text & optional action for the dock UI
              const jsonPayload = JSON.stringify({
                ok: true,
                sessionId,
                text: responseText,
                action,
                persona: persona.id,
                targetSelector,
                timestamp: new Date().toISOString()
              });
              res.write(`event: message\ndata: ${jsonPayload}\n\n`);
              res.end();
              return;
            }

            // Non-streaming JSON response
            res.writeHead(200, applyLocalCorsHeaders(req, {
              "Content-Type": "application/json"
            }));
            res.end(JSON.stringify({
              ok: true,
              sessionId,
              result: responseText,
              action,
              targetSelector,
              persona: persona.id,
              provider: activeProvider,
              history: session.history,
              timestamp: new Date().toISOString()
            }));
          };

          let activeProvider = "heuristic";
          if (payload.heuristic === true) {
            const responseText = isMutatingPrompt
              ? `[Demo Fixture] Simulated adjustment preview for ${targetSelector || "target element"} under persona '${persona.name}'. (Demo-only fixture; no live telemetry recalculated).`
              : `[Demo Fixture] Simulated response for ${context.elementId || "document"} under persona '${persona.name}'. (Demo-only fixture; live AI provider not invoked).`;
            let action = null;
            if (isMutatingPrompt) {
              action = {
                id: `act_${Date.now().toString(36)}`,
                type: "recalculate_metric",
                description: `[Demo Fixture] Preview action for ${targetSelector || "selected element"}`,
                preview: JSON.stringify({ fixture: true, target: targetSelector || "document", status: "demo_only" }, null, 2)
              };
              sessionStore.storePendingAction(sessionId, action);
            }
            handleDispatch(responseText, action);
            return;
          }

          const inferenceStatus = resolveInferenceStatus({ provider: payload.provider || null });
          if (inferenceStatus._useBuiltInLocalBridge && !payload.provider) {
            activeProvider = "local-bridge";
            const responseText = buildLocalBridgeReply({
              prompt,
              persona,
              context,
              targetSelector,
              resolvedPath,
              rootDir
            });
            let action = null;
            if (isMutatingPrompt) {
              action = {
                id: `act_${Date.now().toString(36)}`,
                type: "recalculate_metric",
                description: `Apply filter and recalculate metrics for ${targetSelector || "selected element"}`,
                preview: JSON.stringify({ target: targetSelector || "document", status: "ready", mode: "local-bridge" }, null, 2)
              };
              sessionStore.storePendingAction(sessionId, action);
            }
            handleDispatch(responseText, action);
            return;
          }

          AgentInferenceRouter.dispatch({
            prompt,
            systemPrompt,
            model,
            provider: payload.provider || null,
            ...(inferenceStatus._siblingCmd ? { aiCmd: inferenceStatus._siblingCmd } : {}),
            timeoutMs: 25000,
            throwOnError: true
          })
            .then((dispatchResult) => {
              activeProvider = dispatchResult.provider || null;
              const responseText = String(dispatchResult.text || "").trim().replace(/^["']|["']$/g, "");
              if (!responseText) {
                const emptyErr = new Error("AI inference provider returned an empty response.");
                emptyErr.code = "inference_unavailable";
                emptyErr.reason = "Provider returned empty output.";
                throw emptyErr;
              }
              let action = null;
              if (isMutatingPrompt) {
                action = {
                  id: `act_${Date.now().toString(36)}`,
                  type: "recalculate_metric",
                  description: `Apply filter and recalculate metrics for ${targetSelector || "selected element"}`,
                  preview: JSON.stringify({ target: targetSelector || "document", status: "ready" }, null, 2)
                };
                sessionStore.storePendingAction(sessionId, action);
              }
              handleDispatch(responseText, action);
            })
            .catch((err) => {
              const preflightInfo = err.preflight || AgentInferenceRouter.detectProviders();
              res.writeHead(503, applyLocalCorsHeaders(req, {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache, no-store"
              }));
              res.end(JSON.stringify({
                ok: false,
                status: "error",
                code: err.code || "inference_unavailable",
                error: err.message || "AI inference provider is unavailable.",
                reason: err.reason || err.message || "No AI CLI or HTTP LLM provider is configured or reachable.",
                sessionId,
                preflight: preflightInfo,
                timestamp: new Date().toISOString()
              }));
            });
        });
        return true;
      }
      return true;
    }

    if (pathname === "/api/agent/confirm-action" || pathname === "/api/agent/action-confirm") {
      if (req.method === "OPTIONS") {
        if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return true;
        res.writeHead(204, applyLocalCorsHeaders(req, {
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Report-Agent, X-CSRF-Token"
        }));
        res.end();
        return true;
      }

      if (req.method === "POST") {
        if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return true;
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          let payload = {};
          try { payload = JSON.parse(body); } catch (_) {}
          if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: true, csrfToken: payload.csrfToken })) return;

          const sessionId = payload.sessionId;
          const actionId = payload.actionId;
          const approved = payload.approved !== false;

          const action = sessionStore.resolveAction(sessionId, actionId, approved);

          if (approved && action) {
            // Broadcast execution fragment if Datastar clients are active
            const resultHtml = `
              <div id="action-result-${actionId}" class="p-2.5 rounded-lg bg-success/10 border border-success/30 text-xs text-success flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Action <strong>${escapeHtml(action.description || actionId)}</strong> was successfully executed.</span>
              </div>
            `.trim().replace(/\n/g, " ");

            for (const client of datastarClients) {
              try {
                client.write(`event: datastar-merge-fragments\ndata: fragments ${resultHtml}\n\n`);
              } catch (_) {
                datastarClients.delete(client);
              }
            }
          }

          res.writeHead(200, applyLocalCorsHeaders(req, {
            "Content-Type": "application/json"
          }));
          res.end(JSON.stringify({
            ok: true,
            actionId,
            approved,
            executed: approved,
            action,
            timestamp: new Date().toISOString()
          }));
        });
        return true;
      }
      return true;
    }

    // 1b-3. Interactive Creation Studio API (/api/create/config & /api/create/synthesize)

    if (pathname === "/__agent_edit__") {
      const sendJson = (code, obj) => {
        res.writeHead(code, applyLocalCorsHeaders(req, { "Content-Type": "application/json", "Cache-Control": "no-cache, no-store" }));
        res.end(JSON.stringify(obj));
      };
      if (req.method === "OPTIONS") {
        if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return true;
        res.writeHead(204, applyLocalCorsHeaders(req, {
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token"
        }));
        res.end();
        return true;
      }
      if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return true;
      if (req.method !== "POST") return sendJson(405, { ok: false, error: "POST required." });
      let body = "";
      req.on("data", (chunk) => { body += chunk; if (body.length > 256 * 1024) req.destroy(); });
      req.on("end", async () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (_) {}
        if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: true, csrfToken: payload.csrfToken })) return true;
        const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
        if (!prompt) return sendJson(400, { ok: false, error: "Missing prompt." });

        const target = resolveEditTarget(payload.file, resolvedPath, rootDir);
        if (!target.ok) {
          return sendJson(target.status || 403, { ok: false, error: target.error });
        }

        const effectiveModel = (typeof payload.model === "string" && payload.model.trim())
          ? payload.model.trim()
          : (target.manifest?.aiConfig?.model || "Gemini 3.8 Flash (Low)");
        const targetIds = Array.isArray(payload.targetIds) ? payload.targetIds : [];
        const anchorIds = Array.isArray(payload.anchorIds) ? payload.anchorIds : [];
        const forceCli = payload.mode === "cli" || payload.fastPatch === false;

        let fragmentHtml = "";
        let ctx = { requestedIds: [], outline: [], slices: [] };
        if (target.fragmentPath) {
          try {
            fragmentHtml = fs.readFileSync(target.fragmentPath, "utf-8");
            ctx = extractFragmentContext(fragmentHtml, { targetIds, anchorIds, prompt });
          } catch (_) {
            fragmentHtml = "";
          }
        }

        console.log(`[html-report] Agent edit requested for ${target.targetRel}${target.fragmentRel ? ` (fragment: ${target.fragmentRel})` : ""}`);

        // Tier 1: Surgical Fragment Fast-Patch when fragment.html is available with bounded context
        const canFastPatch = Boolean(
          target.fragmentPath &&
          !forceCli &&
          fragmentHtml &&
          (ctx.slices.length > 0 || fragmentHtml.length <= 24000)
        );

        let fallbackReason = null;
        if (canFastPatch) {
          const sliceSection = ctx.slices.length > 0
            ? ctx.slices.map((s) => `--- Slice #${s.id} ---\n${s.html}`).join("\n\n")
            : `--- Full fragment.html ---\n${fragmentHtml}`;
          const outlineNote = ctx.outline.length > 0
            ? `Section outline: ${ctx.outline.map((o) => `<${o.tag} id="${o.id}">`).join(", ")}`
            : "";

          const tier1System = [
            `You are a surgical HTML fragment patcher editing ${target.fragmentRel}.`,
            "Return ONLY a JSON object matching {\"patches\":[{\"find\":\"exact substring from fragment.html\",\"replace\":\"replacement HTML\"}]} with no markdown prose outside JSON.",
            "Rules: keep every 'find' unique and verbatim; preserve heading id attributes and <div class=\"overflow-x-auto\"> wrappers around <table>; never emit <html>, <head>, or <body>."
          ].join(" ");
          const tier1Prompt = [
            prompt,
            outlineNote,
            "Current Semantic Fragment context:",
            sliceSection
          ].filter(Boolean).join("\n\n");

          try {
            const t1Res = await AgentInferenceRouter.dispatch({
              systemPrompt: tier1System,
              prompt: tier1Prompt,
              model: effectiveModel,
              provider: payload.provider || null,
              timeoutMs: 45000,
              throwOnError: true
            });
            const patches = parseSurgicalPatchPayload(t1Res.text);
            if (patches) {
              const buildOpts = target.manifest ? {
                title: target.manifest.title,
                mode: target.manifest.mode,
                theme: target.manifest.theme,
                addons: target.manifest.activeAddons,
                ai: Boolean(target.manifest.aiBridge),
                pwa: Boolean(target.manifest.pwa)
              } : null;
              const applied = applySurgicalFragmentPatches(fragmentHtml, patches, { buildOptions: buildOpts });
              if (applied.ok) {
                const tmpFrag = `${target.fragmentPath}.tmp-${process.pid}-${Date.now()}`;
                fs.writeFileSync(tmpFrag, applied.html, "utf-8");
                fs.renameSync(tmpFrag, target.fragmentPath);
                rebuildProjectFromFragment(target.targetDir);
                return sendJson(200, {
                  ok: true,
                  mode: "fast-patch",
                  patchesApplied: applied.patchesApplied,
                  file: target.targetRel,
                  fragment: target.fragmentRel,
                  provider: t1Res.provider,
                  result: `Applied ${applied.patchesApplied} surgical patch(es) to ${target.fragmentRel}.`
                });
              }
              fallbackReason = applied.reason;
            } else {
              fallbackReason = "Tier 1 response did not contain valid JSON patches.";
            }
          } catch (err) {
            if (err.code === "inference_unavailable" && !/empty|JSON|patch/i.test(err.message || "")) {
              console.warn(`[html-report] Agent edit failed: ${err.message}`);
              return sendJson(502, {
                ok: false,
                code: err.code || "inference_unavailable",
                error: err.message || "Agent unavailable or timed out.",
                preflight: err.preflight || AgentInferenceRouter.detectProviders()
              });
            }
            fallbackReason = err.message;
          }
          if (fallbackReason) {
            console.log(`[html-report] Fast-patch fallback -> CLI (${fallbackReason})`);
          }
        }

        // Tier 2: Fragment-scoped full workspace-tool agent fallback (distinct systemPrompt & prompt)
        const editTargetPath = target.fragmentPath || target.targetHtmlPath;
        const tier2System = target.fragmentPath
          ? `Edit only the Semantic Fragment at ${editTargetPath}. Do not modify unrelated files. Local dev server auto-rebuilds ${target.targetRel} on save; no manual build-report.mjs run is needed.`
          : `Edit only the html-report page at ${editTargetPath}. Do not modify unrelated files.`;

        const preSlicedHint = ctx.slices.length > 0
          ? `\n\nPre-sliced target context from ${target.fragmentRel}:\n${ctx.slices.map((s) => `<!-- #${s.id} -->\n${s.html}`).join("\n\n")}`
          : "";
        const tier2Prompt = `${prompt}${preSlicedHint}`;

        AgentInferenceRouter.dispatch({
          systemPrompt: tier2System,
          prompt: tier2Prompt,
          model: effectiveModel,
          provider: payload.provider || null,
          timeoutMs: 300000,
          throwOnError: true
        })
          .then((dispatchResult) => {
            sendJson(200, {
              ok: true,
              mode: "cli",
              fallbackReason: fallbackReason || undefined,
              file: target.targetRel,
              fragment: target.fragmentRel,
              provider: dispatchResult.provider,
              result: String(dispatchResult.text || "").trim()
            });
          })
          .catch((err) => {
            console.warn(`[html-report] Agent edit failed: ${err.message}`);
            return sendJson(502, {
              ok: false,
              code: err.code || "inference_unavailable",
              error: err.message || "Agent unavailable or timed out.",
              preflight: err.preflight || AgentInferenceRouter.detectProviders()
            });
          });
      });
      return true;
    }

    // 1b-1b. Document Default Styling persistence: localhost only, workspace-scoped
    if (pathname === "/__agent_style__") {
      const sendJson = (code, obj) => {
        res.writeHead(code, applyLocalCorsHeaders(req, { "Content-Type": "application/json", "Cache-Control": "no-cache, no-store" }));
        res.end(JSON.stringify(obj));
      };
      if (req.method === "OPTIONS") {
        if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return true;
        res.writeHead(204, applyLocalCorsHeaders(req, {
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token"
        }));
        res.end();
        return true;
      }
      if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return true;
      if (req.method !== "POST") return sendJson(405, { ok: false, error: "POST required." });

      let body = "";
      req.on("data", (chunk) => { body += chunk; if (body.length > 256 * 1024) req.destroy(); });
      req.on("end", () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (_) {
          return sendJson(400, { ok: false, error: "Invalid JSON payload." });
        }
        if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: true, csrfToken: payload.csrfToken })) return true;

        let compiledCss = "";
        let compiledThemeName = null;
        if (payload.customTheme !== undefined && payload.customTheme !== null) {
          const serializedCheck = typeof payload.customTheme === "string"
            ? payload.customTheme
            : JSON.stringify(payload.customTheme);
          if (/<\/?\s*(style|script)\b/i.test(serializedCheck)) {
            return sendJson(400, { ok: false, error: "Unsafe tag detected in customTheme payload." });
          }
          try {
            const compiled = compileTheme(payload.customTheme);
            if (!compiled || !compiled.css || /<\/?\s*(style|script)\b/i.test(compiled.css)) {
              return sendJson(400, { ok: false, error: "Invalid compiled customTheme CSS." });
            }
            compiledCss = compiled.css;
            compiledThemeName = compiled.themeName;
          } catch (err) {
            return sendJson(400, { ok: false, error: `Invalid customTheme: ${err.message}` });
          }
        }

        const rawTheme = typeof payload.theme === "string" && payload.theme.trim()
          ? payload.theme.trim()
          : (compiledThemeName || "");
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(rawTheme)) {
          return sendJson(400, { ok: false, error: "Invalid or missing theme name." });
        }

        const target = resolveEditTarget(payload.file, resolvedPath, rootDir);
        if (!target.ok) {
          return sendJson(target.status || 403, { ok: false, error: target.error });
        }

        try {
          if (target.manifestPath && target.fragmentPath) {
            const manifestObj = JSON.parse(fs.readFileSync(target.manifestPath, "utf-8"));
            manifestObj.theme = rawTheme;
            manifestObj.customTheme = payload.customTheme ? payload.customTheme : null;
            const tmpManifest = `${target.manifestPath}.tmp-${process.pid}-${Date.now()}`;
            fs.writeFileSync(tmpManifest, JSON.stringify(manifestObj, null, 2) + "\n", "utf-8");
            fs.renameSync(tmpManifest, target.manifestPath);
            rebuildProjectFromFragment(target.targetDir, { force: true });
            return sendJson(200, {
              ok: true,
              mode: "project",
              file: target.targetRel,
              theme: rawTheme,
              customTheme: Boolean(compiledCss)
            });
          }

          const currentHtml = fs.readFileSync(target.targetHtmlPath, "utf-8");
          const updatedHtml = applyStyleToStandaloneHtml(currentHtml, {
            theme: rawTheme,
            compiledCustomCss: compiledCss
          });
          const tmpHtml = `${target.targetHtmlPath}.tmp-${process.pid}-${Date.now()}`;
          fs.writeFileSync(tmpHtml, updatedHtml, "utf-8");
          fs.renameSync(tmpHtml, target.targetHtmlPath);
          broadcastReload(target.targetHtmlPath);
          return sendJson(200, {
            ok: true,
            mode: "standalone",
            file: target.targetRel,
            theme: rawTheme,
            customTheme: Boolean(compiledCss)
          });
        } catch (err) {
          return sendJson(500, { ok: false, error: `Failed to persist style: ${err.message}` });
        }
      });
      return true;
    }

    // 1b-2. Universal Two-Way Agent Bridge & Co-Pilot (Agent-Agnostic Turnkey Bridge)
    if (
      pathname === "/__agent_action__" ||
      pathname === "/api/agent" ||
      pathname === "/api/agent-query" ||
      pathname === "/api/agent-roast" ||
      pathname === "/__agent_roast__" ||
      pathname === "/__agent_status__" ||
      pathname === "/api/agent/status"
    ) {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Report-Agent, datastar-request"
        });
        res.end();
        return true;
      }

      if (req.method === "GET") {
        const providerStatus = AgentInferenceRouter.detectProviders();
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache, no-store"
        });
        res.end(JSON.stringify({
          ok: true,
          bridge: providerStatus.activeProviderName
            ? `Turnkey AI Bridge (${providerStatus.activeProviderName} / agy CLI compatible)`
            : "Google Antigravity agy CLI Bridge",
          uiConfigured: true,
          bridgeReachable: true,
          installed: providerStatus.installed,
          authenticated: providerStatus.authenticated,
          inferenceVerified: Boolean(providerStatus.inferenceVerified),
          providerAvailable: providerStatus.providerAvailable,
          activeProvider: providerStatus.activeProvider,
          activeProviderName: providerStatus.activeProviderName,
          availableProviders: providerStatus.availableProviders,
          authenticatedProviders: providerStatus.authenticatedProviders,
          checkedProviders: providerStatus.checkedProviders,
          streamConnected: datastarClients.size > 0,
          streamListeners: datastarClients.size,
          mcpEndpoint: "/mcp",
          modelConfigured: true,
          defaultModel: "Gemini 3.8 Flash (Low)",
          personas: personaRegistry.list().map((p) => p.id),
          actions: ["query", "analyze", "summarize", "roast", "action"],
          version: getPackageVersion()
        }));
        return true;
      }

      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          let payload = {};
          try { payload = JSON.parse(body); } catch (_) {}

          // Dynamic on-the-fly persona registration if personaConfig is provided
          if (payload.personaConfig || payload.personaDefinition) {
            try {
              personaRegistry.register(payload.personaConfig || payload.personaDefinition);
            } catch (e) {
              console.warn("[html-report] Inline persona registration warning:", e.message);
            }
          }

          const isDatastarRequest =
            payload.format === "datastar" ||
            req.headers["datastar-request"] === "true" ||
            (req.headers.accept || "").includes("text/event-stream");

          const action = payload.action || (pathname.includes("roast") ? "roast" : "query");
          const personaKey = payload.persona || (action === "roast" ? "sarcastic" : "analyst");
          const activePersona = personaRegistry.get(personaKey);
          const targetSelector = payload.targetSelector || activePersona.defaultTarget || "#agent-reaction-bubble";
          const model = payload.model || activePersona.defaultModel || "Gemini 3.8 Flash (Low)";

          const personaPrompt = payload.systemPrompt || activePersona.systemPrompt;
          const formattingPrompt = activePersona.formatting ? `\nFormatting Instructions: ${activePersona.formatting}` : "";

          let prompt = "";
          // Backward compatibility for Pokémon roast testing
          if (payload.name || payload.types || payload.stats) {
            const pokemonName = payload.name || "Target Entity";
            const typesStr = Array.isArray(payload.types) ? payload.types.join("/") : (payload.types || "Standard");
            const statsStr = payload.stats
              ? (typeof payload.stats === "object"
                ? Object.entries(payload.stats).map(([k, v]) => `${k}: ${v}`).join(", ")
                : String(payload.stats))
              : "";
            prompt = `${personaPrompt}${formattingPrompt}
Target: ${pokemonName} (${typesStr})
Stats: ${statsStr}
CRITICAL INSTRUCTION: Return ONLY the single witty response. Do not include introductory text, quotation marks, or markdown wrappers.`;
          } else if (payload.prompt) {
            let contextStr = "";
            if (payload.context) {
              contextStr = `\nContext / Telemetry:\n${typeof payload.context === "object" ? JSON.stringify(payload.context, null, 2) : String(payload.context)}`;
            }
            prompt = `${personaPrompt}${formattingPrompt}\n${payload.prompt}${contextStr}\nCRITICAL INSTRUCTION: Deliver a concise, direct, high-signal response. Avoid unnecessary disclaimers.`;
          } else {
            prompt = `${personaPrompt}${formattingPrompt}\nPlease provide an assessment of current dashboard state and metrics.`;
          }

          const completeAgentResponse = (isError, rawText, providerId, errObj = null) => {
            let responseText = "";
            if (isError) {
              if (errObj) {
                console.warn(`[html-report] Agent inference call failed: ${errObj.message}`);
              }
              responseText = payload.fallbackText || `[Local Fallback] Request evaluated for action '${action}'. Agent provider temporarily offline or timed out.`;
            } else {
              responseText = String(rawText || "").trim().replace(/^["']|["']$/g, "");
            }

            const engineLabel = isError
              ? "Local Heuristic Engine (Fallback)"
              : `Turnkey AI Bridge (${providerId || "agy"} • ${model})`;

            if (isDatastarRequest) {
              res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
                "Access-Control-Allow-Origin": "*"
              });

              const badgeColor = isError ? "badge-warning" : (activePersona.badgeColor || "badge-primary");
              const badgeLabel = isError ? "LOCAL FALLBACK" : "LIVE AI CO-PILOT";
              const fragment = `
                <div id="${targetSelector.replace(/^#/, "")}" class="p-4 rounded-xl border border-base-300 bg-base-100 shadow-md space-y-2 transition-all">
                  <div class="flex items-center justify-between gap-2 flex-wrap">
                    <span class="badge ${badgeColor} badge-sm font-bold gap-1 text-[11px] shadow-sm">
                      <span class="inline-block w-2 h-2 rounded-full ${isError ? 'bg-warning' : 'bg-success'} animate-pulse mr-1"></span>
                      ${badgeLabel} &bull; ${escapeHtml(activePersona.name.toUpperCase())}
                    </span>
                    <span class="text-xs text-base-content/60 font-mono">${new Date().toLocaleTimeString()}</span>
                  </div>
                  <p class="text-sm text-base-content leading-relaxed">${escapeHtml(responseText)}</p>
                  <div class="text-[11px] text-base-content/50 font-mono pt-1 border-t border-base-200 flex items-center justify-between">
                    <span>Engine: ${escapeHtml(engineLabel)}</span>
                    <span class="font-mono text-[10px] text-base-content/40">${escapeHtml(activePersona.id)}</span>
                  </div>
                </div>
              `.trim();

              res.write(DatastarBridge.formatFragment({ selector: targetSelector, html: fragment, merge: "morph" }));
              res.end();
              return;
            }

            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            });
            res.end(JSON.stringify({
              ok: !isError,
              action,
              persona: activePersona.id,
              personaName: activePersona.name,
              badgeColor: activePersona.badgeColor,
              icon: activePersona.icon,
              provider: providerId || null,
              result: responseText,
              oneliner: responseText,
              agent: engineLabel,
              isLiveAI: !isError,
              fallback: isError,
              timestamp: new Date().toISOString()
            }));
          };

          AgentInferenceRouter.dispatch({
            prompt,
            systemPrompt: `${personaPrompt}${formattingPrompt}`,
            model,
            provider: payload.provider || null,
            timeoutMs: 25000,
            throwOnError: true
          })
            .then((dispatchResult) => {
              const out = String(dispatchResult.text || "").trim();
              if (!out) {
                throw new Error("Empty inference output");
              }
              completeAgentResponse(false, out, dispatchResult.provider);
            })
            .catch((err) => {
              completeAgentResponse(true, "", null, err);
            });
        });
        return true;
      }
      return true;
    }

  return false;
}
