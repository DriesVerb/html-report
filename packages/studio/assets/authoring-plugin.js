/**
 * @html-report/studio Authoring Plugin loader (authoring-plugin.js)
 * Bundles modular authoring chunks from ./authoring/*.js for opt-in HTML injection
 * while exposing static CommonJS / ESM named exports for Node.js tests.
 */
const fs = require("node:fs");
const path = require("node:path");

const AUTHORING_DIR = path.join(__dirname, "authoring");

function getBundledAuthoringSource() {
  const files = fs
    .readdirSync(AUTHORING_DIR)
    .filter((f) => f.endsWith(".js"))
    .sort();
  const body = files
    .map((file) => fs.readFileSync(path.join(AUTHORING_DIR, file), "utf-8"))
    .join("\n\n");
  return `(function () {\n${body}\n})();\n`;
}

function evaluateBundledAuthoring() {
  const source = getBundledAuthoringSource();
  const pluginModule = { exports: {} };
  const fn = new Function(
    "exports",
    "require",
    "module",
    "__filename",
    "__dirname",
    source
  );
  fn(pluginModule.exports, require, pluginModule, __filename, __dirname);
  return pluginModule.exports;
}

const {
  HTMLReportAgent,
  HTMLReportEdit,
  HTMLReportSettings,
  HTMLReportPublisher,
  initAuthoring
} = evaluateBundledAuthoring();

module.exports = {
  HTMLReportAgent,
  HTMLReportEdit,
  HTMLReportSettings,
  HTMLReportPublisher,
  initAuthoring,
  getBundledAuthoringSource
};
