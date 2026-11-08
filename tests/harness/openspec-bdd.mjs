/**
 * @fileoverview openspec-bdd.mjs
 * OpenSpec Markdown Scenario Discovery & Binding Engine.
 * Reads OpenSpec `spec.md` files directly, discovers declared scenarios,
 * and binds them to executable BDD test functions under native node:test.
 * Automatically marks unimplemented scenarios as `it.todo()`.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { Scenario } from "./bdd.mjs";

/**
 * Normalizes a string for loose key matching (ignoring case, punctuation, whitespace).
 * @param {string} str
 * @returns {string}
 */
export function normalizeKey(str) {
  return String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Parses an OpenSpec markdown string into structured requirements and scenarios.
 * @param {string} markdown Raw markdown content of spec.md
 * @returns {{ title: string, requirements: Array<{ name: string, scenarios: Array<{ name: string, steps: string[] }> }> }}
 */
export function parseSpecMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  let title = "OpenSpec Specification";
  const requirements = [];
  let currentReq = null;
  let currentScenario = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check spec title: # <Title>
    if (trimmed.startsWith("# ") && title === "OpenSpec Specification") {
      title = trimmed.replace(/^#\s+/, "").trim();
      continue;
    }

    // Check requirement headings: ### Requirement: <Name> or ### <Name>
    if (trimmed.startsWith("### ")) {
      const headingText = trimmed.replace(/^###\s+/, "").trim();
      const reqName = headingText.replace(/^Requirement:\s*/i, "").trim();
      currentReq = { name: reqName, scenarios: [] };
      requirements.push(currentReq);
      currentScenario = null;
      continue;
    }

    // Check scenario: #### Scenario: <Name>
    if (trimmed.startsWith("#### Scenario:") || /^####\s+Scenario:\s*/i.test(trimmed)) {
      const scenarioName = trimmed.replace(/^####\s+Scenario:\s*/i, "").trim();
      currentScenario = { name: scenarioName, steps: [] };
      if (!currentReq) {
        currentReq = { name: "General Requirements", scenarios: [] };
        requirements.push(currentReq);
      }
      currentReq.scenarios.push(currentScenario);
      continue;
    }

    // Capture GIVEN/WHEN/THEN/AND steps: - **GIVEN** ... or - GIVEN ...
    const stepMatch = trimmed.match(/^-\s*(?:\*\*)?(GIVEN|WHEN|THEN|AND)(?:\*\*)?[:\s]+(.*)$/i);
    if (currentScenario && stepMatch) {
      const keyword = stepMatch[1].toUpperCase();
      const text = stepMatch[2].trim();
      currentScenario.steps.push(`${keyword} ${text}`);
    }
  }

  return { title, requirements };
}

/**
 * Resolves the spec file path intelligently from exact path or capability name.
 * @param {string} specPath
 * @returns {string}
 */
export function resolveSpecPath(specPath) {
  const candidates = [
    path.isAbsolute(specPath) ? specPath : path.resolve(process.cwd(), specPath),
    path.resolve(process.cwd(), "openspec/specs", specPath, "spec.md"),
    path.resolve(process.cwd(), "openspec/changes", specPath, "specs", specPath, "spec.md"),
    path.resolve(process.cwd(), "openspec/changes", specPath, "spec.md")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  // Also check active change directories: openspec/changes/*/specs/<specPath>/spec.md
  const changesDir = path.resolve(process.cwd(), "openspec/changes");
  if (fs.existsSync(changesDir)) {
    try {
      const activeChanges = fs.readdirSync(changesDir);
      for (const change of activeChanges) {
        if (change === "archive") continue;
        const candidate = path.join(changesDir, change, "specs", specPath, "spec.md");
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return candidate;
        }
      }
    } catch (_) {}
  }

  // Also check archived change directories: openspec/changes/archive/*/specs/<specPath>/spec.md
  const archiveDir = path.resolve(process.cwd(), "openspec/changes/archive");
  if (fs.existsSync(archiveDir)) {
    try {
      const archivedChanges = fs.readdirSync(archiveDir);
      for (const change of archivedChanges) {
        const candidate = path.join(archiveDir, change, "specs", specPath, "spec.md");
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return candidate;
        }
      }
    } catch (_) {}
  }

  // Fallback to first resolved path for clear error diagnostics
  return candidates[0];
}

/**
 * Loads and inspects an OpenSpec file without invoking test suite registration.
 * Useful for inspecting scenario counts, titles, and steps.
 * @param {string} specPath
 * @returns {{ path: string, title: string, requirements: Array<any>, totalScenarios: number }}
 */
export function loadSpec(specPath) {
  const resolvedPath = resolveSpecPath(specPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`OpenSpec file not found at: ${resolvedPath}`);
  }
  const content = fs.readFileSync(resolvedPath, "utf-8");
  const parsed = parseSpecMarkdown(content);
  let totalScenarios = 0;
  for (const req of parsed.requirements) {
    totalScenarios += (req.scenarios?.length || 0);
  }
  return { path: resolvedPath, ...parsed, totalScenarios };
}

/**
 * Binds an OpenSpec markdown file to test scenario implementations.
 * Unbound scenarios are automatically registered as `it.todo()`.
 * 
 * @param {string} specPath Path to spec.md (relative to process.cwd() or absolute)
 * @param {Record<string, Function>} [scenarioBindings] Map of scenario names to async test functions
 * @param {object} [options]
 * @param {string} [options.suiteTitle] Custom title for the root describe block
 * @returns {{ title: string, totalScenarios: number, boundCount: number, todoCount: number }}
 */
export function bindOpenSpec(specPath, scenarioBindings = {}, options = {}) {
  const resolvedPath = resolveSpecPath(specPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`OpenSpec file not found at: ${resolvedPath}`);
  }

  const content = fs.readFileSync(resolvedPath, "utf-8");
  const { title, requirements } = parseSpecMarkdown(content);

  const suiteName = options.suiteTitle || `Feature Spec: ${title}`;

  // Build normalized lookup map for scenario implementations
  const bindingMap = new Map();
  for (const [key, fn] of Object.entries(scenarioBindings)) {
    bindingMap.set(normalizeKey(key), { originalKey: key, fn });
  }

  let totalScenarios = 0;
  let boundCount = 0;
  let todoCount = 0;

  describe(suiteName, () => {
    for (const req of requirements) {
      if (!req.scenarios || req.scenarios.length === 0) continue;

      describe(`Requirement: ${req.name}`, () => {
        for (const scenario of req.scenarios) {
          totalScenarios++;
          const matchKey = normalizeKey(scenario.name);
          const bound = bindingMap.get(matchKey);

          if (bound && typeof bound.fn === "function") {
            boundCount++;
            Scenario(scenario.name, bound.fn);
          } else {
            todoCount++;
            // Auto-detect pending specification gap
            it.todo(`Scenario: ${scenario.name}`);
          }
        }
      });
    }
  });

  return { title, totalScenarios, boundCount, todoCount };
}
