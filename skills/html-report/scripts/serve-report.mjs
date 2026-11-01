#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";

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
  ".txt": "text/plain; charset=utf-8"
};

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

async function startServer(targetFilePath, initialPort, autoOpen) {
  const resolvedPath = path.resolve(process.cwd(), targetFilePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: Report file not found at ${resolvedPath}`);
    process.exit(1);
  }

  const rootDir = path.dirname(resolvedPath);
  const targetFileName = path.basename(resolvedPath);
  const sseClients = new Set();
  let serverPort = initialPort;

  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://localhost:${serverPort}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // 1. SSE Live-Reload Endpoint
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

    // 2. Serve main target report on root /
    if (pathname === "/" || pathname === `/${targetFileName}`) {
      try {
        const rawHtml = fs.readFileSync(resolvedPath, "utf-8");
        const injectedHtml = injectLiveReload(rawHtml);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate"
        });
        res.end(injectedHtml);
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(`Internal Error reading report: ${err.message}`);
      }
      return;
    }

    // 3. Serve static relative files (e.g. CSVs, PDFs, images)
    const sanitizedRelPath = pathname.replace(/^\/+/, "");
    const diskPath = path.resolve(rootDir, sanitizedRelPath);

    // Security check: prevent directory traversal outside rootDir
    if (!diskPath.startsWith(rootDir)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("403 Forbidden");
      return;
    }

    if (fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
      const ext = path.extname(diskPath).toLowerCase();
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
  }, 15000);

  // File watcher with debounce to handle editor double-saves
  let debounceTimer = null;
  let lastMtime = 0;
  try {
    lastMtime = fs.statSync(resolvedPath).mtimeMs;
  } catch (_) {}

  const watcher = fs.watch(resolvedPath, () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      try {
        const currentMtime = fs.statSync(resolvedPath).mtimeMs;
        if (currentMtime === lastMtime) return;
        lastMtime = currentMtime;
      } catch (_) {
        return;
      }

      const activeCount = sseClients.size;
      const targetUrl = `http://localhost:${serverPort}/`;

      if (activeCount > 0) {
        // Tab is ALREADY open: broadcast reload in place (do NOT start a new tab)
        console.log(`\n[html-report] File updated: ${targetFileName}`);
        console.log(`[html-report] -> Refreshing ${activeCount} active tab(s) in place without opening new tabs.`);
        for (const client of sseClients) {
          try {
            client.write("event: reload\ndata: {}\n\n");
          } catch (_) {
            sseClients.delete(client);
          }
        }
      } else {
        // Tab is NOT open: reopen in browser
        console.log(`\n[html-report] File updated: ${targetFileName}`);
        console.log(`[html-report] -> No active tabs detected. Reopening in browser: ${targetUrl}`);
        openBrowser(targetUrl);
      }
    }, 150);
  });

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

  server.listen(serverPort, () => {
    const serverUrl = `http://localhost:${serverPort}/`;
    console.log(`\n======================================================`);
    console.log(` 🚀 html-report Live-Reload Dev Server`);
    console.log(` Serving: ${resolvedPath}`);
    console.log(` URL:     ${serverUrl}`);
    console.log(` Status:  Watching for updates...`);
    console.log(`\n  • When updated while tab is open: refreshes existing tab in place.`);
    console.log(`  • When updated while tab is closed: reopens automatically in a tab.`);
    console.log(`======================================================\n`);

    if (autoOpen) {
      console.log(`[html-report] Auto-opening browser at ${serverUrl}...`);
      openBrowser(serverUrl);
    }
  });

  // Graceful shutdown
  const cleanup = () => {
    clearInterval(heartbeat);
    try { watcher.close(); } catch (_) {}
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

const { filePath, port, autoOpen } = parseArgs(process.argv);
if (!filePath) {
  console.error("Usage: node serve-report.mjs <path-to-report.html> [--port <number>] [--no-open]");
  process.exit(1);
}

startServer(filePath, port, autoOpen);
