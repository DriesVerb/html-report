import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { startServer } from "../../../skills/html-report/scripts/serve-report.mjs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");

function rawHttpRequest(port, { method = "GET", path: reqPath = "/", headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, method, path: reqPath, headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString("utf-8")
      }));
    });
    req.on("error", reject);
    if (body !== null) req.write(body);
    req.end();
  });
}

describe("Studio Server Security & Stability Regressions", () => {
  let tmpRoot;
  let serverHandle;
  let port;
  let proxyServerHandle;
  let proxyPort;

  before(async () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "studio-sec-reg-"));
    fs.writeFileSync(path.join(tmpRoot, "package.json"), JSON.stringify({ name: "sec-test", version: "1.0.0" }));
    fs.writeFileSync(path.join(tmpRoot, ".env"), "SECRET_KEY=do-not-leak\n");
    fs.mkdirSync(path.join(tmpRoot, ".git"), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, ".git", "HEAD"), "ref: refs/heads/main\n");
    fs.writeFileSync(path.join(tmpRoot, "evil.md"), "# Note\n\n</script><script>window.__xss=1</script>\n");
    fs.writeFileSync(
      path.join(tmpRoot, "index.html"),
      "<!doctype html><html><head><title>Root Report</title></head><body><main id=\"report-main\"><h1>Root</h1></main></body></html>"
    );

    fs.mkdirSync(path.join(tmpRoot, "projects", "victim"), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, "projects", "victim", "index.html"), "<html><title>Victim</title><body>keep me</body></html>");

    process.env.NODE_ENV = "test";
    serverHandle = await startServer(path.join(tmpRoot, "index.html"), 0, false);
    port = serverHandle.server.address().port;

    proxyServerHandle = await startServer({
      filePath: path.join(tmpRoot, "index.html"),
      port: 0,
      autoOpen: false,
      feedProxies: [{ prefix: "/proxy/api", target: "http://127.0.0.1:9" }]
    });
    proxyPort = proxyServerHandle.server.address().port;
  });

  after(async () => {
    if (serverHandle) await serverHandle.close();
    if (proxyServerHandle) await proxyServerHandle.close();
    if (tmpRoot && fs.existsSync(tmpRoot)) fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("H2: handles malformed URL percent-encoding with 400 without crashing server", async () => {
    const bad = await rawHttpRequest(port, { path: "/%E0%A4%A" });
    assert.equal(bad.status, 400);

    const alive = await rawHttpRequest(port, { path: "/index.html" });
    assert.equal(alive.status, 200);
  });

  it("H3: blocks access to dotfiles (.env, .git/HEAD) even when rootDir === workspaceRoot", async () => {
    const envRes = await rawHttpRequest(port, { path: "/.env" });
    assert.equal(envRes.status, 404);
    assert.ok(!envRes.body.includes("SECRET_KEY"));

    const gitRes = await rawHttpRequest(port, { path: "/.git/HEAD" });
    assert.equal(gitRes.status, 404);
    assert.ok(!gitRes.body.includes("refs/heads/main"));
  });

  it("H4: escapes closing script tags and sanitizes rendered Markdown preview", async () => {
    const res = await rawHttpRequest(port, {
      path: "/evil.md",
      headers: { Accept: "text/html" }
    });
    assert.equal(res.status, 200);
    assert.ok(!res.body.includes("</script><script>window.__xss=1</script>"), "Raw </script> breakout must be escaped");
    assert.ok(res.body.includes(`<\\/script>`));
  });

  it("C3: blocks cross-origin & Origin:null mutating/delete requests and removes wildcard CORS", async () => {
    const victimHtml = path.join(tmpRoot, "projects", "victim", "index.html");

    for (const badOrigin of ["https://evil.example", "null"]) {
      const delRes = await rawHttpRequest(port, {
        method: "POST",
        path: "/api/projects/delete",
        headers: { Origin: badOrigin, "Content-Type": "application/json" },
        body: JSON.stringify({ path: "projects/victim" })
      });
      assert.equal(delRes.status, 403, `Expected 403 for Origin=${badOrigin} on /api/projects/delete`);
      assert.notEqual(delRes.headers["access-control-allow-origin"], "*");
      assert.equal(fs.existsSync(victimHtml), true, "Cross-origin delete must NOT delete projects/victim");

      const synthRes = await rawHttpRequest(port, {
        method: "POST",
        path: "/api/create/synthesize",
        headers: { Origin: badOrigin, "Content-Type": "application/json" },
        body: JSON.stringify({ target: "report" })
      });
      assert.equal(synthRes.status, 403);

      const csrfRes = await rawHttpRequest(port, {
        method: "GET",
        path: "/api/mcp/csrf-token",
        headers: { Origin: badOrigin }
      });
      assert.equal(csrfRes.status, 403, `Expected 403 for Origin=${badOrigin} on /api/mcp/csrf-token`);
    }
  });

  it("M2 & M3: --feed-proxy does not hang non-proxy routes and unsupported HTTP verbs return 405", async () => {
    const htmlRes = await rawHttpRequest(proxyPort, { path: "/index.html" });
    assert.equal(htmlRes.status, 200);
    assert.ok(htmlRes.body.includes("Root Report"));

    const methodRes = await rawHttpRequest(port, { method: "PUT", path: "/api/projects" });
    assert.equal(methodRes.status, 405);
  });

  it("M9: rejects oversized POST payloads (>2MB) with 413", async () => {
    const huge = "x".repeat(2 * 1024 * 1024 + 1024);
    const res = await rawHttpRequest(port, {
      method: "POST",
      path: "/api/create/synthesize",
      headers: { "Content-Type": "application/json" },
      body: huge
    });
    assert.equal(res.status, 413);
  });

  it("M8: edit-dock.html has valid CSS without double braces", () => {
    const dockHtml = fs.readFileSync(path.join(REPO_ROOT, "packages/studio/assets/edit-dock.html"), "utf-8");
    assert.ok(!dockHtml.includes("#edit-style-offline-actions.hidden { {"));
  });
});
