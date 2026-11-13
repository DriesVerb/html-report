import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import {
  isDirectCliExecution,
  resolveSkillPaths,
  probePorts,
  detectBrowserReadiness,
  AgentInferenceRouter,
  runPreflight
} from "../skills/html-report/scripts/preflight.mjs";
import {
  extractMainElement,
  buildReport,
  parseArgs as parseBuildArgs
} from "../skills/html-report/scripts/build-report.mjs";
import {
  scaffoldProject,
  generateProjectPackageJson
} from "../skills/html-report/scripts/scaffold-project.mjs";
import {
  startServer,
  parseArgs as parseServeArgs,
  findWorkspaceRoot
} from "../skills/html-report/scripts/serve-report.mjs";
import { generateCliCommand } from "../skills/html-report/scripts/domain-model.mjs";
import { HighlightCheck } from "../skills/html-report/playwright/harness/checks/cdns/highlight.mjs";
import {
  parseArgs as parseVerifyArgs
} from "../skills/html-report/playwright/verify-report.mjs";
import {
  launchBrowserWithFallback,
  runHarness
} from "../skills/html-report/playwright/harness/runner.mjs";

const require = createRequire(import.meta.url);
const {
  HTMLReportAgent,
  HTMLReportBoard
} = require("../skills/html-report/assets/report-runtime.js");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

describe("Experience Review Remediations (Phases 1-5)", () => {
  describe("Phase 1: Workspace Hygiene, Dedicated Ports (3031/3032), and Preflight", () => {
    it("1.1 gitignores projects/ and keeps projects/ untracked in git", () => {
      const gitignore = fs.readFileSync(path.join(ROOT_DIR, ".gitignore"), "utf8");
      assert.match(gitignore, /^projects\/$/m, ".gitignore must ignore projects/");
      assert.match(gitignore, /^\.board-state\.json$/m, ".gitignore must ignore .board-state.json");

      const trackedProjects = execFileSync("git", ["ls-files", "projects/"], {
        cwd: ROOT_DIR,
        encoding: "utf8"
      }).trim();
      assert.equal(trackedProjects, "", "No files inside projects/ should be tracked by git");
    });

    it("1.2 defaults Turnkey AI Bridge and server ports to 3031 (primary) and 3032 (fallback)", () => {
      const buildArgs = parseBuildArgs(["--content", "frag.html"]);
      assert.equal(buildArgs.aiPort, 3031);

      const serveArgs = parseServeArgs(["report.html"]);
      assert.equal(serveArgs.port, 3031);

      const aiCfg = HTMLReportAgent.getAiConfig();
      assert.equal(aiCfg.port, 3031);
      assert.equal(aiCfg.fallbackPort, 3032);
    });

    it("1.3 preflight.mjs probes ports 3031/3032, resolves skill paths, and inspects AI providers", async () => {
      const paths = resolveSkillPaths(ROOT_DIR);
      assert.equal(paths.mode, "repo-local");
      assert.equal(paths.buildScript, "skills/html-report/scripts/build-report.mjs");

      const ports = await probePorts(3031, 3032);
      assert.equal(ports.primaryPort, 3031);
      assert.equal(ports.fallbackPort, 3032);
      assert.equal(typeof ports.primaryAvailable, "boolean");

      const preflight = await runPreflight({ workspaceRoot: ROOT_DIR });
      assert.equal(preflight.ok, true);
      assert.ok(preflight.skillPaths);
      assert.ok(preflight.ports);
      assert.ok(preflight.browser);
      assert.ok(preflight.ai);
    });
  });

  describe("Phase 2: Assembly Boundary & Installation-Aware Scaffolding", () => {
    it("2.1 extractMainElement and buildReport preserve <main> id, classes, and reactive attributes", async () => {
      const fragment = `<main id="stone-form-board" class="custom-grid gap-6" x-data="stoneBoard()" x-init="initBoard()" data-signals="{filter: 'all'}" @keydown.window.escape="clearSelection()" aria-label="Stone Pokemon Board">
        <section id="overview"><h1 id="board-title">Stone / Form</h1></section>
      </main>`;

      const extracted = extractMainElement(fragment);
      assert.equal(extracted.hasMainWrapper, true);
      assert.equal(extracted.id, "stone-form-board");
      assert.ok(extracted.classes.includes("custom-grid"));
      const extraAttrsStr = Array.isArray(extracted.extraAttrs) ? extracted.extraAttrs.join(" ") : extracted.extraAttrs;
      assert.match(extraAttrsStr, /x-data="stoneBoard\(\)"/);
      assert.match(extraAttrsStr, /x-init="initBoard\(\)"/);
      assert.match(extraAttrsStr, /data-signals="\{filter: 'all'\}"/);
      assert.match(extraAttrsStr, /@keydown\.window\.escape="clearSelection\(\)"/);
      assert.match(extraAttrsStr, /aria-label="Stone Pokemon Board"/);

      const { html } = await buildReport({
        title: "Stone / Form",
        content: fragment,
        theme: "dracula"
      });

      assert.match(html, /<html[^>]*data-theme="dracula"/);
      assert.match(html, /<main id="stone-form-board" class="[^"]*custom-grid gap-6"[^>]*x-data="stoneBoard\(\)"/);
      assert.match(html, /x-init="initBoard\(\)"/);
      assert.match(html, /@keydown\.window\.escape="clearSelection\(\)"/);
      const mainBlockMatch = html.match(/<main\b[\s\S]*?<\/main>/i);
      assert.ok(mainBlockMatch, "Built HTML must contain <main>...</main>");
      assert.equal((mainBlockMatch[0].match(/<main\b/gi) || []).length, 1, "Must not nest a second <main> inside the shell <main>");
    });

    it("2.2 strips AI assistant dock when --no-ai-dock or --published is passed", async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "html-report-dock-"));
      try {
        const fragPath = path.join(tmpDir, "fragment.html");
        fs.writeFileSync(fragPath, `<main id="report-main"><h1 id="t">Title</h1></main>`, "utf8");

        const noDockOut = path.join(tmpDir, "no-dock.html");
        const { html: noDockHtml } = await buildReport({
          title: "Static Board",
          contentPath: fragPath,
          outputPath: noDockOut,
          aiDock: false
        });
        assert.doesNotMatch(noDockHtml, /<div id="agent-dock-container"/);
        assert.doesNotMatch(noDockHtml, /<dialog id="agent-reconnect-modal"/);

        const pubOut = path.join(tmpDir, "published.html");
        const { html: pubHtml } = await buildReport({
          title: "Published Board",
          contentPath: fragPath,
          outputPath: pubOut,
          published: true
        });
        assert.doesNotMatch(pubHtml, /<div id="agent-dock-container"/);
        assert.doesNotMatch(pubHtml, /<div id="settings-dropdown"/);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("2.3 scaffoldProject generates installation-aware commands and local package.json", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "html-report-scaffold-"));
      try {
        // Simulate an external workspace where skill is symlinked at .agents/skills/html-report
        const agentsSkillDir = path.join(tmpDir, ".agents", "skills");
        fs.mkdirSync(agentsSkillDir, { recursive: true });
        fs.symlinkSync(path.join(ROOT_DIR, "skills", "html-report"), path.join(agentsSkillDir, "html-report"));

        const res = scaffoldProject({
          topic: "Stone Form Test",
          theme: "dracula",
          aiPort: 3031,
          rootDir: tmpDir
        });

        assert.ok(fs.existsSync(res.packageJsonPath), "projects/<slug>/package.json must be created");
        const pkg = JSON.parse(fs.readFileSync(res.packageJsonPath, "utf8"));
        assert.match(pkg.scripts.build, /\.agents\/skills\/html-report\/scripts\/build-report\.mjs/);
        assert.match(pkg.scripts.build, /--theme dracula/);
        assert.match(pkg.scripts.serve, /--port 3031/);
        assert.match(pkg.scripts.verify, /\.agents\/skills\/html-report\/playwright\/verify-report\.mjs/);

        const agentsMd = fs.readFileSync(res.agentsMdPath, "utf8");
        assert.match(agentsMd, /\.agents\/skills\/html-report\/scripts\/build-report\.mjs/);
        assert.match(agentsMd, /npm --prefix projects\/stone-form-test run build/);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("Phase 3: Verification Runner & Browser Harness Fixes", () => {
    it("3.1 isDirectCliExecution resolves symlinked script paths to true", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "html-report-symlink-"));
      try {
        const realVerify = path.join(ROOT_DIR, "skills", "html-report", "playwright", "verify-report.mjs");
        const symlinkVerify = path.join(tmpDir, "verify-report-link.mjs");
        fs.symlinkSync(realVerify, symlinkVerify);

        const realUrl = `file://${realVerify}`;
        assert.equal(isDirectCliExecution(symlinkVerify, realUrl), true);

        // Also invoke --help through the symlink to confirm it does not silently exit without output
        const helpOut = execFileSync(process.execPath, [symlinkVerify, "--help"], {
          encoding: "utf8"
        });
        assert.match(helpOut, /Usage: node verify-report\.mjs/);
        assert.match(helpOut, /--url http:\/\/localhost:3031/);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("3.2 launchBrowserWithFallback retries with system Chrome executablePath when default launch fails", async () => {
      const calls = [];
      const fakeLauncher = {
        launch: async (opts) => {
          calls.push(opts);
          if (calls.length === 1) {
            throw new Error("Executable doesn't exist at ~/.cache/ms-playwright/chromium");
          }
          return { mockedBrowser: true, opts };
        }
      };

      const browser = await launchBrowserWithFallback(
        { executablePath: undefined, fallbackExecutablePath: "/usr/bin/google-chrome" },
        fakeLauncher
      );
      assert.equal(calls.length, 2);
      assert.equal(calls[1].executablePath, "/usr/bin/google-chrome");
      assert.equal(browser.mockedBrowser, true);
    });

    it("3.3 & 3.4 verifier respects --theme dracula in #agent-manifest and detects composite chart palette changes without borderColor", async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "html-report-dracula-verify-"));
      try {
        const frag = `<main id="stone-board" class="space-y-6">
          <section id="overview">
            <h1 id="main-heading">Stone / Form</h1>
            <h2 id="stats-heading">Rock Stats</h2>
            <div class="relative h-72 w-full min-w-0">
              <canvas id="rock-chart"></canvas>
            </div>
          </section>
          <script>
            window.addEventListener("load", () => {
              const ctx = document.getElementById("rock-chart");
              if (ctx && typeof Chart !== "undefined") {
                const pal = typeof resolveDaisyUIThemePalette === "function" ? resolveDaisyUIThemePalette() : null;
                const c1 = pal && pal.primary ? pal.primary.hex : "#ff79c6";
                const c2 = pal && pal.secondary ? pal.secondary.hex : "#bd93f9";
                new Chart(ctx, {
                  type: "bar",
                  data: {
                    labels: ["Geodude", "Onix"],
                    datasets: [{
                      label: "Defense",
                      data: [100, 160],
                      backgroundColor: [c1, c2]
                    }]
                  },
                  options: { responsive: true, maintainAspectRatio: false }
                });
              }
            });
          </script>
        </main>`;
        const outPath = path.join(tmpDir, "dracula-board.html");
        const { html } = await buildReport({
          title: "Stone / Form",
          content: frag,
          theme: "dracula"
        });
        fs.writeFileSync(outPath, html, "utf8");

        const result = await runHarness(outPath, {
          quick: true
        });
        assert.equal(result.success, true, `Expected dracula report with array backgroundColor chart to pass verification, failures: ${JSON.stringify(result.failures || [])}`);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("3.5 parseVerifyArgs supports --url <http://...> and --expected-theme", () => {
      const parsed = parseVerifyArgs(["--url", "http://localhost:3031", "--expected-theme", "dracula", "--quick"]);
      assert.equal(parsed.url, "http://localhost:3031");
      assert.equal(parsed.expectedTheme, "dracula");
      assert.equal(parsed.quick, true);
    });
  });

  describe("Phase 4 & 5: Agent-Agnostic Inference Router, Honest 503, and Turnkey Live Board", () => {
    it("4.1 AgentInferenceRouter supports custom HTML_REPORT_AI_CMD and reports honest unavailability when no provider exists", async () => {
      const cmdRes = await AgentInferenceRouter.dispatch(
        { prompt: "Summarize stone pokemon", persona: "analyst" },
        {
          env: {
            ...process.env,
            HTML_REPORT_AI_CMD: `${process.execPath} -e "process.stdout.write('Custom CLI synthesis result')"`
          }
        }
      );
      assert.equal(cmdRes.ok, true);
      assert.equal(cmdRes.provider, "custom-cmd");
      assert.equal(cmdRes.text, "Custom CLI synthesis result");

      const emptyRes = await AgentInferenceRouter.dispatch(
        { prompt: "Summarize stone pokemon" },
        {
          env: { PATH: "" }
        }
      );
      assert.equal(emptyRes.ok, false);
      assert.equal(emptyRes.code, "inference_unavailable");
      assert.match(emptyRes.error, /No AI inference provider is available/i);
    });

    it("4.1, 4.2, 5.1 serve-report.mjs serves /api/agent/preflight, /events SSE, /api/board/state, and returns HTTP 503 when AI is unavailable", async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "html-report-server-"));
      const reportPath = path.join(tmpDir, "board.html");
      fs.writeFileSync(
        reportPath,
        `<!DOCTYPE html><html data-theme="dracula"><head><title>Board</title></head><body><main id="board"><div id="live-board-status">Idle</div></main></body></html>`,
        "utf8"
      );

      // Find an ephemeral port
      const srvInstance = await startServer({
        file: reportPath,
        port: 0,
        autoOpen: false
      });
      const actualPort = srvInstance.server.address().port;
      const baseUrl = `http://127.0.0.1:${actualPort}`;

      try {
        // 1. /api/agent/preflight
        const preflightRes = await fetch(`${baseUrl}/api/agent/preflight`);
        assert.equal(preflightRes.status, 200);
        const preflightJson = await preflightRes.json();
        assert.equal(preflightJson.ok, true);
        assert.equal(preflightJson.bridge, "online");
        assert.ok(preflightJson.ai);

        // 2. /api/board/state GET -> empty initial state, POST -> persists state, cross-origin POST -> 403
        const initialBoardRes = await fetch(`${baseUrl}/api/board/state`);
        assert.equal(initialBoardRes.status, 200);
        const initialBoard = await initialBoardRes.json();
        assert.equal(initialBoard.ok, true);
        assert.equal(initialBoard.state.updatedAt, null);

        // Cross-origin rejection check
        const crossOriginRes = await fetch(`${baseUrl}/api/board/state`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "https://evil.example.com"
          },
          body: JSON.stringify({ brief: ["Geodude"] })
        });
        assert.equal(crossOriginRes.status, 403);

        // Invalid payload check
        const badPayloadRes = await fetch(`${baseUrl}/api/board/state`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(["not-an-object"])
        });
        assert.equal(badPayloadRes.status, 400);

        // Valid state save
        const saveRes = await fetch(`${baseUrl}/api/board/state`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selected: ["Geodude", "Onix"], notes: "Heavy mineral palette" })
        });
        assert.equal(saveRes.status, 200);
        const savedJson = await saveRes.json();
        assert.equal(savedJson.ok, true);
        assert.deepEqual(savedJson.state.selected, ["Geodude", "Onix"]);
        assert.ok(fs.existsSync(path.join(tmpDir, ".board-state.json")));

        // 3. GET /events SSE stream emits connected + board-state + datastar-merge-fragments
        const controller = new AbortController();
        const sseRes = await fetch(`${baseUrl}/events`, {
          headers: { Accept: "text/event-stream" },
          signal: controller.signal
        });
        assert.equal(sseRes.status, 200);
        assert.match(sseRes.headers.get("content-type") || "", /text\/event-stream/);
        const reader = sseRes.body.getReader();
        const { value } = await reader.read();
        const chunkText = new TextDecoder().decode(value);
        controller.abort();
        assert.match(chunkText, /event: connected/);
        assert.match(chunkText, /event: board-state/);
        assert.match(chunkText, /Geodude/);

        // 4. POST /api/agent/prompt with HTML_REPORT_AI_CMD override -> 200 real response
        const prevAiCmd = process.env.HTML_REPORT_AI_CMD;
        const prevPath = process.env.PATH;
        try {
          process.env.HTML_REPORT_AI_CMD = `${process.execPath} -e "process.stdout.write('Real provider response for Onix')"`;
          const okPromptRes = await fetch(`${baseUrl}/api/agent/prompt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: "Analyze Onix" })
          });
          assert.equal(okPromptRes.status, 200);
          const okPromptJson = await okPromptRes.json();
          assert.equal(okPromptJson.ok, true);
          assert.equal(okPromptJson.provider, "custom-cmd");
          assert.match(okPromptJson.result, /Real provider response for Onix/);

          // 5. POST /api/agent/prompt when no provider is available -> 503 Service Unavailable (no fabricated 14.2% prose)
          delete process.env.HTML_REPORT_AI_CMD;
          process.env.PATH = "";
          const unavailRes = await fetch(`${baseUrl}/api/agent/prompt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: "Analyze Onix" })
          });
          assert.equal(unavailRes.status, 503);
          const unavailJson = await unavailRes.json();
          assert.equal(unavailJson.ok, false);
          assert.equal(unavailJson.code, "inference_unavailable");
          assert.doesNotMatch(JSON.stringify(unavailJson), /14\.2% across observed cohorts/);
        } finally {
          if (prevAiCmd === undefined) delete process.env.HTML_REPORT_AI_CMD;
          else process.env.HTML_REPORT_AI_CMD = prevAiCmd;
          process.env.PATH = prevPath;
        }
      } finally {
        await srvInstance.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("5.2 HTMLReportAgent.registerContextProvider, setTransportAdapter, and HTMLReportBoard work cleanly", async () => {
      const unsub = HTMLReportAgent.registerContextProvider(() => ({
        selectedPokemon: ["Kabutops", "Aerodactyl"]
      }));

      let interceptedPayload = null;
      HTMLReportAgent.setTransportAdapter(async (payload) => {
        interceptedPayload = payload;
        return { ok: true, result: "Intercepted by custom transport adapter" };
      });

      try {
        const res = await HTMLReportAgent.sendPrompt("Generate design brief");
        assert.equal(res.ok, true);
        assert.equal(res.result, "Intercepted by custom transport adapter");
        assert.ok(interceptedPayload);
        assert.deepEqual(interceptedPayload.context.customContext.selectedPokemon, ["Kabutops", "Aerodactyl"]);
      } finally {
        unsub();
        HTMLReportAgent.setTransportAdapter(null);
      }

      assert.equal(typeof HTMLReportBoard.saveState, "function");
      assert.equal(typeof HTMLReportBoard.loadState, "function");
      assert.equal(typeof HTMLReportBoard.connectStream, "function");
      const streamRes = HTMLReportBoard.connectStream("/events");
      assert.equal(streamRes.ok, false);
      assert.equal(streamRes.unsupported, true);
    });
  });

  describe("Phase 6: Toolbar Dropdowns, Project Persistence, and Post-Mortem Bridge Fixes", () => {
    it("6.1 template-shell.html & create.html enforce deterministic .dropdown-open CSS and blur on close", () => {
      const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
      const shellHtml = fs.readFileSync(path.join(repoRoot, "skills/html-report/assets/template-shell.html"), "utf-8");
      const createHtml = fs.readFileSync(path.join(repoRoot, "skills/html-report/assets/create.html"), "utf-8");

      assert.match(shellHtml, /#toc-dropdown:not\(\.dropdown-open\) > \.dropdown-content/);
      assert.match(shellHtml, /#settings-dropdown:not\(\.dropdown-open\) > \.dropdown-content/);
      assert.match(shellHtml, /id="toc-dropdown-btn"[^>]*aria-haspopup="true"/);
      assert.match(shellHtml, /<option value="support">Support<\/option>/);

      assert.match(createHtml, /#toc-dropdown:not\(\.dropdown-open\) > \.dropdown-content/);
      assert.match(createHtml, /#navbar-projects-dropdown:not\(\.dropdown-open\) > \.dropdown-content/);
      assert.match(createHtml, /#studio-settings-dropdown:not\(\.dropdown-open\) > \.dropdown-content/);
      assert.match(createHtml, /#initial-theme-dropdown:not\(\.dropdown-open\) > \.dropdown-content/);
      assert.match(createHtml, /document\.activeElement\.blur\(\)/);
    });

    it("6.2 findWorkspaceRoot skips projects/<slug>/package.json and resolves workspace root", () => {
      const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "html-report-wsroot-"));
      try {
        fs.writeFileSync(path.join(tmpRoot, "package.json"), JSON.stringify({ name: "workspace-root" }));
        const projDir = path.join(tmpRoot, "projects", "my-board");
        fs.mkdirSync(projDir, { recursive: true });
        fs.writeFileSync(path.join(projDir, "package.json"), JSON.stringify({ name: "html-report-project-my-board" }));

        assert.equal(findWorkspaceRoot(projDir), tmpRoot);
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    it("6.3 build-report.mjs --project <slug> rebuilds without --content and domain-model defaults to projects/", () => {
      const cli = generateCliCommand({ title: "Latency Audit", target: "report" });
      assert.match(cli.buildCommand, /--project latency-audit/);
      assert.match(cli.buildCommand, /projects\/latency-audit\/fragment\.html/);

      const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "html-report-projbuild-"));
      try {
        scaffoldProject({
          project: "demo-support",
          title: "Support Guide",
          ai: true,
          aiPersona: "support",
          aiPurpose: "Answer setup questions from the guide.",
          workspaceRoot: tmpRoot,
          rootDir: tmpRoot
        });
        fs.writeFileSync(
          path.join(tmpRoot, "projects", "demo-support", "fragment.html"),
          '<main id="report-main"><section id="s1"><h1>Updated Guide</h1></section></main>',
          "utf-8"
        );
        const buildScript = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../skills/html-report/scripts/build-report.mjs");
        execFileSync(process.execPath, [buildScript, "--project", "demo-support"], {
          cwd: tmpRoot,
          encoding: "utf-8"
        });
        const rebuilt = fs.readFileSync(path.join(tmpRoot, "projects", "demo-support", "index.html"), "utf-8");
        assert.match(rebuilt, /Updated Guide/);
        assert.match(rebuilt, /<option value="support" selected>/i);
        assert.match(rebuilt, /Answer setup questions from the guide\./);
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    it("6.4 AgentInferenceRouter closes child stdin, reports auth/verify fields, and /api/agent routes through it", async () => {
      const status = AgentInferenceRouter.detectProviders({ env: { PATH: "" } });
      assert.equal(status.installed, false);
      assert.equal(status.authenticated, false);
      assert.equal(status.inferenceVerified, false);

      // Script that blocks until stdin EOF (would hang if child.stdin were left open)
      const stdinEofCmd = `${process.execPath} -e "let d=''; process.stdin.on('data', c => d+=c); process.stdin.on('end', () => process.stdout.write('EOF-OK'));"`;
      const res = await AgentInferenceRouter.dispatch(
        { prompt: "hi" },
        { env: { ...process.env, HTML_REPORT_AI_CMD: stdinEofCmd }, timeoutMs: 3000 }
      );
      assert.equal(res.ok, true);
      assert.equal(res.text, "EOF-OK");

      // Verify /api/agent uses AgentInferenceRouter instead of hardcoded agy
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "html-report-api-agent-"));
      const reportPath = path.join(tmpDir, "board.html");
      fs.writeFileSync(reportPath, "<!DOCTYPE html><html><head><title>Test</title></head><body><main></main></body></html>", "utf-8");
      const srv = await startServer({ file: reportPath, port: 0, autoOpen: false });
      const baseUrl = `http://127.0.0.1:${srv.server.address().port}`;
      const prevCmd = process.env.HTML_REPORT_AI_CMD;
      try {
        process.env.HTML_REPORT_AI_CMD = `${process.execPath} -e "process.stdout.write('Routed via AgentInferenceRouter')"`;
        const agentRes = await fetch(`${baseUrl}/api/agent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: "Check status", persona: "support" })
        });
        assert.equal(agentRes.status, 200);
        const json = await agentRes.json();
        assert.equal(json.ok, true);
        assert.equal(json.persona, "support");
        assert.equal(json.result, "Routed via AgentInferenceRouter");
      } finally {
        if (prevCmd === undefined) delete process.env.HTML_REPORT_AI_CMD;
        else process.env.HTML_REPORT_AI_CMD = prevCmd;
        await srv.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("6.5 POST /api/board/state broadcasts board-state SSE frame to second-tab listeners", async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "html-report-sse-sync-"));
      const reportPath = path.join(tmpDir, "board.html");
      fs.writeFileSync(reportPath, "<!DOCTYPE html><html><head><title>Sync</title></head><body><main><div id='live-board-status'></div></main></body></html>", "utf-8");
      const srv = await startServer({ file: reportPath, port: 0, autoOpen: false });
      const baseUrl = `http://127.0.0.1:${srv.server.address().port}`;
      const controller = new AbortController();
      try {
        const sseRes = await fetch(`${baseUrl}/events`, {
          headers: { Accept: "text/event-stream" },
          signal: controller.signal
        });
        const reader = sseRes.body.getReader();
        const decoder = new TextDecoder();
        await reader.read(); // consume initial connected + board-state frame

        const postRes = await fetch(`${baseUrl}/api/board/state`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checklist: ["step-1", "step-2"] })
        });
        assert.equal(postRes.status, 200);

        const nextChunk = await reader.read();
        const text = decoder.decode(nextChunk.value);
        assert.match(text, /event: board-state/);
        assert.match(text, /step-2/);
      } finally {
        controller.abort();
        await srv.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("6.6 HighlightCheck passes on valid Bash code blocks without .hljs-keyword", async () => {
      const check = new HighlightCheck();
      const fakePage = {
        evaluate: async () => ({
          hasCode: true,
          codeBlockCount: 1,
          hasTsCode: false,
          tsHighlighted: false,
          hasKtCode: false,
          ktHighlighted: false,
          totalKeywordCount: 0,
          totalTokenCount: 2,
          highlightedBlockCount: 1
        })
      };
      const res = await check.run({ page: fakePage, options: {} });
      assert.equal(res.status, "passed");
      assert.equal(res.errors.length, 0);
    });
  });
});
