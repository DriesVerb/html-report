# 📖 API & CLI Reference

This document provides a comprehensive reference for the command-line interfaces and programmatic APIs provided by `html-report`.

---

## 💻 CLI Commands

### 1. Unified FSM Harness (`harness.mjs`)

The recommended entrypoint for agent workflows. Coordinates validation, pre-flight auto-fixing, deterministic compilation, and multi-breakpoint verification.

```bash
node skills/html-report/scripts/harness.mjs run <fragment-path> [options]
```

#### Options:
- `--title <string>`: Sets the document `<title>` and sticky navbar title.
- `--caller <id>`: Activates Caller-Aware mode. Loads the caller's profile, uses 3-tier config precedence, routes to `./report-<caller>.html`, and persists runs in `.caller-requests/<caller>/runs/` with 10-run pruning.
- `--theme <name>`: Sets the initial DaisyUI theme (e.g. `light`, `dark`, `nord`, `synthwave`). Defaults to `light`.
- `--custom-theme <path>`: Injects a custom theme definition (`.json` or `.css`) via the OKLCH compiler.
- `--verify`: Runs Playwright 5-breakpoint verification and horizontal overflow detection.
- `--pdf`: Instructs Playwright to compile and verify a print-ready PDF version.
- `--live`: Enables Datastar.js ESM module and real-time SSE streaming mode.
- `--pwa`: Generates an instant Progressive Web App with companion `manifest.webmanifest`, `sw.js`, and `icon.svg`.
- `--offline`: Inlines all external CDN stylesheets and scripts for 100% air-gapped offline portability.

---

### 2. Deterministic Report Compiler (`build-report.mjs`)

The core assembly engine. Stitches semantic HTML fragments into the pre-bundled template shell in **<100ms**.

```bash
node skills/html-report/scripts/build-report.mjs [options]
```

#### Options:
- `--content <path>`: Path to the input HTML fragment file (required).
- `--output <path>`: Destination path for the compiled report (defaults to `./report.html`).
- `--title <string>`: Document and navbar title.
- `--theme <name>`: Initial DaisyUI theme (defaults to `light`).
- `--custom-theme <path>`: Path to custom JSON or CSS theme definition.
- `--live`: Enables Datastar.js streaming mode.
- `--pwa`: Generates an instant Progressive Web App with companion `manifest.webmanifest`, `sw.js`, and `icon.svg`.
- `--pwa-name <name>`: Custom PWA app name.
- `--pwa-short-name <short>`: Custom PWA homescreen short name.
- `--pwa-theme-color <hex>`: Custom PWA window/status-bar theme color.
- `--pwa-icon <emoji>`: Custom icon emoji glyph.
- `--offline`: Inlines external CSS/JS for standalone offline usage.
- `--all-addons`: Explicitly forces inclusion of all 17 CDN libraries regardless of auto-detection.

---

### 3. Instant PWA Generator (`generate-pwa.mjs`)

Standalone CLI tool to transform *any* existing HTML report into an installable, offline-ready Progressive Web App.

```bash
node skills/html-report/scripts/generate-pwa.mjs <report-path> [options]
```

#### Options:
- `<report-path>`: Path to the HTML report file to convert.
- `--title, -t <name>`: PWA application name (defaults to HTML title).
- `--short-name, -s <short>`: Homescreen short title.
- `--theme-color, -c <hex>`: App status bar / window frame color (default: `#2563eb`).
- `--bg-color, -b <hex>`: Splash screen background color (default: `#ffffff`).
- `--emoji, -e <emoji>`: Emoji glyph used for generating the app icon (default: `📊`).
- `--output-dir, -o <dir>`: Target directory for manifest and service worker files.

---

### 4. Single-Tab Dev Server (`serve-report.mjs`)

Lightweight local HTTP server supporting live reloading and Datastar SSE streaming.

```bash
node skills/html-report/scripts/serve-report.mjs <report-path> [--port <number>] [--no-open] [--feed-proxy <prefix=targetUrl>]
```

#### Options:
- `<report-path>`: Path to the HTML report file to serve (e.g. `report.html` or `implementation-progress.html`).
- `--port <number>`: Port number (defaults to `3000`).
- `--no-open`: Prevents automatically launching the report in the default browser.
- `--feed-proxy <prefix=targetUrl>`: Configures a local reverse proxy prefix for declarative public feeds (bypasses CORS restrictions).

---

## 🧩 Programmatic Node.js API

You can also invoke `html-report` modules programmatically in Node.js scripts:

### `buildReport(options)`

```javascript
import { buildReport } from "./skills/html-report/scripts/build-report.mjs";
import fs from "node:fs";

const content = fs.readFileSync("my-fragment.html", "utf-8");

const { html, title, activeAddons, durationMs } = buildReport({
  title: "Automated Benchmark Audit",
  content,
  theme: "light",
  live: false,
  offline: false,
  allAddons: false
});

fs.writeFileSync("output.html", html, "utf-8");
console.log(`Compiled in ${durationMs.toFixed(2)}ms with addons: ${activeAddons.join(", ")}`);
```

### `compileTheme(input)`

```javascript
import { compileTheme } from "./skills/html-report/scripts/theme-compiler.mjs";

const cssBlock = compileTheme({
  name: "cyber-teal",
  extends: "dark",
  colors: {
    primary: "#06b6d4",
    secondary: "#3b82f6",
    accent: "#f43f5e",
    neutral: "#1e293b",
    "base-100": "#0f172a"
  }
});

console.log(cssBlock);
// Outputs valid DaisyUI 4 OKLCH CSS variables
```
