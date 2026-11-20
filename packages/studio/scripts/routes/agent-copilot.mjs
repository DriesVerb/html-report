/**
 * @file routes/agent-copilot.mjs
 * HTTP route handlers for universal co-pilot actions, status inspection, and
 * Datastar streaming responses (/api/agent, /__agent_action__, /__agent_status__, etc.).
 */

import { getPackageVersion } from "@html-report/core/compatibility";
import { AgentInferenceRouter } from "../preflight.mjs";
import { DatastarBridge, escapeHtml } from "../datastar-sse.mjs";
import { readRequestBody } from "../server-utils.mjs";

const COPILOT_ROUTES = new Set([
  "/__agent_action__",
  "/api/agent",
  "/api/agent-query",
  "/api/agent-roast",
  "/__agent_roast__",
  "/__agent_status__",
  "/api/agent/status"
]);

export function handleAgentCopilotRoutes(req, res, parsedUrl, pathname, ctx) {
  if (!COPILOT_ROUTES.has(pathname)) return false;

  const { datastarClients, personaRegistry, applyLocalCorsHeaders, enforceLocalBridgeSecurity } = ctx;

  if (req.method === "OPTIONS") {
    if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return true;
    res.writeHead(204, applyLocalCorsHeaders(req, {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Report-Agent, datastar-request"
    }));
    res.end();
    return true;
  }

  if (req.method === "GET") {
    const providerStatus = AgentInferenceRouter.detectProviders();
    res.writeHead(200, applyLocalCorsHeaders(req, {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store"
    }));
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
    if (!enforceLocalBridgeSecurity(req, res, { requireCsrf: false })) return true;
    readRequestBody(req, res, { corsHeaders: applyLocalCorsHeaders(req, { "Content-Type": "application/json" }) }).then((body) => {
      if (body === null) return;
      let payload = {};
      try { payload = JSON.parse(body); } catch (_) {}

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
          res.writeHead(200, applyLocalCorsHeaders(req, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive"
          }));

          const badgeColor = isError ? "badge-warning" : (activePersona.badgeColor || "badge-primary");
          const badgeLabel = isError ? "LOCAL FALLBACK" : "LIVE AI CO-PILOT";
          const fragment = `
            <div id="${escapeHtml(targetSelector.replace(/^#/, ""))}" class="p-4 rounded-xl border border-base-300 bg-base-100 shadow-md space-y-2 transition-all">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <span class="badge ${escapeHtml(badgeColor)} badge-sm font-bold gap-1 text-[11px] shadow-sm">
                  <span class="inline-block w-2 h-2 rounded-full ${isError ? "bg-warning" : "bg-success"} animate-pulse mr-1"></span>
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

        res.writeHead(200, applyLocalCorsHeaders(req, {
          "Content-Type": "application/json"
        }));
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

  res.writeHead(405, applyLocalCorsHeaders(req, { Allow: "GET, POST, OPTIONS", "Content-Type": "application/json" }));
  res.end(JSON.stringify({ ok: false, error: `Method ${req.method} not allowed` }));
  return true;
}
