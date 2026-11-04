#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DatastarBridge, escapeHtml } from "./datastar-sse.mjs";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".csv": "text/csv; charset=utf-8",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

function findActiveChangeDir(startDir) {
  let curr = startDir;
  while (curr && curr !== path.dirname(curr)) {
    const changesDir = path.join(curr, "openspec", "changes");
    if (fs.existsSync(changesDir)) {
      const entries = fs.readdirSync(changesDir, { withFileTypes: true });
      const active = entries.filter((e) => e.isDirectory() && e.name !== "archive");
      if (active.length > 0) {
        active.sort((a, b) => {
          const aMtime = fs.statSync(path.join(changesDir, a.name)).mtimeMs;
          const bMtime = fs.statSync(path.join(changesDir, b.name)).mtimeMs;
          return bMtime - aMtime;
        });
        return path.join(changesDir, active[0].name);
      }

      // Fallback: If all changes are archived, resolve from the most recent archive
      const archiveDir = path.join(changesDir, "archive");
      if (fs.existsSync(archiveDir)) {
        const archivedEntries = fs.readdirSync(archiveDir, { withFileTypes: true });
        const archives = archivedEntries.filter((e) => e.isDirectory());
        if (archives.length > 0) {
          archives.sort((a, b) => {
            const aMtime = fs.statSync(path.join(archiveDir, a.name)).mtimeMs;
            const bMtime = fs.statSync(path.join(archiveDir, b.name)).mtimeMs;
            return bMtime - aMtime;
          });
          return path.join(archiveDir, archives[0].name);
        }
      }
    }
    curr = path.dirname(curr);
  }
  return null;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let filePath = null;
  let port = 3000;
  let autoOpen = true;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--port" || args[i] === "-p") && args[i + 1]) {
      port = parseInt(args[++i], 10) || 3000;
    } else if (args[i] === "--no-open") {
      autoOpen = false;
    } else if (!args[i].startsWith("--") && !filePath) {
      filePath = args[i];
    }
  }

  return { filePath, port, autoOpen };
}

function openBrowser(url) {
  const platform = process.platform;
  let cmd = "";
  if (platform === "darwin") {
    cmd = `open "${url}"`;
  } else if (platform === "win32") {
    cmd = `start "" "${url}"`;
  } else {
    // Linux / BSD: suppress stderr to avoid noisy terminal warnings on headless
    cmd = `(xdg-open "${url}" || sensible-browser "${url}" || x-www-browser "${url}") >/dev/null 2>&1`;
  }

  exec(cmd, (err) => {
    if (err && process.env.DEBUG) {
      console.warn(`[html-report] Browser open command exited with: ${err.message}`);
    }
  });
}

function injectLiveReload(html) {
  const snippet = `
  <!-- __html_report_live_reload_injected__ -->
  <script id="__html_report_live_reload__">
    (() => {
      let isReloading = false;
      const es = new EventSource("/__live_reload__");
      es.addEventListener("reload", () => {
        if (isReloading) return;
        isReloading = true;
        console.log("[html-report] File updated on disk. Reloading tab in place...");
        window.location.reload();
      });
      window.addEventListener("beforeunload", () => {
        try { es.close(); } catch (_) {}
      });
    })();
  </script>
`;

  if (html.includes("</body>")) {
    return html.replace("</body>", `${snippet}\n</body>`);
  }
  if (html.includes("</html>")) {
    return html.replace("</html>", `${snippet}\n</html>`);
  }
  return html + snippet;
}

function detectReportMode(htmlContent) {
  if (!htmlContent || typeof htmlContent !== "string") return "report";
  const match = htmlContent.match(/<html[^>]*data-report-mode=["']([^"']+)["']/i);
  return match ? match[1].toLowerCase() : "report";
}

async function startServer(targetFilePath, initialPort, autoOpen) {
  const resolvedPath = path.resolve(process.cwd(), targetFilePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: Report file not found at ${resolvedPath}`);
    process.exit(1);
  }

  const rootDir = path.dirname(resolvedPath);
  const targetFileName = path.basename(resolvedPath);
  const sseClients = new Set();
  const datastarClients = new Set();
  let serverPort = initialPort;

  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://localhost:${serverPort}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // 1a. Datastar Real-Time SSE Stream Endpoint
    if (pathname === "/__datastar_stream__") {
      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          let ssePayload = body;
          try {
            const parsed = JSON.parse(body);
            if (parsed.selector && parsed.html) {
              ssePayload = DatastarBridge.formatFragment(parsed);
            } else if (parsed.signals) {
              ssePayload = DatastarBridge.formatSignals(parsed.signals);
            }
          } catch (_) {}

          for (const client of datastarClients) {
            try { client.write(ssePayload); } catch (_) { datastarClients.delete(client); }
          }
          res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
          res.end(JSON.stringify({ ok: true, listeners: datastarClients.size }));
        });
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*"
      });
      res.write("event: connected\ndata: {}\n\n");

      datastarClients.add(res);
      console.log(`[html-report] Datastar stream connected (active listeners: ${datastarClients.size})`);

      req.on("close", () => {
        datastarClients.delete(res);
        console.log(`[html-report] Datastar stream disconnected (remaining listeners: ${datastarClients.size})`);
      });
      return;
    }

    // 1b. SSE Live-Reload Endpoint
    if (pathname === "/__live_reload__") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*"
      });
      res.write("event: connected\ndata: {}\n\n");

      sseClients.add(res);
      const clientCount = sseClients.size;
      console.log(`[html-report] Browser tab connected (active tabs: ${clientCount})`);

      req.on("close", () => {
        sseClients.delete(res);
        console.log(`[html-report] Browser tab disconnected (remaining active tabs: ${sseClients.size})`);
      });
      return;
    }

    // 1c. Report Mode Query Endpoint
    if (pathname === "/__report_mode__") {
      let detectedMode = "report";
      try {
        const rawHtml = fs.readFileSync(resolvedPath, "utf-8");
        detectedMode = detectReportMode(rawHtml);
      } catch (_) {}
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store"
      });
      res.end(JSON.stringify({ mode: detectedMode, file: targetFileName }));
      return;
    }

    // 2. Serve main target report on root /
    if (pathname === "/" || pathname === `/${targetFileName}`) {
      try {
        const rawHtml = fs.readFileSync(resolvedPath, "utf-8");
        const currentMode = detectReportMode(rawHtml);
        const injectedHtml = injectLiveReload(rawHtml);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "X-Report-Mode": currentMode
        });
        res.end(injectedHtml);
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(`Internal Error reading report: ${err.message}`);
      }
      return;
    }

    // 3. Serve static relative files (e.g. CSVs, PDFs, images, Markdown artifacts)
    const sanitizedRelPath = pathname.replace(/^\/+/, "");
    let diskPath = path.resolve(rootDir, sanitizedRelPath);

    // Artifact Fallback Resolution for OpenSpec Markdown files
    if (!fs.existsSync(diskPath) || fs.statSync(diskPath).isDirectory()) {
      const activeChangeDir = findActiveChangeDir(rootDir);
      if (activeChangeDir) {
        let candidatePath = path.join(activeChangeDir, sanitizedRelPath);
        if (sanitizedRelPath === "specs" || sanitizedRelPath === "specs/") {
          const specsDir = path.join(activeChangeDir, "specs");
          if (fs.existsSync(specsDir)) {
            const specSubs = fs.readdirSync(specsDir, { withFileTypes: true });
            for (const sub of specSubs) {
              const candidate = path.join(specsDir, sub.name, "spec.md");
              if (fs.existsSync(candidate)) {
                candidatePath = candidate;
                break;
              }
            }
          }
        }
        if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
          diskPath = candidatePath;
        }
      }
    }

    // Security check: prevent directory traversal outside rootDir
    if (!diskPath.startsWith(rootDir)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("403 Forbidden");
      return;
    }

    if (fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
      const ext = path.extname(diskPath).toLowerCase();
      const isHtmlRequest = (req.headers.accept || "").includes("text/html");
      const isRawRequest = parsedUrl.searchParams.has("raw");

      // Serve Markdown with dedicated in-browser Showdown Viewer when requested as HTML
      if (ext === ".md" && isHtmlRequest && !isRawRequest) {
        try {
          const rawMd = fs.readFileSync(diskPath, "utf-8");
          const fileName = path.basename(diskPath);
          const previewHtml = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(fileName)} - OpenSpec Artifact</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/daisyui@4.12.14/dist/full.min.css" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/showdown@2.1.0/dist/showdown.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/lucide@0.460.0/dist/umd/lucide.min.js"></script>
</head>
<body class="bg-base-200 min-h-screen p-4 sm:p-8 font-sans">
  <div class="max-w-4xl mx-auto card bg-base-100 shadow-xl border border-base-300">
    <div class="card-body p-6 sm:p-10">
      <div class="flex items-center justify-between pb-4 border-b border-base-200 flex-wrap gap-2">
        <a href="/" class="btn btn-sm btn-ghost gap-1.5"><i data-lucide="arrow-left" class="w-4 h-4"></i> Back to Dashboard</a>
        <div class="flex items-center gap-2">
          <span class="badge badge-primary font-mono text-xs">${escapeHtml(fileName)}</span>
          <a href="${pathname}?raw=true" class="btn btn-xs btn-outline font-mono">Raw Markdown</a>
        </div>
      </div>
      <div id="markdown-body" class="prose prose-sm sm:prose max-w-none text-base-content mt-6"></div>
    </div>
  </div>
  <script>
    const markdownContent = ${JSON.stringify(rawMd)};
    const converter = new showdown.Converter({
      tables: true,
      tasklists: true,
      strikethrough: true,
      ghCodeBlocks: true,
      simplifiedAutoLink: true
    });
    document.getElementById("markdown-body").innerHTML = converter.makeHtml(markdownContent);
    if (window.lucide) window.lucide.createIcons();
  </script>
</body>
</html>`;
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache"
          });
          res.end(previewHtml);
          return;
        } catch (e) {
          // fallback to standard stream
        }
      }

      // Inject live-reload into any requested HTML file so all tabs reload on changes!
      if (ext === ".html") {
        try {
          const rawHtml = fs.readFileSync(diskPath, "utf-8");
          const currentMode = detectReportMode(rawHtml);
          const injectedHtml = injectLiveReload(rawHtml);
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "X-Report-Mode": currentMode
          });
          res.end(injectedHtml);
          return;
        } catch (err) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end(`Internal Error reading html file: ${err.message}`);
          return;
        }
      }

      const mime = MIME_TYPES[ext] || "application/octet-stream";
      res.writeHead(200, {
        "Content-Type": mime,
        "Cache-Control": "no-cache"
      });
      fs.createReadStream(diskPath).pipe(res);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end(`404 Not Found: ${pathname}`);
  });

  // Keep-alive heartbeat interval for SSE clients
  const heartbeat = setInterval(() => {
    for (const client of sseClients) {
      try {
        client.write(": ping\n\n");
      } catch (_) {
        sseClients.delete(client);
      }
    }
    for (const client of datastarClients) {
      try {
        client.write(": ping\n\n");
      } catch (_) {
        datastarClients.delete(client);
      }
    }
  }, 15000);

  // File watcher with debounce to handle editor double-saves across HTML files
  let debounceTimer = null;
  const mtimes = new Map();
  try {
    mtimes.set(resolvedPath, fs.statSync(resolvedPath).mtimeMs);
  } catch (_) {}

  const currentFeaturePath = path.resolve(rootDir, "current-feature.html");
  if (fs.existsSync(currentFeaturePath)) {
    try { mtimes.set(currentFeaturePath, fs.statSync(currentFeaturePath).mtimeMs); } catch (_) {}
  }

  const watchers = [];

  function broadcastReload(updatedFile) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      try {
        const currentMtime = fs.statSync(updatedFile).mtimeMs;
        if (currentMtime === mtimes.get(updatedFile)) return;
        mtimes.set(updatedFile, currentMtime);
      } catch (_) {
        return;
      }

      const activeCount = sseClients.size;
      const fileName = path.basename(updatedFile);
      const targetUrl = `http://localhost:${serverPort}/`;

      if (activeCount > 0) {
        console.log(`\n[html-report] File updated: ${fileName}`);
        console.log(`[html-report] -> Refreshing ${activeCount} active tab(s) in place without opening new tabs.`);
        for (const client of sseClients) {
          try {
            client.write("event: reload\ndata: {}\n\n");
          } catch (_) {
            sseClients.delete(client);
          }
        }
      } else {
        console.log(`\n[html-report] File updated: ${fileName}`);
        console.log(`[html-report] -> No active tabs detected. Reopening in browser: ${targetUrl}`);
        openBrowser(targetUrl);
      }
    }, 150);
  }

  try {
    const mainWatcher = fs.watch(resolvedPath, () => broadcastReload(resolvedPath));
    watchers.push(mainWatcher);
  } catch (_) {}

  // Watch current-feature.html specifically
  try {
    if (fs.existsSync(currentFeaturePath)) {
      const featureWatcher = fs.watch(currentFeaturePath, () => broadcastReload(currentFeaturePath));
      watchers.push(featureWatcher);
    }
  } catch (_) {}

  // Also watch directory for new/updated HTML files
  try {
    const dirWatcher = fs.watch(rootDir, (event, filename) => {
      if (filename && (filename === "current-feature.html" || filename === targetFileName)) {
        const full = path.resolve(rootDir, filename);
        broadcastReload(full);
      }
    });
    watchers.push(dirWatcher);
  } catch (_) {}

  // Handle port conflicts with auto-retry
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      serverPort++;
      server.listen(serverPort);
    } else {
      console.error("[html-report] Server error:", err);
      process.exit(1);
    }
  });

  return new Promise((resolve) => {
    server.listen(serverPort, () => {
      const serverUrl = `http://localhost:${serverPort}/`;
      let currentMode = "report";
      try {
        const raw = fs.readFileSync(resolvedPath, "utf-8");
        currentMode = detectReportMode(raw);
      } catch (_) {}

      if (process.env.NODE_ENV !== "test") {
        console.log(`\n======================================================`);
        console.log(` 🚀 html-report Live-Reload Dev Server`);
        console.log(` Serving: ${resolvedPath} [mode: ${currentMode}]`);
        console.log(` URL:     ${serverUrl}`);
        console.log(` Status:  Watching for updates...`);
        console.log(`\n  • When updated while tab is open: refreshes existing tab in place.`);
        console.log(`  • When updated while tab is closed: reopens automatically in a tab.`);
        console.log(`======================================================\n`);
      }

      if (autoOpen) {
        console.log(`[html-report] Auto-opening browser at ${serverUrl}...`);
        openBrowser(serverUrl);
      }

      resolve({
        server,
        serverPort,
        close: () => {
          clearInterval(heartbeat);
          for (const w of watchers) { try { w.close(); } catch (_) {} }
          for (const c of sseClients) { try { c.end(); } catch (_) {} }
          for (const c of datastarClients) { try { c.end(); } catch (_) {} }
          return new Promise((res) => server.close(res));
        }
      });
    });

    // Graceful shutdown
    const cleanup = () => {
      clearInterval(heartbeat);
      for (const w of watchers) { try { w.close(); } catch (_) {} }
      server.close(() => process.exit(0));
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  });
}

export { startServer, parseArgs, injectLiveReload, detectReportMode, MIME_TYPES };

const isMainModule = process.argv[1] && (
  process.argv[1].endsWith("serve-report.mjs") ||
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
);

if (isMainModule) {
  const { filePath, port, autoOpen } = parseArgs(process.argv);
  if (!filePath) {
    console.error("Usage: node serve-report.mjs <path-to-report.html> [--port <number>] [--no-open]");
    process.exit(1);
  }
  startServer(filePath, port, autoOpen);
}
