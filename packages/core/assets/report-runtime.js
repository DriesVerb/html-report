/**
 * html-report client runtime loader (report-runtime.js)
 * Assembles modular runtime chunks from ./runtime/*.js for inline HTML compilation
 * while exposing static CommonJS / ESM named exports for Node.js tests & Studio plugins.
 */
const fs = require("node:fs");
const path = require("node:path");

const RUNTIME_DIR = path.join(__dirname, "runtime");

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getBundledRuntimeSource() {
  const files = fs
    .readdirSync(RUNTIME_DIR)
    .filter((f) => f.endsWith(".js"))
    .sort();
  return files
    .map((file) => fs.readFileSync(path.join(RUNTIME_DIR, file), "utf-8"))
    .join("\n\n");
}

function evaluateBundledRuntime() {
  const source = getBundledRuntimeSource();
  const runtimeModule = { exports: {} };
  const fn = new Function(
    "exports",
    "require",
    "module",
    "__filename",
    "__dirname",
    source
  );
  fn(runtimeModule.exports, require, runtimeModule, __filename, __dirname);
  return runtimeModule.exports;
}

const {
  STANDARD_DAISYUI_THEMES,
  DAISYUI_THEMES,
  registerCustomTheme,
  scanAndRegisterExistingCustomThemes,
  srgbToLinear,
  linearToSrgb,
  hexToRgb,
  hslToRgb,
  parseColor,
  rgbToOklch,
  autoContrastContent,
  compileTheme,
  tailwindConfigSnippet,
  cssColorToHexAndRgba,
  resolveDaisyUIThemePalette,
  sanitizeMermaidSource,
  renderMermaidWithTheme,
  createThemeSwatchButton,
  initThemeDropdown,
  setReportTheme,
  initTOC,
  checkInsufficientHorizontalSpace,
  buildInlinedHtmlSnapshot,
  exportReportPdf,
  _triggerBlobDownload,
  _authoringStorage,
  initModeBadge,
  initDownloadButton,
  initDayjs,
  initImpress,
  impressNext,
  impressPrev,
  impressGoto,
  initPresentationShell,
  resizePresentationWidgets,
  sanitizeSpeakerNotesHtml,
  initMockjs,
  initShowdown,
  openMarkdownViewer,
  closeMarkdownViewer,
  initFullCalendar,
  initDeclarativeCharts,
  initDeclarativeGridjs,
  initDeclarativeLeaflet,
  rehydrateLucideIcons,
  initDatastarObserver,
  syncDatastarTheme,
  autoLinkMarkdownFiles,
  reinitReportContent,
  initPublicFeeds,
  cleanupPublicFeeds,
  resolveFeedUrl,
  getFeedRegistry,
  extractFeedFields,
  updateFeedCharts,
  mergeFeedSignals,
  syncPwaThemeColor,
  initPwa,
  HTMLReportBoard,
  HTMLReportSettings,
  HTMLReportMermaid,
  HTMLReportPublisher,
  getPageKey,
  isPublishedDocument,
  _getActiveFeedPollers
} = evaluateBundledRuntime();

module.exports = {
  STANDARD_DAISYUI_THEMES,
  DAISYUI_THEMES,
  escapeHtml,
  registerCustomTheme,
  scanAndRegisterExistingCustomThemes,
  srgbToLinear,
  linearToSrgb,
  hexToRgb,
  hslToRgb,
  parseColor,
  rgbToOklch,
  autoContrastContent,
  compileTheme,
  tailwindConfigSnippet,
  cssColorToHexAndRgba,
  resolveDaisyUIThemePalette,
  sanitizeMermaidSource,
  renderMermaidWithTheme,
  createThemeSwatchButton,
  initThemeDropdown,
  setReportTheme,
  initTOC,
  checkInsufficientHorizontalSpace,
  buildInlinedHtmlSnapshot,
  exportReportPdf,
  _triggerBlobDownload,
  _authoringStorage,
  initModeBadge,
  initDownloadButton,
  initDayjs,
  initImpress,
  impressNext,
  impressPrev,
  impressGoto,
  initPresentationShell,
  resizePresentationWidgets,
  sanitizeSpeakerNotesHtml,
  initMockjs,
  initShowdown,
  openMarkdownViewer,
  closeMarkdownViewer,
  initFullCalendar,
  initDeclarativeCharts,
  initDeclarativeGridjs,
  initDeclarativeLeaflet,
  rehydrateLucideIcons,
  initDatastarObserver,
  syncDatastarTheme,
  autoLinkMarkdownFiles,
  reinitReportContent,
  initPublicFeeds,
  cleanupPublicFeeds,
  resolveFeedUrl,
  getFeedRegistry,
  extractFeedFields,
  updateFeedCharts,
  mergeFeedSignals,
  syncPwaThemeColor,
  initPwa,
  HTMLReportBoard,
  HTMLReportSettings,
  HTMLReportMermaid,
  HTMLReportPublisher,
  getPageKey,
  isPublishedDocument,
  _getActiveFeedPollers,
  getBundledRuntimeSource
};
