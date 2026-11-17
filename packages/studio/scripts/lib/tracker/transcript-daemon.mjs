/**
 * Background Byte-Offset JSONL Transcript Tailing Daemon.
 */
import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import { AgentTrackerFacade } from "./facade.mjs";

export class TranscriptTailDaemon extends EventEmitter {
  constructor({
    transcriptPath = null,
    facade = null,
    pollIntervalMs = 250,
    pushToDevServer = true,
    port = 3000,
    host = "127.0.0.1"
  } = {}) {
    super();
    this.transcriptPath = transcriptPath;
    this.facade = facade || new AgentTrackerFacade();
    this.pollIntervalMs = pollIntervalMs;
    this.shouldPush = pushToDevServer;
    this.port = port;
    this.host = host;

    this.lastByteOffset = 0;
    this.remainder = "";
    this.timer = null;
    this.isRunning = false;
  }

  static findDefaultTranscriptPath({ appDataDir = null, conversationId = null } = {}) {
    const baseDir = appDataDir || process.env.ANTIGRAVITY_APP_DATA_DIR || path.join(process.env.HOME || "", ".gemini/antigravity-cli");
    if (conversationId) {
      const p = path.join(baseDir, "brain", conversationId, ".system_generated/logs/transcript.jsonl");
      if (fs.existsSync(p)) return p;
    }

    const brainDir = path.join(baseDir, "brain");
    if (fs.existsSync(brainDir)) {
      try {
        const dirs = fs.readdirSync(brainDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => {
            const p = path.join(brainDir, d.name, ".system_generated/logs/transcript.jsonl");
            if (fs.existsSync(p)) {
              return { path: p, mtime: fs.statSync(p).mtimeMs };
            }
            return null;
          })
          .filter(Boolean)
          .sort((a, b) => b.mtime - a.mtime);

        if (dirs.length > 0) return dirs[0].path;
      } catch (_) {}
    }

    return null;
  }

  async start(filePath = null) {
    if (filePath) this.transcriptPath = filePath;
    if (!this.transcriptPath) {
      this.transcriptPath = TranscriptTailDaemon.findDefaultTranscriptPath();
    }

    if (!this.transcriptPath || !fs.existsSync(this.transcriptPath)) {
      throw new Error(`Transcript file not found: ${this.transcriptPath}`);
    }

    const stats = fs.statSync(this.transcriptPath);
    this.lastByteOffset = Math.max(0, stats.size - 32768);
    this.remainder = "";
    this.isRunning = true;

    await this.readNewBytes();

    this.timer = setInterval(async () => {
      if (this.isRunning) {
        await this.readNewBytes();
      }
    }, this.pollIntervalMs);

    this.emit("started", { path: this.transcriptPath, offset: this.lastByteOffset });
    return this;
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.emit("stopped");
  }

  async readNewBytes() {
    if (!fs.existsSync(this.transcriptPath)) return [];
    try {
      const stats = fs.statSync(this.transcriptPath);
      if (stats.size <= this.lastByteOffset) {
        if (stats.size < this.lastByteOffset) {
          this.lastByteOffset = 0;
          this.remainder = "";
        }
        return [];
      }

      const bytesToRead = stats.size - this.lastByteOffset;
      const buffer = Buffer.alloc(bytesToRead);
      const fd = fs.openSync(this.transcriptPath, "r");
      fs.readSync(fd, buffer, 0, bytesToRead, this.lastByteOffset);
      fs.closeSync(fd);

      this.lastByteOffset = stats.size;
      const chunkStr = this.remainder + buffer.toString("utf8");
      const lines = chunkStr.split("\n");
      this.remainder = lines.pop() || "";

      const parsedEvents = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const json = JSON.parse(trimmed);
          parsedEvents.push(json);
          const ingestResult = this.facade.ingest(json);
          this.emit("step", ingestResult);
        } catch (_) {}
      }

      if (parsedEvents.length > 0 && this.shouldPush) {
        try {
          await this.facade.pushToDevServer({ port: this.port, host: this.host });
        } catch (_) {}
      }

      return parsedEvents;
    } catch (err) {
      this.emit("error", err);
      return [];
    }
  }
}
