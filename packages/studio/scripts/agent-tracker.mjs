/**
 * agent-tracker.mjs
 * Publication-Grade Live Agent Tracker Engine (Barrel & CLI Daemon Entrypoint)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

export {
  CanonicalAgentStates,
  CanonicalToolCategories,
  sanitizeCanonicalEvent
} from "./lib/tracker/canonical-schema.mjs";
export {
  AgentTelemetryStrategy,
  AgyTelemetryStrategy,
  ClaudeCodeTelemetryStrategy,
  CodexSwarmTelemetryStrategy,
  GenericTelemetryStrategy
} from "./lib/tracker/telemetry-strategies.mjs";
export { AgentTrackerFacade } from "./lib/tracker/facade.mjs";
export { TranscriptTailDaemon } from "./lib/tracker/transcript-daemon.mjs";

import { TranscriptTailDaemon } from "./lib/tracker/transcript-daemon.mjs";

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  if (args.includes("--tail")) {
    const portIdx = args.indexOf("--port");
    const port = portIdx !== -1 ? Number(args[portIdx + 1]) || 3031 : 3031;
    const fileIdx = args.indexOf("--file");
    const filePath = fileIdx !== -1 ? args[fileIdx + 1] : null;

    const daemon = new TranscriptTailDaemon({
      transcriptPath: filePath,
      port,
      pushToDevServer: true
    });

    daemon.start().then(() => {
      console.log(`[agent-tracker] Daemon started. Tailing: ${daemon.transcriptPath} -> http://127.0.0.1:${port}/__datastar_stream__`);
    }).catch((err) => {
      console.error("[agent-tracker] Failed to start daemon:", err.message);
      process.exit(1);
    });
  }
}
