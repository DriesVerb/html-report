#!/usr/bin/env node
/**
 * Asset-Aware Publisher for @html-report/core (publish-report.mjs)
 * Produces either a self-contained HTML file or a deterministic ZIP bundle
 * (`index.html` + `refs/`) when local relative assets exist.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReport, stripAuthoringMarkup } from "./build-report.mjs";
import { isDirectCliExecution } from "./env.mjs";
import { crc32, createZipBuffer } from "./lib/publish/zip-writer.mjs";
import { discoverReportAssets, inlineCdnAssets } from "./lib/publish/asset-discovery.mjs";
import { injectAssetResilience } from "./lib/publish/asset-resilience.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");

export {
  crc32,
  createZipBuffer,
  discoverReportAssets,
  inlineCdnAssets,
  injectAssetResilience
};

function slugifyTitle(str = "html-report") {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "html-report";
}

function ensurePublishedMeta(html) {
  let out = stripAuthoringMarkup(String(html));
  out = out.replace(/[ \t]*<!-- __html_report_live_reload_injected__ -->[\s\S]*?<script id="__html_report_live_reload__"[\s\S]*?<\/script>\s*/gi, "");
  if (!/<meta\s+name=["']html-report-published["']/i.test(out) && /<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, '  <meta name="html-report-published" content="true" />\n</head>');
  }
  return out;
}

/**
 * Publishes an html-report project or HTML file as either:
 * - A single self-contained `<slug>-published.html` (when asset-free)
 * - A deterministic `<slug>-published.zip` (`index.html` + `refs/...`) when local assets exist.
 */
export async function publishProject({
  project = null,
  projectDir = null,
  inputPath = null,
  outputPath = null,
  theme = null,
  inlineCdn = false,
  writeOutput = true,
  workspaceRoot = REPO_ROOT,
  fetchFn = globalThis.fetch
} = {}) {
  let resolvedProjectDir = projectDir ? path.resolve(projectDir) : null;
  if (!resolvedProjectDir && project) {
    resolvedProjectDir = path.resolve(workspaceRoot, "projects", project);
  }
  if (!resolvedProjectDir && inputPath) {
    resolvedProjectDir = path.dirname(path.resolve(inputPath));
  }
  if (!resolvedProjectDir || !fs.existsSync(resolvedProjectDir)) {
    throw new Error(`Project directory not found: ${resolvedProjectDir || "(unspecified)"}`);
  }

  let manifest = {};
  const manifestPath = path.join(resolvedProjectDir, "report.manifest.json");
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    } catch (_) {}
  }

  const slug = slugifyTitle(project || manifest.project || path.basename(resolvedProjectDir));
  const resolvedInput = inputPath ? path.resolve(inputPath) : null;
  let fragmentPath = null;
  if (resolvedInput && path.basename(resolvedInput).includes("fragment") && fs.existsSync(resolvedInput)) {
    fragmentPath = resolvedInput;
  } else if (manifest?.files?.fragment) {
    const cand = path.resolve(workspaceRoot, manifest.files.fragment);
    const localCand = path.resolve(resolvedProjectDir, path.basename(manifest.files.fragment));
    if (fs.existsSync(cand)) fragmentPath = cand;
    else if (fs.existsSync(localCand)) fragmentPath = localCand;
  } else if (fs.existsSync(path.join(resolvedProjectDir, "fragment.html"))) {
    fragmentPath = path.join(resolvedProjectDir, "fragment.html");
  }

  let html = "";
  let title = manifest.title || slug;
  let mode = manifest.mode || null;
  let resolvedTheme = theme || manifest.theme || "light";

  if (fragmentPath && fs.existsSync(fragmentPath)) {
    const fragmentContent = fs.readFileSync(fragmentPath, "utf-8");
    const built = buildReport({
      title,
      content: fragmentContent,
      project: slug,
      contentPath: path.relative(workspaceRoot, fragmentPath).replace(/\\/g, "/"),
      mode,
      theme: resolvedTheme,
      customTheme: manifest.customTheme || null,
      pwa: Boolean(manifest.pwa),
      favicon: manifest.favicon || "📊",
      addons: Array.isArray(manifest.activeAddons) ? manifest.activeAddons : [],
      editable: false,
      ai: false,
      published: true,
      workspaceRoot
    });
    html = built.html;
    mode = built.mode;
    resolvedTheme = built.theme;
  } else {
    const htmlCandidate =
      (resolvedInput && fs.existsSync(resolvedInput) && resolvedInput) ||
      (fs.existsSync(path.join(resolvedProjectDir, "index.html")) && path.join(resolvedProjectDir, "index.html")) ||
      null;
    if (!htmlCandidate) {
      throw new Error(`No fragment.html or entry HTML found in ${resolvedProjectDir}`);
    }
    html = ensurePublishedMeta(fs.readFileSync(htmlCandidate, "utf-8"));
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1].trim()) title = titleMatch[1].trim();
  }

  if (inlineCdn) {
    html = await inlineCdnAssets(html, { fetchFn });
  }

  const discovery = discoverReportAssets(resolvedProjectDir, html);
  let kind = "html";
  let filename = `${slug}-published.html`;
  let buffer;

  if (discovery.isAssetBased) {
    kind = "zip";
    filename = `${slug}-published.zip`;
    const resilientHtml = injectAssetResilience(html, {
      assets: discovery.assets,
      projectDir: resolvedProjectDir
    });
    const zipEntries = [
      { name: "index.html", data: Buffer.from(resilientHtml, "utf-8") },
      ...discovery.assets.map((asset) => ({
        name: asset.relPath,
        data: fs.readFileSync(asset.diskPath)
      }))
    ];
    buffer = createZipBuffer(zipEntries);
    html = resilientHtml;
  } else {
    buffer = Buffer.from(html, "utf-8");
  }

  let writtenPath = null;
  if (writeOutput) {
    const targetPath = outputPath
      ? path.resolve(outputPath)
      : path.join(resolvedProjectDir, filename);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, buffer);
    writtenPath = targetPath;
  }

  return {
    ok: true,
    slug,
    title,
    mode,
    theme: resolvedTheme,
    kind,
    filename,
    outputPath: writtenPath,
    isAssetBased: discovery.isAssetBased,
    assets: discovery.assets.map((a) => ({ relPath: a.relPath, size: a.size })),
    missingReferences: discovery.missingReferences,
    byteLength: buffer.length,
    buffer,
    html
  };
}

export function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    project: null,
    dir: null,
    input: null,
    output: null,
    theme: null,
    inlineCdn: false,
    json: false,
    help: false
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === "--project" || arg === "-p") && args[i + 1]) opts.project = args[++i];
    else if ((arg === "--dir" || arg === "-d") && args[i + 1]) opts.dir = args[++i];
    else if ((arg === "--input" || arg === "-i") && args[i + 1]) opts.input = args[++i];
    else if ((arg === "--output" || arg === "-o") && args[i + 1]) opts.output = args[++i];
    else if ((arg === "--theme" || arg === "-t") && args[i + 1]) opts.theme = args[++i];
    else if (arg === "--inline-cdn") opts.inlineCdn = true;
    else if (arg === "--json") opts.json = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
  }
  return opts;
}

if (isDirectCliExecution(process.argv[1], import.meta.url)) {
  const opts = parseArgs(process.argv);
  if (opts.help || (!opts.project && !opts.dir && !opts.input)) {
    console.log(`
html-report Asset-Aware Publisher

Usage:
  node skills/html-report/scripts/publish-report.mjs --project <slug> [options]
  node skills/html-report/scripts/publish-report.mjs --dir <project-dir> [options]

Options:
  -p, --project <slug>   Publish projects/<slug>/
  -d, --dir <path>       Explicit project directory path
  -i, --input <path>     Explicit fragment.html or entry HTML path
  -o, --output <path>    Output .html or .zip file path
  -t, --theme <name>     Override DaisyUI theme
      --inline-cdn       Fetch & inline external CDN stylesheets/scripts
      --json             Emit machine-readable JSON summary
  -h, --help             Show this help message
    `.trim());
    process.exit(opts.help ? 0 : 1);
  }

  publishProject({
    project: opts.project,
    projectDir: opts.dir,
    inputPath: opts.input,
    outputPath: opts.output,
    theme: opts.theme,
    inlineCdn: opts.inlineCdn
  })
    .then((result) => {
      if (opts.json) {
        const { buffer: _buf, html: _html, ...summary } = result;
        console.log(JSON.stringify(summary, null, 2));
      } else {
        console.log(
          `✅ Published (${result.kind.toUpperCase()}): ${result.outputPath} (${result.byteLength} bytes, assets=${result.assets.length})`
        );
      }
    })
    .catch((err) => {
      console.error(`❌ Publish failed: ${err.message}`);
      process.exit(1);
    });
}
