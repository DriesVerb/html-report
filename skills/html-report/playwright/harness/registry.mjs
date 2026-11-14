/**
 * Check Registry & Verification Contract Interface
 * Pluggable registry pattern for Playwright verification checks.
 */

export class VerificationCheck {
  constructor({ id, name, category = "core", cliFlags = [], styleguideRules = [] }) {
    if (!id || typeof id !== "string") {
      throw new Error("VerificationCheck requires a valid string id");
    }
    this.id = id;
    this.name = name || id;
    this.category = category; // "core" | "cdn" | "a11y" | "print" | "responsive" | "themes"
    this.cliFlags = Array.isArray(cliFlags) ? cliFlags : [];
    this.styleguideRules = Array.isArray(styleguideRules) ? styleguideRules : [];
  }

  /**
   * Evaluates whether this check should run for the given report and options.
   * @param {Object} context - { page, options, htmlPath, mode, detectedFeatures }
   * @returns {Promise<boolean>|boolean}
   */
  async shouldRun(context) {
    return true;
  }

  /**
   * Executes deterministic check assertions.
   * @param {Object} ctx - { page, browser, context, reportUrl, options, reporter }
   * @returns {Promise<Object>}
   */
  async run(ctx) {
    throw new Error(`VerificationCheck "${this.id}" must implement run()`);
  }
}

export class CheckRegistry {
  constructor() {
    this._checks = new Map();
  }

  /**
   * Registers a verification check.
   * @param {VerificationCheck} check
   */
  register(check) {
    if (!check || !check.id) {
      throw new Error("Invalid check: check must have an 'id' property");
    }
    this._checks.set(check.id, check);
    return this;
  }

  /**
   * Returns a check by id.
   * @param {string} id
   */
  get(id) {
    return this._checks.get(id);
  }

  /**
   * Checks if an id is registered.
   * @param {string} id
   */
  has(id) {
    return this._checks.has(id);
  }

  /**
   * Returns all registered checks in order.
   * @returns {VerificationCheck[]}
   */
  getAll() {
    return Array.from(this._checks.values());
  }

  /**
   * Filters registered checks based on CLI options.
   * @param {Object} options
   * @returns {VerificationCheck[]}
   */
  filter(options = {}) {
    const all = this.getAll();
    const hasOnly = Boolean(options.only);
    const hasSuites = Boolean(options.suites);
    const hasGrep = Boolean(options.grep);
    const hasAllCdns = Boolean(options.allCdns);
    const hasCdnsList = Boolean(options.cdns && (Array.isArray(options.cdns) ? options.cdns.length : options.cdns.trim()));
    const hasExplicitCdnFlags = all.some((c) =>
      c.cliFlags.some((flag) => {
        const camel = flag.replace(/^--/, "").replace(/-([a-z])/g, (_, g) => g.toUpperCase());
        return Boolean(options[camel] || options[flag]);
      })
    );

    const hasTargeting = hasOnly || hasSuites || hasGrep || hasAllCdns || hasCdnsList || hasExplicitCdnFlags;

    if (!hasTargeting) {
      return all;
    }

    const suiteList = hasSuites
      ? (Array.isArray(options.suites) ? options.suites : options.suites.split(","))
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : [];

    const cdnList = hasCdnsList
      ? (Array.isArray(options.cdns) ? options.cdns : options.cdns.split(","))
          .map((c) => c.trim().toLowerCase().replace(/^cdn:/, ""))
          .filter(Boolean)
      : [];

    let grepRegex = null;
    if (hasGrep) {
      try {
        grepRegex = new RegExp(options.grep, "i");
      } catch {
        grepRegex = null;
      }
    }

    return all.filter((check) => {
      // 1. --only flag (exact id match, category match, or substring name match)
      if (hasOnly) {
        const onlyVal = String(options.only).toLowerCase().trim();
        if (
          check.id.toLowerCase() === onlyVal ||
          check.id.toLowerCase() === `core:${onlyVal}` ||
          check.id.toLowerCase() === `cdn:${onlyVal}` ||
          check.category.toLowerCase() === onlyVal ||
          check.name.toLowerCase().includes(onlyVal)
        ) {
          return true;
        }
        return false;
      }

      let matches = false;

      // 2. --suites flag
      if (suiteList.length > 0) {
        const cat = check.category.toLowerCase();
        const id = check.id.toLowerCase();
        const inSuite = suiteList.some((s) => {
          if (s === "cdns" || s === "cdn") return cat === "cdn";
          if (s === "responsive") return cat === "responsive" || id.includes("responsive");
          if (s === "themes" || s === "theme") return cat === "themes" || id.includes("theme");
          if (s === "print" || s === "pdf") return cat === "print" || id.includes("print");
          if (s === "a11y" || s === "contrast") return cat === "a11y" || id.includes("a11y");
          if (s === "core") return cat === "core" || cat === "responsive" || cat === "themes";
          return cat === s || id.includes(s);
        });
        if (inSuite) matches = true;
      }

      // 3. --grep flag
      if (grepRegex) {
        if (grepRegex.test(check.id) || grepRegex.test(check.name) || grepRegex.test(check.category)) {
          matches = true;
        }
      }

      // 4. --all-cdns flag
      if (hasAllCdns && check.category === "cdn") {
        matches = true;
      }

      // 5. --cdns <list> flag
      if (cdnList.length > 0 && check.category === "cdn") {
        const cdnName = check.id.replace(/^cdn:/, "").toLowerCase();
        if (cdnList.includes(cdnName)) matches = true;
      }

      // 6. Explicit check flag (--check-charts, --check-mermaid, etc.)
      const flagMatched = check.cliFlags.some((flag) => {
        const camel = flag.replace(/^--/, "").replace(/-([a-z])/g, (_, g) => g.toUpperCase());
        return Boolean(options[camel] || options[flag]);
      });
      if (flagMatched) matches = true;

      return matches;
    });
  }
}

export const globalRegistry = new CheckRegistry();

export function registerCheck(check) {
  return globalRegistry.register(check);
}

export async function createDefaultRegistry() {
  const registry = new CheckRegistry();

  const [
    { ConsoleErrorsCheck },
    { StructureCheck },
    { ResponsiveCheck },
    { ThemeSwitcherCheck },
    { PrintPdfCheck },
    { A11yContrastCheck },
    { ChartsCheck },
    { MermaidCheck },
    { LeafletCheck },
    { GridJsCheck },
    { KatexCheck },
    { HighlightCheck },
    { MarkedCheck },
    { LucideCheck },
    { AlpineCheck },
    { FullCalendarCheck },
    { RevealCheck }
  ] = await Promise.all([
    import("./checks/core/console-errors.mjs"),
    import("./checks/core/structure.mjs"),
    import("./checks/core/responsive.mjs"),
    import("./checks/core/theme-switcher.mjs"),
    import("./checks/core/print-pdf.mjs"),
    import("./checks/core/a11y-contrast.mjs"),
    import("./checks/cdns/charts.mjs"),
    import("./checks/cdns/mermaid.mjs"),
    import("./checks/cdns/leaflet.mjs"),
    import("./checks/cdns/gridjs.mjs"),
    import("./checks/cdns/katex.mjs"),
    import("./checks/cdns/highlight.mjs"),
    import("./checks/cdns/marked.mjs"),
    import("./checks/cdns/lucide.mjs"),
    import("./checks/cdns/alpine.mjs"),
    import("./checks/cdns/fullcalendar.mjs"),
    import("./checks/cdns/reveal.mjs")
  ]);

  registry.register(new ConsoleErrorsCheck());
  registry.register(new StructureCheck());
  registry.register(new ResponsiveCheck());
  registry.register(new ThemeSwitcherCheck());
  registry.register(new ChartsCheck());
  registry.register(new MermaidCheck());
  registry.register(new LeafletCheck());
  registry.register(new GridJsCheck());
  registry.register(new KatexCheck());
  registry.register(new HighlightCheck());
  registry.register(new MarkedCheck());
  registry.register(new LucideCheck());
  registry.register(new AlpineCheck());
  registry.register(new FullCalendarCheck());
  registry.register(new RevealCheck());
  registry.register(new PrintPdfCheck());
  registry.register(new A11yContrastCheck());

  return registry;
}
