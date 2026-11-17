/**
 * @html-report/studio Authoring Plugin Loader & Live Injector
 * Reads edit-dock.html and authoring-plugin.js and injects them into
 * core template-shell slots or clean viewer HTML responses.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_DIR = path.resolve(__dirname, "../assets");

function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function extractSlot(html, name) {
  const re = new RegExp(`<!-- html-report:slot:${name} -->([\\s\\S]*?)<!-- /html-report:slot:${name} -->`);
  const match = html.match(re);
  return match ? match[1].trim() : "";
}

function customizePersonaAndPurpose(markup, { aiPersona = "analyst", aiPurpose = "" } = {}) {
  let out = markup;
  if (aiPersona) {
    const safePersona = escapeAttr(aiPersona);
    const escapedPersonaRegex = safePersona.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const personaLabel = aiPersona.charAt(0).toUpperCase() + aiPersona.slice(1);
    out = out.replace(
      /(<select id="agent-dock-persona"[^>]*>)([\s\S]*?)(<\/select>)/i,
      (full, openTag, innerOpts, closeTag) => {
        let updatedOpts = innerOpts.replace(/\s+selected\b/gi, "");
        const optRegex = new RegExp(`(<option\\s+value=["']${escapedPersonaRegex}["'])(>)`, "i");
        if (optRegex.test(updatedOpts)) {
          updatedOpts = updatedOpts.replace(optRegex, `$1 selected$2`);
        } else {
          updatedOpts = `\n            <option value="${safePersona}" selected>${escapeAttr(personaLabel)}</option>` + updatedOpts;
        }
        return `${openTag}${updatedOpts}${closeTag}`;
      }
    );
  }

  if (aiPurpose) {
    const safePurpose = escapeAttr(aiPurpose);
    out = out.replace(
      /(<p id="agent-dock-welcome-copy"[^>]*>)[\s\S]*?(<\/p>)/i,
      (full, openTag, closeTag) => `${openTag}${safePurpose} Press <kbd class="kbd kbd-xs font-mono">⌘K</kbd> to toggle.${closeTag}`
    );
  } else if (aiPersona && aiPersona.toLowerCase() === "support") {
    out = out.replace(
      /(<p id="agent-dock-welcome-copy"[^>]*>)[\s\S]*?(<\/p>)/i,
      (full, openTag, closeTag) => `${openTag}Ask questions about the documentation, setup steps, or troubleshooting guidance on this page. Press <kbd class="kbd kbd-xs font-mono">⌘K</kbd> to toggle.${closeTag}`
    );
  }

  return out;
}

export function getAuthoringPlugin({
  aiDock = true,
  aiPersona = "analyst",
  aiPurpose = "",
  editDockPath = path.join(ASSETS_DIR, "edit-dock.html"),
  authoringScriptPath = path.join(ASSETS_DIR, "authoring-plugin.js")
} = {}) {
  const rawDock = fs.readFileSync(editDockPath, "utf-8");
  const defaultScriptPath = path.join(ASSETS_DIR, "authoring-plugin.js");
  let script;
  if (path.resolve(authoringScriptPath) === defaultScriptPath) {
    const req = createRequire(import.meta.url);
    const loader = req(defaultScriptPath);
    script = typeof loader.getBundledAuthoringSource === "function"
      ? loader.getBundledAuthoringSource()
      : fs.readFileSync(authoringScriptPath, "utf-8");
  } else {
    script = fs.readFileSync(authoringScriptPath, "utf-8");
  }

  const navbar = extractSlot(rawDock, "navbar");
  const settingsTop = extractSlot(rawDock, "settings-top");
  const downloadTop = extractSlot(rawDock, "download-top");
  const settingsExtra = extractSlot(rawDock, "settings-extra");
  let markup = extractSlot(rawDock, "body");

  if (!aiDock) {
    markup = markup.replace(/<!-- html-report:slot:ai-dock -->[\s\S]*?<!-- \/html-report:slot:ai-dock -->\n*/g, "");
  } else {
    markup = markup
      .replace(/<!-- html-report:slot:ai-dock -->\n?/g, "")
      .replace(/<!-- \/html-report:slot:ai-dock -->\n?/g, "");
  }

  markup = customizePersonaAndPurpose(markup, { aiPersona, aiPurpose });

  return {
    navbar,
    settingsTop,
    downloadTop,
    settingsExtra,
    markup,
    script
  };
}

/**
 * Injects the authoring plugin into an assembled viewer HTML string
 * (when serving an editable workspace or compiling with --editable).
 */
export function injectAuthoringPlugin(html, options = {}) {
  if (!html || typeof html !== "string") return html;
  if (/<meta\s+name=["']html-report-published["']\s+content=["']true["']/i.test(html)) {
    return html;
  }
  if (html.includes('id="edit-dock"')) {
    return html;
  }

  const plugin = getAuthoringPlugin(options);
  let out = html;

  const hasSlots =
    out.includes("<!-- {{AUTHORING_MARKUP}} -->") ||
    out.includes("<!-- {{AUTHORING_SCRIPT}} -->");

  if (hasSlots) {
    out = out.replace(/<!-- \{\{AUTHORING_NAVBAR\}\} -->/g, () => plugin.navbar);
    out = out.replace(/<!-- \{\{AUTHORING_SETTINGS_TOP\}\} -->/g, () => plugin.settingsTop);
    out = out.replace(/<!-- \{\{AUTHORING_DOWNLOAD_TOP\}\} -->/g, () => plugin.downloadTop);
    out = out.replace(/<!-- \{\{AUTHORING_SETTINGS_EXTRA\}\} -->/g, () => plugin.settingsExtra);
    out = out.replace(/<!-- \{\{AUTHORING_MARKUP\}\} -->/g, () => plugin.markup);
    out = out.replace(/<!-- \{\{AUTHORING_SCRIPT\}\} -->/g, () => `<script data-authoring="true">\n${plugin.script}\n  </script>`);
    return out;
  }

  // Fallback for already-built clean reports without slot comments (live-serve injection)
  if (!out.includes('id="agent-bridge-status-container"') && plugin.navbar) {
    out = out.replace(/(<div class="dropdown dropdown-end" id="toc-dropdown">)/i, `${plugin.navbar}\n        $1`);
  }
  if (!out.includes('id="open-all-settings-btn"') && plugin.settingsTop) {
    out = out.replace(/(<div id="settings-panel"[^>]*>)/i, `$1\n            ${plugin.settingsTop}`);
  }
  if (!out.includes('id="settings-publish-toggle"') && plugin.downloadTop) {
    out = out.replace(/(<div id="download-dropdown"[^>]*>)/i, `$1\n                  ${plugin.downloadTop}`);
  }
  if (!out.includes('id="settings-extra-sections"') && plugin.settingsExtra) {
    out = out.replace(/(<\/details>\s*<\/div>\s*<\/div>\s*<!-- 4\. PWA Install)/i, `</details>\n            ${plugin.settingsExtra}\n          </div>\n        </div>\n\n        <!-- 4. PWA Install`);
  }

  const injection = `${plugin.markup}\n  <script data-authoring="true">\n${plugin.script}\n  </script>\n</body>`;
  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, () => injection);
  } else {
    out += injection;
  }
  return out;
}

export default {
  getAuthoringPlugin,
  injectAuthoringPlugin
};
