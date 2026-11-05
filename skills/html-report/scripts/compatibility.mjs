/**
 * Compatibility & SemVer Stability Interceptor for html-report
 *
 * Provides:
 * - Dynamic version querying from canonical package.json
 * - Runtime deprecation warnings with actionable migration guidance
 * - Turnkey AI migration prompts
 * - CLI and programmatic codebase compatibility scanning
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SEMVER_SPEC = "2.0.0";

/**
 * Locate and read root package.json
 */
let cachedPackageJson = null;
export function getPackageMetadata() {
  if (cachedPackageJson) return cachedPackageJson;

  const candidates = [
    path.resolve(__dirname, "../../../package.json"),
    path.resolve(__dirname, "../../package.json"),
    path.resolve(process.cwd(), "package.json")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(candidate, "utf-8"));
        if (parsed.name === "html-report") {
          cachedPackageJson = parsed;
          return parsed;
        }
      } catch (_) {}
    }
  }

  // Fallback defaults
  cachedPackageJson = {
    name: "html-report",
    version: "1.0.0"
  };
  return cachedPackageJson;
}

export function getPackageVersion() {
  return getPackageMetadata().version || "1.0.0";
}

export function formatVersionString() {
  return `html-report v${getPackageVersion()} (SemVer ${SEMVER_SPEC})`;
}

/**
 * Catalog of deprecated or legacy flags/options across versions
 */
export const DEPRECATION_CATALOG = {
  cli: [
    {
      deprecated: "--dashboard-mode",
      replacement: "--mode dashboard (or --dashboard)",
      since: "1.0.0",
      retiredIn: "2.0.0",
      guide: "docs/migrations/v1-to-v2.md"
    },
    {
      deprecated: "--print-mode",
      replacement: "--mode print (or --print / -p)",
      since: "1.0.0",
      retiredIn: "2.0.0",
      guide: "docs/migrations/v1-to-v2.md"
    },
    {
      deprecated: "--live-stream",
      replacement: "--mode live-report (or --live / -l)",
      since: "1.0.0",
      retiredIn: "2.0.0",
      guide: "docs/migrations/v1-to-v2.md"
    },
    {
      deprecated: "--offline-bundle",
      replacement: "--offline",
      since: "1.0.0",
      retiredIn: "2.0.0",
      guide: "docs/migrations/v1-to-v2.md"
    }
  ],
  api: [
    {
      deprecated: "dashboardMode",
      replacement: 'mode: "dashboard"',
      since: "1.0.0",
      retiredIn: "2.0.0",
      guide: "docs/migrations/v1-to-v2.md"
    },
    {
      deprecated: "offlineBundle",
      replacement: "offline: true",
      since: "1.0.0",
      retiredIn: "2.0.0",
      guide: "docs/migrations/v1-to-v2.md"
    }
  ]
};

/**
 * Check CLI argv for deprecated flags, emit helpful warnings to stderr, and return normalized flags.
 */
export function checkDeprecatedCliArgs(argv = process.argv.slice(2), { emitWarnings = true } = {}) {
  const warnings = [];
  const normalized = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const match = DEPRECATION_CATALOG.cli.find((item) => item.deprecated === arg);

    if (match) {
      warnings.push({
        flag: arg,
        replacement: match.replacement,
        retiredIn: match.retiredIn,
        guide: match.guide
      });

      if (emitWarnings) {
        console.warn(
          `\x1b[33m⚠️  [html-report deprecation]\x1b[0m Flag '${arg}' is deprecated and scheduled for removal in v${match.retiredIn}.\n` +
          `   👉 Recommendation: Use '${match.replacement}' instead.\n` +
          `   📖 Migration Guide: ${match.guide}\n`
        );
      }

      // Map to canonical equivalent if direct substitution exists
      if (arg === "--dashboard-mode") normalized.push("--dashboard");
      else if (arg === "--print-mode") normalized.push("--print");
      else if (arg === "--live-stream") normalized.push("--live");
      else if (arg === "--offline-bundle") normalized.push("--offline");
      else normalized.push(arg);
    } else {
      normalized.push(arg);
    }
  }

  return { normalized, warnings };
}

/**
 * Check programmatic JS options object for deprecated properties.
 */
export function checkDeprecatedApiOptions(options = {}, { emitWarnings = true } = {}) {
  if (!options || typeof options !== "object") return { normalized: options, warnings: [] };

  const warnings = [];
  const normalized = { ...options };

  for (const item of DEPRECATION_CATALOG.api) {
    if (item.deprecated in normalized) {
      warnings.push({
        property: item.deprecated,
        replacement: item.replacement,
        retiredIn: item.retiredIn,
        guide: item.guide
      });

      if (emitWarnings) {
        console.warn(
          `\x1b[33m⚠️  [html-report deprecation]\x1b[0m API option '${item.deprecated}' is deprecated (retires in v${item.retiredIn}).\n` +
          `   👉 Recommendation: Use '${item.replacement}'.\n` +
          `   📖 Migration Guide: ${item.guide}\n`
        );
      }

      // Automatic fallback migrations
      if (item.deprecated === "dashboardMode" && !normalized.mode) {
        normalized.mode = "dashboard";
      } else if (item.deprecated === "offlineBundle" && normalized.offline === undefined) {
        normalized.offline = Boolean(normalized[item.deprecated]);
      }
    }
  }

  return { normalized, warnings };
}

/**
 * Generate standard AI Agent Migration Prompt for breaking changes
 */
export function generateAiMigrationPrompt({ fromVersion = "1.x", toVersion = "2.0.0", breakingItems = [] } = {}) {
  const itemsText = breakingItems.length > 0
    ? breakingItems.map((item) => `- Replace \`${item.old}\` with \`${item.new}\` (${item.desc})`).join("\n")
    : `- Update deprecated CLI flags to their modern counterparts.\n- Ensure all imports resolve via canonical subpaths (e.g. 'html-report/build').\n- Update package.json dependency to ^${toVersion}.`;

  return `
<AI_MIGRATION_PROMPT>
You are an expert AI refactoring engineer upgrading this project's integration with \`html-report\`.
Target Upgrade: v${fromVersion} -> v${toVersion} (SemVer 2.0.0).

Follow these exact steps:
1. REVIEW MIGRATION GUIDE:
   - Read MIGRATION.md and docs/migrations/v${fromVersion.charAt(0)}-to-v${toVersion.charAt(0)}.md.

2. MECHANICAL CODEMODS:
${itemsText}

3. VERIFICATION:
   - Run project tests: \`npm test\` or \`node --test\`.
   - Ensure all reports compile with zero deprecation warnings and exit code 0.
</AI_MIGRATION_PROMPT>
`.trim();
}

/**
 * Audit a project directory for deprecated or incompatible usages
 */
export function checkCompatibility(targetDir = process.cwd()) {
  const findings = [];
  const filesToScan = [];

  function collectFiles(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name.startsWith(".") && ent.name !== ".caller-requests") continue;
      if (["node_modules", ".git", "tmp", "dist"].includes(ent.name)) continue;

      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        collectFiles(full);
      } else if (/\.(m?js|cjs|sh|bash|json|html|md)$/i.test(ent.name)) {
        filesToScan.push(full);
      }
    }
  }

  collectFiles(targetDir);

  for (const filePath of filesToScan) {
    const rel = path.relative(targetDir, filePath);
    // Skip self, tests, migration documentation, and openspec planning artifacts
    if (
      rel.includes("compatibility.mjs") ||
      rel.startsWith("tests/") ||
      rel.startsWith("docs/migrations/") ||
      rel.startsWith("openspec/") ||
      rel === "MIGRATION.md" ||
      rel.includes("node_modules")
    ) continue;

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, idx) => {
        // Check CLI deprecations
        for (const item of DEPRECATION_CATALOG.cli) {
          if (line.includes(item.deprecated)) {
            findings.push({
              file: rel,
              line: idx + 1,
              match: item.deprecated,
              replacement: item.replacement,
              type: "cli-flag",
              retiredIn: item.retiredIn,
              guide: item.guide
            });
          }
        }
        // Check API deprecations
        for (const item of DEPRECATION_CATALOG.api) {
          const regex = new RegExp(`\\b${item.deprecated}\\b`);
          if (regex.test(line) && !line.includes("deprecated:")) {
            findings.push({
              file: rel,
              line: idx + 1,
              match: item.deprecated,
              replacement: item.replacement,
              type: "js-api",
              retiredIn: item.retiredIn,
              guide: item.guide
            });
          }
        }
      });
    } catch (_) {}
  }

  return {
    scannedFilesCount: filesToScan.length,
    findings,
    isCompatible: findings.length === 0,
    currentVersion: getPackageVersion(),
    semverSpec: SEMVER_SPEC
  };
}
