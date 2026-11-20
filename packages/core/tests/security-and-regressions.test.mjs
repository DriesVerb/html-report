import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildReport } from "../scripts/build-report.mjs";
import { fetchFeedSnapshotSync, resolveMermaidIncludes } from "../scripts/lib/build/fragment-sanitizer.mjs";
import { parseArgs as parseHarnessArgs } from "../scripts/lib/harness/cli.mjs";
import { runLifecycle } from "../scripts/harness.mjs";
import { publishProject } from "../scripts/publish-report.mjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const runtime = require("../assets/report-runtime.js");

describe("Core Security & Functional Regressions", () => {
  const tmpDirs = [];
  const makeTmp = (prefix = "core-sec-reg-") => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(d);
    return d;
  };

  after(() => {
    for (const d of tmpDirs) {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  it("C1: fetchFeedSnapshotSync rejects non-http protocols and avoids shell execution", () => {
    const tmp = makeTmp("feed-inj-");
    const marker = path.join(tmp, "pwned");
    const payload = `https://127.0.0.1:9/$(touch ${marker})`;
    const res = fetchFeedSnapshotSync(payload);
    assert.equal(res, null);
    assert.equal(fs.existsSync(marker), false, "Shell command inside URL must never execute");
    assert.equal(fetchFeedSnapshotSync("file:///etc/passwd"), null);
  });

  it("C2: resolveMermaidIncludes blocks directory traversal and outside symlinks", () => {
    const tmp = makeTmp("mermaid-sec-");
    const ws = path.join(tmp, "ws");
    const outside = path.join(tmp, "secret.mmd");
    fs.mkdirSync(ws, { recursive: true });
    fs.writeFileSync(outside, "graph LR; Secret-->Leak", "utf-8");

    const fragPath = path.join(ws, "fragment.html");
    fs.writeFileSync(fragPath, "<p>ok</p>", "utf-8");

    assert.throws(
      () => resolveMermaidIncludes(`<!-- {{MERMAID:../secret.mmd}} -->`, { contentPath: fragPath, workspaceRoot: ws }),
      /Access denied/
    );
    assert.throws(
      () => resolveMermaidIncludes(`<div class="mermaid" data-mermaid-src="${outside}"></div>`, { contentPath: fragPath, workspaceRoot: ws }),
      /Access denied/
    );

    const linkPath = path.join(ws, "link.mmd");
    fs.symlinkSync(outside, linkPath);
    assert.throws(
      () => resolveMermaidIncludes(`<!-- {{MERMAID:./link.mmd}} -->`, { contentPath: fragPath, workspaceRoot: ws }),
      /Access denied/
    );
  });

  it("H4: buildReport escapes title, theme, feed-registry closing script tags, and fallback JSON", () => {
    const res = buildReport({
      title: `Audit</title><script>alert(1)</script>`,
      theme: `light" onload="alert(2)`,
      feeds: { notes: `</script><script>alert(3)</script>` },
      content: `<div data-public-feed="https://example.invalid/feed" data-signals="{}"></div>`,
      freezeFeeds: true,
      fetchSnapshot: () => ({ ok: true, msg: `"quoted" & <tag>` })
    });

    assert.ok(!res.html.includes(`<title>Audit</title><script>alert(1)</script>`));
    assert.ok(res.html.includes(`&lt;/title>&lt;script>alert(1)&lt;/script>`));
    assert.ok(!res.html.includes(`onload="alert(2)"`));
    assert.ok(!res.html.includes(`</script><script>alert(3)</script>`));
    assert.ok(res.html.includes(`&amp; &lt;tag>`));
  });

  it("M1: harness.mjs --pwa preserves report mode and runs lifecycle without INVALID_MODE", async () => {
    const tmp = makeTmp("harness-pwa-");
    const frag = path.join(tmp, "fragment.html");
    const out = path.join(tmp, "index.html");
    fs.writeFileSync(frag, `<main id="report-main"><h1 id="overview">Overview</h1><p>PWA test</p></main>`, "utf-8");

    const parsed = parseHarnessArgs([frag, "--output", out, "--pwa", "--fast"]);
    assert.equal(parsed.pwa, true);
    assert.equal(parsed.mode, null);

    const result = await runLifecycle({
      file: frag,
      output: out,
      mode: parsed.mode,
      pwa: parsed.pwa,
      verify: false,
      quick: true,
      fast: true
    });
    assert.equal(result.success, true, `Expected harness --pwa lifecycle to succeed, got: ${result.error}`);
    assert.ok(fs.existsSync(path.join(tmp, "manifest.webmanifest")));
    assert.ok(fs.existsSync(path.join(tmp, "sw.js")));
    assert.ok(fs.existsSync(path.join(tmp, "icon.svg")));
  });

  it("M7: publishProject preserves manifest.customTheme & pwa and client stripAuthoringElements removes all html-report-ai-* metas", async () => {
    const tmp = makeTmp("publish-theme-pwa-");
    const projectDir = path.join(tmp, "projects", "demo-pwa");
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, "fragment.html"), `<main id="report-main"><h1 id="h">Hello</h1></main>`, "utf-8");
    fs.writeFileSync(
      path.join(projectDir, "report.manifest.json"),
      JSON.stringify({
        title: "Demo PWA",
        mode: "report",
        theme: "my-custom",
        customTheme: { name: "my-custom", colors: { primary: "#2563eb" } },
        pwa: true
      }),
      "utf-8"
    );

    const pub = await publishProject({ project: "demo-pwa", workspaceRoot: tmp });
    const pubHtml = pub.html;
    assert.ok(pubHtml.includes('[data-theme="my-custom"]'), "Published HTML must preserve customTheme CSS");
    assert.ok(pubHtml.includes('href="manifest.webmanifest"'), "Published HTML must preserve manifest link for pwa projects");

    // Client stripAuthoringElements removes meta[name^="html-report-ai-"]
    const removed = [];
    const fakeDoc = {
      querySelectorAll: (sel) => {
        if (sel.includes('meta[name^="html-report-ai-"]')) {
          return [{ remove: () => removed.push("ai-meta") }];
        }
        return [];
      },
      querySelector: () => null
    };
    runtime.HTMLReportPublisher.stripAuthoringElements(fakeDoc);
    assert.ok(removed.includes("ai-meta"), "stripAuthoringElements must remove all html-report-ai-* meta tags");
  });

  it("H4: runtime registerCustomTheme rejects injection-style theme names", () => {
    assert.equal(runtime.registerCustomTheme(`evil" onclick="alert(1)`, ""), false);
    assert.equal(runtime.registerCustomTheme("valid_theme-1", "[data-theme=\"valid_theme-1\"] {}"), true);
  });
});
