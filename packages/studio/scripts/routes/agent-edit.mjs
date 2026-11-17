/**
 * @file routes/agent-edit.mjs
 * HTTP route handlers for workspace-scoped surgical page edits (/__agent_edit__)
 * and document theme/style persistence (/__agent_style__).
 */

import fs from "node:fs";
import { compileTheme } from "@html-report/core/theme";
import { AgentInferenceRouter } from "../preflight.mjs";
import {
  resolveEditTarget,
  applyStyleToStandaloneHtml,
  extractFragmentContext,
  parseSurgicalPatchPayload,
  applySurgicalFragmentPatches
} from "../server-utils.mjs";

export function handleAgentEditRoutes(req, res, parsedUrl, pathname, ctx) {
  const {
    resolvedPath,
    rootDir,
    applyLocalCorsHeaders,
    enforceLocalBridgeSecurity,
    broadcastReload,
    rebuildProjectFromFragment
  } = ctx;

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
      let fragContext = { requestedIds: [], outline: [], slices: [] };
      if (target.fragmentPath) {
        try {
          fragmentHtml = fs.readFileSync(target.fragmentPath, "utf-8");
          fragContext = extractFragmentContext(fragmentHtml, { targetIds, anchorIds, prompt });
        } catch (_) {
          fragmentHtml = "";
        }
      }

      console.log(`[html-report] Agent edit requested for ${target.targetRel}${target.fragmentRel ? ` (fragment: ${target.fragmentRel})` : ""}`);

      const canFastPatch = Boolean(
        target.fragmentPath &&
        !forceCli &&
        fragmentHtml &&
        (fragContext.slices.length > 0 || fragmentHtml.length <= 24000)
      );

      let fallbackReason = null;
      if (canFastPatch) {
        const sliceSection = fragContext.slices.length > 0
          ? fragContext.slices.map((s) => `--- Slice #${s.id} ---\n${s.html}`).join("\n\n")
          : `--- Full fragment.html ---\n${fragmentHtml}`;
        const outlineNote = fragContext.outline.length > 0
          ? `Section outline: ${fragContext.outline.map((o) => `<${o.tag} id="${o.id}">`).join(", ")}`
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

      const editTargetPath = target.fragmentPath || target.targetHtmlPath;
      const tier2System = target.fragmentPath
        ? `Edit only the Semantic Fragment at ${editTargetPath}. Do not modify unrelated files. Local dev server auto-rebuilds ${target.targetRel} on save; no manual build-report.mjs run is needed.`
        : `Edit only the html-report page at ${editTargetPath}. Do not modify unrelated files.`;

      const preSlicedHint = fragContext.slices.length > 0
        ? `\n\nPre-sliced target context from ${target.fragmentRel}:\n${fragContext.slices.map((s) => `<!-- #${s.id} -->\n${s.html}`).join("\n\n")}`
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

  return false;
}
