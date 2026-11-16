#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  generatePwaAssets,
  injectPwaIntoHtml,
  deriveShortName,
  DEFAULT_PWA_CONFIG
} from "./pwa-builder.mjs";

/**
 * skills/html-report/scripts/generate-pwa.mjs
 *
 * Standalone CLI tool to transform ANY existing HTML report into an instant
 * Progressive Web App (PWA).
 *
 * Usage:
 *   node generate-pwa.mjs <report.html> [options]
 */

export function parseCliArgs(argv) {
  const args = argv.slice(2);
  const options = {
    inputFile: null,
    outputFile: null,
    outputDir: null,
    title: null,
    shortName: null,
    themeColor: DEFAULT_PWA_CONFIG.themeColor,
    backgroundColor: DEFAULT_PWA_CONFIG.backgroundColor,
    emoji: "📊",
    dryRun: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if ((arg === "--title" || arg === "-t") && args[i + 1]) {
      options.title = args[++i];
    } else if ((arg === "--short-name" || arg === "-s") && args[i + 1]) {
      options.shortName = args[++i];
    } else if ((arg === "--theme-color" || arg === "-c") && args[i + 1]) {
      options.themeColor = args[++i];
    } else if ((arg === "--bg-color" || arg === "-b") && args[i + 1]) {
      options.backgroundColor = args[++i];
    } else if ((arg === "--emoji" || arg === "-e") && args[i + 1]) {
      options.emoji = args[++i];
    } else if ((arg === "--output-dir" || arg === "-o") && args[i + 1]) {
      options.outputDir = args[++i];
    } else if (arg === "--output-file" && args[i + 1]) {
      options.outputFile = args[++i];
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (!arg.startsWith("--") && !options.inputFile) {
      options.inputFile = arg;
    }
  }

  return options;
}

export function showHelp() {
  console.log(`
html-report Instant PWA Generator (generate-pwa.mjs)

Converts any existing HTML report into an installable Progressive Web App (PWA)
with an offline Service Worker, W3C Web App Manifest, and application icons.

Usage:
  node generate-pwa.mjs <path-to-report.html> [options]

Options:
  -t, --title <name>       App name (defaults to <title> in HTML)
  -s, --short-name <short> Short name for homescreen/app launcher
  -c, --theme-color <hex>  Theme color for window header/status bar (default: #2563eb)
  -b, --bg-color <hex>     Splash screen background color (default: #ffffff)
  -e, --emoji <emoji>      Icon emoji glyph (default: extracted from favicon or 📊)
  -o, --output-dir <dir>   Target directory for assets (defaults to report directory)
      --output-file <file> Optional destination path for updated HTML
      --dry-run            Simulate asset generation without writing to disk
  -h, --help               Show this help message

Examples:
  # Turn existing report into a PWA in-place:
  node skills/html-report/scripts/generate-pwa.mjs ./my-report.html

  # Custom title and branding:
  node skills/html-report/scripts/generate-pwa.mjs ./my-report.html \\
    --title "Field Inspection Dashboard" \\
    --short-name "FieldOps" \\
    --theme-color "#10b981" \\
    --emoji "🔬"
`);
}

/**
 * Extracts metadata from existing HTML string.
 */
export function extractHtmlMetadata(html = "") {
  let title = "HTML Report";
  let emoji = "📊";

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].trim();
  } else {
    const navTitleMatch = html.match(/id=["']navbar-report-title["'][^>]*>([\s\S]*?)<\/span>/i);
    if (navTitleMatch && navTitleMatch[1]) {
      title = navTitleMatch[1].replace(/<[^>]+>/g, "").trim();
    }
  }

  // Extract favicon emoji if SVG data URI present
  const faviconMatch = html.match(/<text[^>]*font-size=["'][^"']*["'][^>]*>([^<]+)<\/text>/i);
  if (faviconMatch && faviconMatch[1]) {
    emoji = faviconMatch[1].trim();
  }

  return { title, emoji };
}

/**
 * Programmatic conversion function.
 */
export function convertReportToPwa({
  reportPath,
  outputDir = null,
  outputFile = null,
  title = null,
  shortName = null,
  themeColor = DEFAULT_PWA_CONFIG.themeColor,
  backgroundColor = DEFAULT_PWA_CONFIG.backgroundColor,
  emoji = null,
  dryRun = false
} = {}) {
  const resolvedReportPath = path.resolve(process.cwd(), reportPath);
  if (!fs.existsSync(resolvedReportPath)) {
    throw new Error(`Report file not found: ${resolvedReportPath}`);
  }

  const rawHtml = fs.readFileSync(resolvedReportPath, "utf-8");
  const extracted = extractHtmlMetadata(rawHtml);

  const finalTitle = title || extracted.title || "HTML Report";
  const finalEmoji = emoji || extracted.emoji || "📊";
  const finalShortName = shortName || deriveShortName(finalTitle);

  const finalOutputDir = outputDir
    ? path.resolve(process.cwd(), outputDir)
    : path.dirname(resolvedReportPath);

  const reportFileName = path.basename(outputFile || resolvedReportPath);

  const assets = generatePwaAssets({
    outputDir: finalOutputDir,
    reportFileName,
    title: finalTitle,
    shortName: finalShortName,
    themeColor,
    backgroundColor,
    emoji: finalEmoji,
    writeFiles: !dryRun
  });

  const updatedHtml = injectPwaIntoHtml(rawHtml, {
    manifestHref: "manifest.webmanifest",
    themeColor,
    iconHref: "icon.svg",
    title: finalTitle,
    swHref: "./sw.js"
  });

  const destinationFile = outputFile
    ? path.resolve(process.cwd(), outputFile)
    : resolvedReportPath;

  if (!dryRun) {
    fs.writeFileSync(destinationFile, updatedHtml, "utf-8");
  }

  return {
    reportPath: destinationFile,
    outputDir: finalOutputDir,
    manifestPath: assets.manifestPath,
    swPath: assets.swPath,
    iconPath: assets.iconPath,
    title: finalTitle,
    shortName: finalShortName,
    themeColor,
    updatedHtml,
    assets
  };
}

// CLI entry point
const isDirectCli = process.argv[1] && (
  process.argv[1].endsWith("generate-pwa.mjs") ||
  import.meta.url === pathToFileURL(process.argv[1]).href
);

if (isDirectCli) {
  const options = parseCliArgs(process.argv);

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.inputFile) {
    console.error("Error: Please provide a path to an HTML report file.");
    showHelp();
    process.exit(1);
  }

  try {
    const result = convertReportToPwa({
      reportPath: options.inputFile,
      outputDir: options.outputDir,
      outputFile: options.outputFile,
      title: options.title,
      shortName: options.shortName,
      themeColor: options.themeColor,
      backgroundColor: options.backgroundColor,
      emoji: options.emoji,
      dryRun: options.dryRun
    });

    console.log(`\n🎉 [html-report] Instant PWA generated successfully!`);
    console.log(`   Report File: ${result.reportPath}`);
    console.log(`   Manifest:    ${result.manifestPath}`);
    console.log(`   Worker:      ${result.swPath}`);
    console.log(`   App Icon:    ${result.iconPath}`);
    console.log(`   App Title:   "${result.title}" (${result.shortName})`);
    console.log(`\n💡 To preview and test offline PWA installation:`);
    console.log(`   node skills/html-report/scripts/serve-report.mjs ${path.relative(process.cwd(), result.reportPath)} --port 3000\n`);
  } catch (err) {
    console.error(`\n❌ Error generating PWA: ${err.message}\n`);
    process.exit(1);
  }
}
