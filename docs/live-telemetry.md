# 📡 Real-Time Live Dashboards & Agent Telemetry

`html-report` supports real-time hypermedia streaming and reactive signals via **Datastar.js** (`@starfederation/datastar`). This enables live, low-latency observability of AI agents executing multi-step workflows without full-page reloads.

---

## ⚡ The Live Mode Flag (`--live`)

When building a live dashboard, pass the `--live` flag to `build-report.mjs` or `harness.mjs`:

```bash
node skills/html-report/scripts/build-report.mjs \
  --title "Live Agent Swarm" \
  --content live-fragment.html \
  --live \
  --output live-dashboard.html
```

This injects the official Datastar.js ESM module, sets `data-report-mode="live"`, and wires client signals for SSE ingestion.

---

## 🌊 SSE Hypermedia Streaming Architecture

The dev server (`serve-report.mjs`) provides a high-throughput Server-Sent Events endpoint at `/__datastar_stream__`.

```
┌────────────────────────────────┐
│ Agent Execution Engine         │
│ (Antigravity / Codex / Claude) │
└──────────────┬─────────────────┘
               │ Byte-offset tailing or direct events
               ▼
┌────────────────────────────────┐
│ DatastarBridge (datastar-sse)  │ 🛡️ Canonical Telemetry Normalization
└──────────────┬─────────────────┘
               │ SSE event: datastar-merge-fragments
               ▼
┌────────────────────────────────┐
│ Browser (Datastar + Idiomorph) │ ⚡ Zero-Flicker Micro-DOM Morphing
└────────────────────────────────┘
```

### Standardized `TaskTelemetrySchema`

The telemetry pipeline normalizes diverse vendor telemetry into a unified canonical schema:

```typescript
interface CanonicalTaskTelemetry {
  taskId: string;
  status: "pending" | "running" | "completed" | "failed";
  progressPct: number;
  toolCall?: {
    name: string;
    params: Record<string, any>;
    status: "invoked" | "streaming" | "completed" | "error";
    outputSnippet?: string;
  };
  metrics: {
    contextWindowSaturationPct: number;
    tokensPerSecond: number;
    totalTokens: number;
  };
}
```

---

## 🧩 Supported Telemetry Adapters

`skills/html-report/scripts/datastar-sse.mjs` includes built-in adapters for major AI coding agents:

1. **Google Antigravity (`AgyTelemetryAdapter`)**:
   - Tails active conversation JSONL transcripts (`transcript.jsonl`) via byte offsets without re-reading previous lines.
   - Streams tool calls (`run_command`, `write_file`, `edit_file`, `invoke_subagent`).
   - Normalizes subagent swarms and tracks execution across swimlanes.
2. **OpenAI Codex (`CodexTelemetryAdapter`)**:
   - Streams live Chain-of-Thought reasoning blocks and function call executions.
3. **Claude Code (`ClaudeTelemetryAdapter`)**:
   - Normalizes Claude `tool_use` and thinking blocks into unified SSE morphs.

---

## 🔄 Zero-Flicker Morphing & Lucide Rehydration

When the server pushes updated task HTML fragments:
- **Idiomorph Algorithm**: Morphs only the mutated elements (e.g. updating a task badge from `running` to `completed` or updating a progress bar width) while preserving scroll position and focus.
- **Post-Morph Icon Rehydration**: The client runtime observes DOM changes using a `MutationObserver` and automatically rehydrates newly inserted `<i data-lucide="...">` tags into crisp SVG icons.

---

## 📑 Showdown Artifact Modal Preview

During active planning or coding journeys, live dashboards expose 1-click artifact preview buttons (`proposal.md`, `specs/`, `design.md`, `tasks.md`). Clicking an artifact triggers `window.openMarkdownViewer(url)`, which fetches the markdown from the dev server and renders it inside an accessible Showdown preview modal without page navigation.
