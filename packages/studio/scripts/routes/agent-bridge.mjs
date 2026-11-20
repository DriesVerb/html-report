import { getPackageVersion } from "@html-report/core/compatibility";
import { CSRFManager } from "../mcp-server.mjs";
import { AgentInferenceRouter } from "../preflight.mjs";
import { escapeHtml } from "../datastar-sse.mjs";
import { isLoopbackAddress, buildLocalBridgeReply } from "../server-utils.mjs";
import { handleAgentEditRoutes } from "./agent-edit.mjs";
import { handleAgentCopilotRoutes } from "./agent-copilot.mjs";

let cachedVerifyResult = null;
let cachedVerifyExpiresAt = 0;

export function handleAgentBridgeRoutes(req, res, parsedUrl, pathname, ctx) {
  const {
    resolvedPath,
    rootDir,
    datastarClients,
    personaRegistry,
    sessionStore,
    csrfManager,
    isValidLocalOrigin,
    applyLocalCorsHeaders,
    enforceLocalBridgeSecurity,
    resolveInferenceStatus
  } = ctx;
  const serverPort = ctx.getServerPort();
  const requestedPort = ctx.getRequestedPort();

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

          const sendLocalBridgeReply = () => {
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
          };

          const inferenceStatus = resolveInferenceStatus({ provider: payload.provider || null });
          if (inferenceStatus._useBuiltInLocalBridge && !payload.provider) {
            sendLocalBridgeReply();
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
              if (inferenceStatus.localMode && !payload.provider) {
                sendLocalBridgeReply();
                return;
              }
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

    if (handleAgentEditRoutes(req, res, parsedUrl, pathname, ctx)) return true;
    if (handleAgentCopilotRoutes(req, res, parsedUrl, pathname, ctx)) return true;

  return false;
}
