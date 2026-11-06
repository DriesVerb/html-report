import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  discoverSkills,
  routeSkill,
  runBenchmark,
  parseSkillMarkdown,
  CANONICAL_SKILL_NAMES,
  MAX_SKILL_SIZE_BYTES
} from '../skills/html-report/scripts/skill-router.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

describe('Modular Skill Decomposition & Discovery', () => {
  it('discovers all canonical modular skill facades in skills/', () => {
    const skills = discoverSkills(path.join(REPO_ROOT, 'skills'));
    const names = skills.map(s => s.name);

    for (const canonical of CANONICAL_SKILL_NAMES) {
      assert.ok(names.includes(canonical), `Missing canonical skill: ${canonical}`);
    }
  });

  it('discovers all canonical modular skill facades in .agents/skills/ via symlinks', () => {
    const skills = discoverSkills(path.join(REPO_ROOT, '.agents/skills'));
    const names = skills.map(s => s.name);

    for (const canonical of CANONICAL_SKILL_NAMES) {
      assert.ok(names.includes(canonical), `Missing symlinked skill in .agents/skills/: ${canonical}`);
    }
  });

  it('enforces Matt Pocock size boundary (<5KB) across all modular skills', () => {
    const skills = discoverSkills(path.join(REPO_ROOT, 'skills'));
    const targetSkills = skills.filter(s => CANONICAL_SKILL_NAMES.includes(s.name));

    assert.equal(targetSkills.length, CANONICAL_SKILL_NAMES.length);

    for (const skill of targetSkills) {
      assert.ok(
        skill.sizeBytes <= MAX_SKILL_SIZE_BYTES,
        `Skill ${skill.name} exceeds 5KB: ${skill.sizeBytes} bytes (${skill.sizeKB} KB)`
      );
    }
  });

  it('guarantees zero duplicated assets or scripts in sibling skill directories', () => {
    const skills = discoverSkills(path.join(REPO_ROOT, 'skills'));
    const siblingSkills = skills.filter(s => s.name !== 'html-report' && CANONICAL_SKILL_NAMES.includes(s.name));

    for (const skill of siblingSkills) {
      assert.equal(
        skill.hasDuplicatedAssets,
        false,
        `Skill ${skill.name} unexpectedly contains duplicate scripts or assets directories`
      );
    }
  });

  it('validates YAML frontmatter metadata format for all specialized skills', () => {
    for (const skillName of CANONICAL_SKILL_NAMES) {
      const skillPath = path.join(REPO_ROOT, 'skills', skillName, 'SKILL.md');
      assert.ok(fs.existsSync(skillPath), `SKILL.md does not exist at ${skillPath}`);

      const content = fs.readFileSync(skillPath, 'utf8');
      const { frontmatter, body } = parseSkillMarkdown(content);

      assert.equal(frontmatter.name, skillName, `Frontmatter name mismatch in ${skillName}`);
      assert.ok(frontmatter.description, `Missing description in ${skillName}`);
      assert.ok(frontmatter.description.length > 30, `Description too short in ${skillName}`);
      assert.ok(body.includes('# '), `Missing top-level header in ${skillName}`);
    }
  });

  it('resolves relative symlinks in .agents/skills/ correctly to canonical directories', () => {
    for (const skillName of CANONICAL_SKILL_NAMES) {
      const symlinkPath = path.join(REPO_ROOT, '.agents/skills', skillName);
      assert.ok(fs.existsSync(symlinkPath), `Symlink missing: ${symlinkPath}`);

      const stat = fs.lstatSync(symlinkPath);
      assert.ok(stat.isSymbolicLink(), `${symlinkPath} is not a symlink`);

      const target = fs.readlinkSync(symlinkPath);
      const resolved = path.resolve(path.dirname(symlinkPath), target);
      const canonical = path.join(REPO_ROOT, 'skills', skillName);

      assert.equal(resolved, canonical, `Symlink ${skillName} points to ${resolved}, expected ${canonical}`);
    }
  });
});

describe('Skill Intent Router & Token Efficiency Benchmark', () => {
  it('accurately routes printable and invoice intents to @html-print', () => {
    const r1 = routeSkill('Generate an A4 PDF invoice for client billing');
    assert.equal(r1.skill, 'html-print');

    const r2 = routeSkill('I need a receipt with clean page breaks for printing');
    assert.equal(r2.skill, 'html-print');

    const r3 = routeSkill('Please run /html-print');
    assert.equal(r3.skill, 'html-print');
  });

  it('accurately routes real-time telemetry and SSE intents to @html-dashboard', () => {
    const r1 = routeSkill('Create a real-time monitoring dashboard with Datastar SSE streaming');
    assert.equal(r1.skill, 'html-dashboard');

    const r2 = routeSkill('Live agent swarm telemetry with token velocity tracking');
    assert.equal(r2.skill, 'html-dashboard');

    const r3 = routeSkill('Execute /html-dashboard');
    assert.equal(r3.skill, 'html-dashboard');
  });

  it('accurately routes pitch deck and slide intents to @html-presentation', () => {
    const r1 = routeSkill('Build an executive pitch deck with 3D Impress slides');
    assert.equal(r1.skill, 'html-presentation');

    const r2 = routeSkill('Keynote presentation with slide transitions and dark theme');
    assert.equal(r2.skill, 'html-presentation');
  });

  it('accurately routes offline and PWA intents to @html-pwa', () => {
    const r1 = routeSkill('I want to create a PWA with offline caching');
    assert.equal(r1.skill, 'html-pwa');

    const r2 = routeSkill('Make this report installable on mobile devices with sw.js');
    assert.equal(r2.skill, 'html-pwa');
  });

  it('accurately routes creation wizard and decision prompts to @html-create', () => {
    const r1 = routeSkill('Help me decide what kind of HTML report or dashboard I should create');
    assert.equal(r1.skill, 'html-create');

    const r2 = routeSkill('Launch /html-create:cli for a terminal grill interview');
    assert.equal(r2.skill, 'html-create');

    const r3 = routeSkill('Help me choose between a live dashboard or a printable PDF');
    assert.equal(r3.skill, 'html-create');
  });

  it('accurately routes standard KPI summaries to @html-report', () => {
    const r1 = routeSkill('Quarterly business analytics report with Chart.js and Grid.js');
    assert.equal(r1.skill, 'html-report');

    const r2 = routeSkill('Executive summary with Mermaid system architecture diagram');
    assert.equal(r2.skill, 'html-report');
  });

  it('achieves >95% intent routing benchmark accuracy', () => {
    const benchmark = runBenchmark();
    assert.ok(
      benchmark.accuracy >= 95.0,
      `Benchmark accuracy was ${benchmark.accuracy}%, expected >= 95%`
    );
  });
});
