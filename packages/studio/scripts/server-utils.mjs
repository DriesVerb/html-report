/**
 * @file server-utils.mjs
 * Thin barrel re-exporting server utilities from packages/studio/scripts/lib/server/*.
 */

export {
  MIME_TYPES,
  PersonaRegistry,
  SessionStateStore,
  parseArgs,
  openBrowser,
  detectReportMode,
  buildLocalBridgeReply
} from "./lib/server/persona-and-session.mjs";

export {
  findActiveChangeDir,
  isPathInside,
  isLoopbackAddress,
  findWorkspaceRoot,
  extractProjectMetadata,
  scanWorkspaceProjects
} from "./lib/server/workspace-scanner.mjs";

export {
  resolveEditTarget,
  applyStyleToStandaloneHtml,
  extractFragmentContext,
  parseSurgicalPatchPayload,
  applySurgicalFragmentPatches
} from "./lib/server/surgical-patcher.mjs";

export {
  injectLiveReload
} from "./lib/server/live-reload-client.mjs";
