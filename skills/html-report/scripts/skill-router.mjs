#!/usr/bin/env node
/**
 * skill-router.mjs - Modular Skill Discovery & Intent Router
 *
 * Discovers modular skills in skills/ and .agents/skills/, validates
 * Matt Pocock facade size boundaries (<5KB), checks zero asset duplication,
 * and deterministically routes user prompts to the optimal specialized skill facade.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

export const CANONICAL_SKILL_NAMES = [
  'html-report',
  'html-print',
  'html-dashboard',
  'html-presentation',
  'html-pwa',
  'html-create'
];

export const MAX_SKILL_SIZE_BYTES = 5120; // 5.0 KB strict limit

export const SKILL_DOMAIN_METADATA = Object.freeze({
  'html-report': { role: 'Delivery Archetype', beneficiary: 'hybrid', servingMode: 'staticFile', behavioralMode: 'interactive' },
  'html-print': { role: 'Delivery Archetype', beneficiary: 'user', servingMode: 'staticFile', behavioralMode: 'passive' },
  'html-dashboard': { role: 'Delivery Archetype', beneficiary: 'hybrid', servingMode: 'serverConnected', behavioralMode: 'interactive' },
  'html-presentation': { role: 'Delivery Archetype', beneficiary: 'user', servingMode: 'staticFile', behavioralMode: 'interactive' },
  'html-pwa': { role: 'Offline Packaging Modifier', beneficiary: 'user', servingMode: 'staticFile', behavioralMode: 'interactive' },
  'html-create': { role: 'Create Mode', beneficiary: 'hybrid', servingMode: 'staticFile', behavioralMode: 'interactive' }
});

/**
 * Parses YAML frontmatter and markdown body from SKILL.md
 */
export function parseSkillMarkdown(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const rawYaml = match[1];
  const body = match[2];
  const frontmatter = {};

  const lines = rawYaml.split(/\r?\n/);
  let currentKey = null;
  let currentValue = '';

  for (const line of lines) {
    const keyMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (keyMatch) {
      if (currentKey) {
        frontmatter[currentKey] = currentValue.trim().replace(/^>-\s*/, '').replace(/\s+/g, ' ');
      }
      currentKey = keyMatch[1];
      currentValue = keyMatch[2] || '';
    } else if (currentKey && line.startsWith('  ')) {
      currentValue += ' ' + line.trim();
    }
  }

  if (currentKey) {
    frontmatter[currentKey] = currentValue.trim().replace(/^>-\s*/, '').replace(/\s+/g, ' ');
  }

  return { frontmatter, body };
}

/**
 * Discovers all modular skills in the specified directory.
 */
export function discoverSkills(skillsDir = path.join(REPO_ROOT, 'skills')) {
  if (!fs.existsSync(skillsDir)) {
    return [];
  }

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  const skills = [];

  for (const entry of entries) {
    const fullPath = path.join(skillsDir, entry.name);
    // Support directory or symlink
    let isDir = entry.isDirectory();
    if (entry.isSymbolicLink()) {
      try {
        const stat = fs.statSync(fullPath);
        isDir = stat.isDirectory();
      } catch {
        isDir = false;
      }
    }

    if (!isDir) continue;

    const skillMdPath = path.join(fullPath, 'SKILL.md');
    if (fs.existsSync(skillMdPath)) {
      const stats = fs.statSync(skillMdPath);
      const content = fs.readFileSync(skillMdPath, 'utf8');
      const { frontmatter, body } = parseSkillMarkdown(content);

      // Check for code assets duplication (scripts, assets dirs)
      const hasSeparateAssets = fs.existsSync(path.join(fullPath, 'assets')) && entry.name !== 'html-report';
      const hasSeparateScripts = fs.existsSync(path.join(fullPath, 'scripts')) && entry.name !== 'html-report';

      skills.push({
        name: frontmatter.name || entry.name,
        dirName: entry.name,
        path: fullPath,
        skillMdPath,
        sizeBytes: stats.size,
        sizeKB: Number((stats.size / 1024).toFixed(2)),
        isUnderSizeLimit: stats.size <= MAX_SKILL_SIZE_BYTES,
        description: frontmatter.description || '',
        hasDuplicatedAssets: hasSeparateAssets || hasSeparateScripts,
        domainMetadata: SKILL_DOMAIN_METADATA[entry.name] || null,
        frontmatter,
        body
      });
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Intent Routing Rules & Keywords
 */
export const ROUTING_RULES = [
  {
    skill: 'html-create',
    priority: 120,
    exactTriggers: ['/html-create', '/html-create:cli', '@html-create'],
    regex: /\b(wizard|decision|onboarding|interactive\s+studio|choose\s+report|what\s+report|help\s+me\s+(choose|build|decide|pick)|choose\s+between|decide\s+between|which\s+(one|report|architecture)|grill|interview|studio|questionnaire)\b/i,
    keywords: ['wizard', 'decision', 'onboarding', 'grill', 'interview', 'studio', 'questionnaire', 'decide', 'choose']
  },
  {
    skill: 'html-pwa',
    priority: 95,
    exactTriggers: ['/html-pwa', '@html-pwa'],
    regex: /\b(pwa|progressive\s+web\s+app|offline|installable|installation|service\s+worker|sw\.js|webmanifest|manifest|offline-first|mobile\s+app)\b/i,
    keywords: ['pwa', 'offline', 'installable', 'manifest', 'service worker', 'sw.js', 'progressive', 'installation']
  },
  {
    skill: 'html-print',
    priority: 90,
    exactTriggers: ['/html-print', '@html-print'],
    regex: /\b(print|printable|paged|pdf|invoice|invoices|receipt|receipts|billing|a4|page-break|page\s+break|compliance\s+document)\b/i,
    keywords: ['print', 'printable', 'pdf', 'invoice', 'receipt', 'a4', 'page', 'compliance']
  },
  {
    skill: 'html-dashboard',
    priority: 85,
    exactTriggers: ['/html-dashboard', '@html-dashboard'],
    regex: /\b(live|telemetry|real-time|realtime|streaming|datastar|sse|stream|swarm|subagent|token\s+velocity|agent\s+monitor|co-pilot\s+bridge)\b/i,
    keywords: ['live', 'telemetry', 'realtime', 'streaming', 'datastar', 'sse', 'swarm', 'monitor']
  },
  {
    skill: 'html-presentation',
    priority: 80,
    exactTriggers: ['/html-presentation', '@html-presentation'],
    regex: /\b(presentation|presentations|slide|slides|deck|pitch|impress|3d\s+slide|keynote)\b/i,
    keywords: ['presentation', 'slide', 'slides', 'deck', 'pitch', 'impress', 'keynote']
  },
  {
    skill: 'html-report',
    priority: 60,
    exactTriggers: ['/html-report', '@html-report'],
    regex: /\b(report|reports|analytics|bi|kpi|charts|chart|metrics|table|tables|diagram|mermaid|summary|audit)\b/i,
    keywords: ['report', 'analytics', 'kpi', 'chart', 'charts', 'summary', 'audit', 'table']
  }
];

/**
 * Deterministically routes a user prompt/intent to the optimal specialized skill facade.
 */
export function routeSkill(promptText) {
  if (!promptText || typeof promptText !== 'string') {
    return {
      skill: 'html-report',
      confidence: 0.5,
      reason: 'Empty prompt defaulted to baseline html-report'
    };
  }

  const text = promptText.trim();

  // 1. Check exact slash command or @skill triggers first
  for (const rule of ROUTING_RULES) {
    for (const trigger of rule.exactTriggers) {
      if (text.toLowerCase().includes(trigger.toLowerCase())) {
        return {
          skill: rule.skill,
          confidence: 1.0,
          reason: `Exact match for trigger "${trigger}"`
        };
      }
    }
  }

  // 2. Score based on regex and keyword frequency
  let bestSkill = 'html-report';
  let bestScore = -1;
  let matchReason = 'Default baseline';

  for (const rule of ROUTING_RULES) {
    let score = 0;
    const regexMatches = text.match(new RegExp(rule.regex, 'gi'));
    if (regexMatches) {
      score += regexMatches.length * 15 + rule.priority * 0.15;
    }

    const lower = text.toLowerCase();
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        score += 5;
      }
    }

    // Extra weight for creation wizard meta-choice questions
    if (rule.skill === 'html-create' && /\b(choose\s+between|decide\s+between|help\s+me\s+(choose|decide))\b/i.test(text)) {
      score += 40;
    }

    if (score > bestScore && score > 0) {
      bestScore = score;
      bestSkill = rule.skill;
      matchReason = `Matched patterns for ${rule.skill} (score: ${score.toFixed(1)})`;
    }
  }

  const confidence = bestScore > 0 ? Math.min(1.0, Number((0.5 + (bestScore / 40)).toFixed(2))) : 0.5;

  return {
    skill: bestSkill,
    confidence,
    reason: matchReason
  };
}

/**
 * Standard benchmark suite for intent matching
 */
export const BENCHMARK_CASES = [
  // html-print
  { prompt: 'Generate an invoice for Acme Corp with line items and total', expected: 'html-print' },
  { prompt: 'I need a printable PDF compliance audit report for ISO 27001', expected: 'html-print' },
  { prompt: 'Export this document to A4 format with clean page breaks', expected: 'html-print' },
  { prompt: 'Create a billing receipt with print styling and page breaks', expected: 'html-print' },
  { prompt: 'We need an export-ready paged PDF document with avoid-break headers', expected: 'html-print' },
  { prompt: 'Run /html-print to format this invoice', expected: 'html-print' },

  // html-dashboard
  { prompt: 'Build a real-time agent telemetry dashboard streaming with Datastar SSE', expected: 'html-dashboard' },
  { prompt: 'We need a live multi-agent swarm activity monitor with token velocity counters', expected: 'html-dashboard' },
  { prompt: 'Create an SSE live streaming dashboard with tool call feeds and stopwatches', expected: 'html-dashboard' },
  { prompt: 'Stream real-time agent CoT thoughts and DOM fragments without full-page reloads', expected: 'html-dashboard' },
  { prompt: 'Monitor subagent hierarchy and live execution state via datastar', expected: 'html-dashboard' },
  { prompt: 'Run /html-dashboard for the current agent session', expected: 'html-dashboard' },

  // html-presentation
  { prompt: 'Build an executive pitch deck for our seed round using 3D slides', expected: 'html-presentation' },
  { prompt: 'Create a slide presentation with Impress.js 3D transitions and dark theme', expected: 'html-presentation' },
  { prompt: 'I want a keynote deck with slide step cards and an overview zoom', expected: 'html-presentation' },
  { prompt: 'Design an interactive 3D storytelling presentation journey', expected: 'html-presentation' },
  { prompt: 'Run /html-presentation for the architecture review', expected: 'html-presentation' },

  // html-pwa
  { prompt: 'Turn this report into an installable progressive web app (PWA)', expected: 'html-pwa' },
  { prompt: 'I want to create a PWA with offline caching and service worker', expected: 'html-pwa' },
  { prompt: 'Make this dashboard offline-first with a web app manifest and icon', expected: 'html-pwa' },
  { prompt: 'Enable native mobile installation and dual-caching sw.js', expected: 'html-pwa' },
  { prompt: 'Run /html-pwa to generate the service worker and manifest', expected: 'html-pwa' },

  // html-create
  { prompt: 'Help me decide what kind of HTML report or dashboard I should create', expected: 'html-create' },
  { prompt: 'Run /html-create to launch the decision wizard and theme studio', expected: 'html-create' },
  { prompt: 'Execute /html-create:cli for a terminal grill interview', expected: 'html-create' },
  { prompt: 'I need an onboarding questionnaire to choose my report architecture', expected: 'html-create' },
  { prompt: 'Help me choose between a live dashboard or a printable PDF', expected: 'html-create' },

  // html-report
  { prompt: 'Build a quarterly business performance report with KPI metrics and charts', expected: 'html-report' },
  { prompt: 'Create an analytics report with Chart.js bar charts and Grid.js tables', expected: 'html-report' },
  { prompt: 'Generate an executive summary report with Mermaid architecture diagram', expected: 'html-report' },
  { prompt: 'I need a website traffic analytics report with light theme', expected: 'html-report' },
  { prompt: 'Produce a code quality audit report with statistics and cards', expected: 'html-report' }
];

export function runBenchmark() {
  let passed = 0;
  const results = [];

  for (const testCase of BENCHMARK_CASES) {
    const route = routeSkill(testCase.prompt);
    const isCorrect = route.skill === testCase.expected;
    if (isCorrect) passed++;

    results.push({
      prompt: testCase.prompt,
      expected: testCase.expected,
      actual: route.skill,
      isCorrect,
      confidence: route.confidence
    });
  }

  const accuracy = (passed / BENCHMARK_CASES.length) * 100;
  return {
    total: BENCHMARK_CASES.length,
    passed,
    failed: BENCHMARK_CASES.length - passed,
    accuracy: Number(accuracy.toFixed(1)),
    results
  };
}

// CLI handler
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rawArgs = process.argv.slice(2);
  const jsonOutput = rawArgs.includes('--json');
  const filteredArgs = rawArgs.filter((a) => a !== '--json');
  const command = filteredArgs[0] || 'list';

  if (command === 'list') {
    const skills = discoverSkills();
    if (jsonOutput) {
      console.log(JSON.stringify({ count: skills.length, skills }, null, 2));
    } else {
      console.log(`\nDiscovered ${skills.length} Modular Skill Facades in skills/:\n`);
      for (const skill of skills) {
        const status = skill.isUnderSizeLimit ? '✅' : '❌ EXCEEDS 5KB';
        console.log(`  ${status} ${skill.name.padEnd(20)} [${skill.sizeKB} KB] (${skill.sizeBytes} bytes)`);
        if (skill.hasDuplicatedAssets) {
          console.warn(`     ⚠️ WARNING: Potential duplicated assets in ${skill.name}`);
        }
      }
      console.log('');
    }
  } else if (command === 'route') {
    const prompt = filteredArgs.slice(1).join(' ');
    const routing = routeSkill(prompt);
    console.log(JSON.stringify(routing, null, 2));
  } else if (command === 'benchmark') {
    const bench = runBenchmark();
    if (jsonOutput) {
      console.log(JSON.stringify(bench, null, 2));
      if (bench.accuracy < 95) process.exit(1);
    } else {
      console.log(`\nSkill Intent Routing Benchmark:`);
      console.log(`Total: ${bench.total} | Passed: ${bench.passed} | Failed: ${bench.failed}`);
      console.log(`Accuracy: ${bench.accuracy}%\n`);
      if (bench.accuracy < 95) {
        console.error('❌ Benchmark failed: accuracy is below 95% target.');
        process.exit(1);
      } else {
        console.log('✅ Benchmark passed: accuracy exceeds 95% threshold!');
      }
    }
  } else {
    console.log('Usage:');
    console.log('  node skill-router.mjs list [--json]');
    console.log('  node skill-router.mjs route "<prompt>"');
    console.log('  node skill-router.mjs benchmark [--json]');
  }
}
