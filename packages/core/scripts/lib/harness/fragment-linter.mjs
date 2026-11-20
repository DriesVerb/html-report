/**
 * Fragment structural linter and mechanical auto-fix transforms
 * for @html-report/core harness.
 */

/**
 * Converts any arbitrary heading or section title into a URL-friendly slug.
 */
export function slugify(text = "") {
  const plain = text.replace(/<[^>]+>/g, "").trim();

  const normalized = plain
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "section";
}

/**
 * Scans HTML string and collects all existing ID attribute values.
 */
export function collectExistingIds(html = "") {
  const ids = new Set();
  const idRegex = /\bid\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = idRegex.exec(html)) !== null) {
    if (match[1]) {
      ids.add(match[1]);
    }
  }
  return ids;
}

/**
 * Generates a unique ID given base text and an existing set of IDs.
 */
export function generateUniqueId(text, existingIds) {
  const baseSlug = slugify(text);
  let candidate = baseSlug;
  let counter = 1;

  while (existingIds.has(candidate)) {
    candidate = `${baseSlug}-${counter}`;
    counter++;
  }

  existingIds.add(candidate);
  return candidate;
}

function getLineAndCol(str, index) {
  const pre = str.slice(0, index);
  const lines = pre.split("\n");
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  return { line, col };
}

/**
 * Lints an HTML fragment for structural flaws:
 * 1. Accidental outer boilerplate (<!DOCTYPE>, <html>, <head>, <body>, <main>, frontmatter)
 * 2. Missing IDs on <h1>, <h2>, <h3> headings
 * 3. Bare <table> elements lacking horizontal overflow wrappers
 */
export function lintFragment(rawContent = "") {
  const issues = [];
  const content = String(rawContent);

  if (content.trim().startsWith("---")) {
    const endMatch = content.slice(3).indexOf("\n---");
    if (endMatch !== -1) {
      issues.push({
        type: "OUTER_BOILERPLATE",
        tag: "frontmatter",
        line: 1,
        message: "HTML fragment contains YAML frontmatter header.",
        snippet: content.slice(0, endMatch + 7),
        fixable: true,
        suggestedFix: "Strip YAML frontmatter from fragment."
      });
    }
  }

  const boilerplateTags = [
    { tag: "<!DOCTYPE", regex: /<!DOCTYPE\b[^>]*>/gi, name: "<!DOCTYPE>" },
    { tag: "<html", regex: /<html\b[^>]*>/gi, name: "<html>" },
    { tag: "</html>", regex: /<\/html>/gi, name: "</html>" },
    { tag: "<head", regex: /<head\b[^>]*>[\s\S]*?<\/head>/gi, name: "<head>...</head>" },
    { tag: "<body", regex: /<body\b[^>]*>/gi, name: "<body>" },
    { tag: "</body>", regex: /<\/body>/gi, name: "</body>" },
    { tag: "<main", regex: /<main\b[^>]*>/gi, name: "<main>" },
    { tag: "</main>", regex: /<\/main>/gi, name: "</main>" }
  ];

  for (const bp of boilerplateTags) {
    let match;
    bp.regex.lastIndex = 0;
    while ((match = bp.regex.exec(content)) !== null) {
      const { line } = getLineAndCol(content, match.index);
      issues.push({
        type: "OUTER_BOILERPLATE",
        tag: bp.name,
        line,
        message: `HTML fragment contains outer boilerplate tag ${bp.name}. Fragments should only contain inner markup.`,
        snippet: match[0].length > 100 ? match[0].slice(0, 97) + "..." : match[0],
        fixable: true,
        suggestedFix: `Strip outer ${bp.name} tag.`
      });
    }
  }

  const headingRegex = /<(h[1-3])(\s+[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let hMatch;
  while ((hMatch = headingRegex.exec(content)) !== null) {
    const fullHeading = hMatch[0];
    const tag = hMatch[1].toLowerCase();
    const attrs = hMatch[2] || "";
    const innerText = hMatch[3] || "";
    const hasId = /\bid\s*=\s*["'][^"']+["']/i.test(attrs);

    if (!hasId) {
      const { line } = getLineAndCol(content, hMatch.index);
      const textPreview = innerText.replace(/<[^>]+>/g, "").trim();
      const generatedSlug = slugify(textPreview);
      issues.push({
        type: "MISSING_HEADING_ID",
        tag,
        line,
        message: `<${tag}> heading "${textPreview}" is missing an 'id' attribute required for Table of Contents navigation.`,
        snippet: fullHeading.length > 100 ? fullHeading.slice(0, 97) + "..." : fullHeading,
        fixable: true,
        suggestedFix: `Add id="${generatedSlug}" to <${tag}>.`
      });
    }
  }

  const tableRegex = /<table\b[\s\S]*?<\/table>/gi;
  let tMatch;
  while ((tMatch = tableRegex.exec(content)) !== null) {
    const tableIndex = tMatch.index;
    const preText = content.slice(Math.max(0, tableIndex - 300), tableIndex);
    const hasResponsiveWrapper = /<div\b[^>]*class\s*=\s*["'][^"']*(?:overflow-x-auto|overflow-auto)[^"']*["'][^>]*>\s*$/i.test(preText);

    if (!hasResponsiveWrapper) {
      const { line } = getLineAndCol(content, tableIndex);
      issues.push({
        type: "BARE_TABLE",
        tag: "table",
        line,
        message: "<table> element lacks responsive horizontal overflow wrapper (<div class=\"overflow-x-auto w-full\">).",
        snippet: tMatch[0].length > 100 ? tMatch[0].slice(0, 97) + "..." : tMatch[0],
        fixable: true,
        suggestedFix: "Wrap <table> in <div class=\"overflow-x-auto w-full\">."
      });
    }
  }

  const stepperTrapRegex = /class\s*=\s*["'][^"']*\bsteps-vertical\s+(?:sm|md|lg|xl):steps-horizontal\b[^"']*["']/gi;
  let sMatch;
  while ((sMatch = stepperTrapRegex.exec(content)) !== null) {
    const { line } = getLineAndCol(content, sMatch.index);
    issues.push({
      type: "STEPPER_RESPONSIVE_TRAP",
      tag: "steps",
      line,
      message: "DaisyUI stepper uses responsive variant 'steps-vertical sm:steps-horizontal', which Tailwind Play CDN does not generate.",
      snippet: sMatch[0].length > 100 ? sMatch[0].slice(0, 97) + "..." : sMatch[0],
      fixable: true,
      suggestedFix: "Replace 'steps-vertical sm:steps-horizontal' with 'steps-horizontal'."
    });
  }

  const canvasRegex = /<canvas\b[^>]*>[\s\S]*?<\/canvas>/gi;
  let cMatch;
  while ((cMatch = canvasRegex.exec(content)) !== null) {
    const canvasIndex = cMatch.index;
    const preText = content.slice(Math.max(0, canvasIndex - 300), canvasIndex);
    const hasBoundedHeightWrapper = /<div\b[^>]*class\s*=\s*["'][^"']*(?:\bh-(?:\d+|full|\[[^\]]+\])|\bmin-h-(?:\d+|full|\[[^\]]+\]))[^"']*["'][^>]*>\s*$/i.test(preText);

    if (!hasBoundedHeightWrapper) {
      const { line } = getLineAndCol(content, canvasIndex);
      issues.push({
        type: "BARE_CANVAS_WRAPPER",
        tag: "canvas",
        line,
        message: "<canvas> element lacks a bounded height parent wrapper (<div class=\"relative h-72 sm:h-80 w-full min-w-0\">).",
        snippet: cMatch[0].length > 100 ? cMatch[0].slice(0, 97) + "..." : cMatch[0],
        fixable: true,
        suggestedFix: "Wrap <canvas> in <div class=\"relative h-72 sm:h-80 w-full min-w-0\">."
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Strips outer boilerplate elements (<head>, <body>, <html>, <!DOCTYPE>, <main>, YAML frontmatter).
 */
export function stripOuterBoilerplate(rawContent = "") {
  let content = String(rawContent).trim();
  const removedTags = [];

  if (content.startsWith("---")) {
    const endMatch = content.slice(3).indexOf("\n---");
    if (endMatch !== -1) {
      content = content.slice(endMatch + 7).trim();
      removedTags.push("frontmatter");
    }
  }

  if (/<head\b[^>]*>[\s\S]*?<\/head>/i.test(content)) {
    content = content.replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "").trim();
    removedTags.push("<head>");
  }

  const bodyMatch = content.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    content = bodyMatch[1].trim();
    removedTags.push("<body>");
  }

  const htmlMatch = content.match(/<html\b[^>]*>([\s\S]*?)<\/html>/i);
  if (htmlMatch) {
    content = htmlMatch[1].trim();
    removedTags.push("<html>");
  }

  const mainMatch = content.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    content = mainMatch[1].trim();
    removedTags.push("<main>");
  }

  const tagsToStrip = [
    /<!DOCTYPE\b[^>]*>/gi,
    /<\/?html\b[^>]*>/gi,
    /<\/?body\b[^>]*>/gi,
    /<\/?main\b[^>]*>/gi
  ];

  for (const regex of tagsToStrip) {
    if (regex.test(content)) {
      content = content.replace(regex, "").trim();
    }
  }

  return {
    content: content.trim(),
    removedTags
  };
}

/**
 * Injects deterministic, slugified unique 'id' attributes into <h1>, <h2>, and <h3> headings lacking them.
 */
export function injectHeadingIds(rawContent = "") {
  let content = String(rawContent);
  const existingIds = collectExistingIds(content);
  const injected = [];

  content = content.replace(/<(h[1-3])(\s+[^>]*)?>([\s\S]*?)<\/\1>/gi, (match, tag, attrs = "", innerContent) => {
    if (/\bid\s*=\s*["'][^"']+["']/i.test(attrs)) {
      return match;
    }

    const text = innerContent.replace(/<[^>]+>/g, "").trim();
    const id = generateUniqueId(text, existingIds);

    injected.push({
      tag: tag.toLowerCase(),
      id,
      text
    });

    const cleanAttrs = attrs.trim();
    const newOpeningTag = cleanAttrs
      ? `<${tag} id="${id}" ${cleanAttrs}>`
      : `<${tag} id="${id}">`;

    return `${newOpeningTag}${innerContent}</${tag}>`;
  });

  return {
    content,
    injectedCount: injected.length,
    injected
  };
}

/**
 * Wraps bare <table> elements in <div class="overflow-x-auto w-full">.
 */
export function wrapBareTables(rawContent = "") {
  let content = String(rawContent);
  let wrappedCount = 0;

  const tableRegex = /<table\b[\s\S]*?<\/table>/gi;
  content = content.replace(tableRegex, (tableHtml, offset, fullString) => {
    const preText = fullString.slice(Math.max(0, offset - 300), offset);
    const hasResponsiveWrapper = /<div\b[^>]*class\s*=\s*["'][^"']*(?:overflow-x-auto|overflow-auto)[^"']*["'][^>]*>\s*$/i.test(preText);

    if (hasResponsiveWrapper) {
      return tableHtml;
    }

    wrappedCount++;
    return `<div class="overflow-x-auto w-full">\n  ${tableHtml}\n</div>`;
  });

  return {
    content,
    wrappedCount
  };
}

/**
 * Normalizes 'steps-vertical sm:steps-horizontal' (and md/lg/xl responsive variants) to 'steps-horizontal'.
 */
export function normalizeResponsiveSteppers(rawContent = "") {
  let content = String(rawContent);
  let fixedCount = 0;

  content = content.replace(/\bsteps-vertical\s+(?:sm|md|lg|xl):steps-horizontal\b/g, () => {
    fixedCount++;
    return "steps-horizontal";
  });

  return {
    content,
    fixedCount
  };
}

/**
 * Wraps bare <canvas> elements lacking a bounded-height parent container in
 * <div class="relative h-72 sm:h-80 w-full min-w-0">.
 */
export function wrapBareCanvases(rawContent = "") {
  let content = String(rawContent);
  let wrappedCount = 0;

  const canvasRegex = /<canvas\b[^>]*>[\s\S]*?<\/canvas>/gi;
  content = content.replace(canvasRegex, (canvasHtml, offset, fullString) => {
    const preText = fullString.slice(Math.max(0, offset - 300), offset);
    const hasBoundedHeightWrapper = /<div\b[^>]*class\s*=\s*["'][^"']*(?:\bh-(?:\d+|full|\[[^\]]+\])|\bmin-h-(?:\d+|full|\[[^\]]+\]))[^"']*["'][^>]*>\s*$/i.test(preText);

    if (hasBoundedHeightWrapper) {
      return canvasHtml;
    }

    wrappedCount++;
    return `<div class="relative h-72 sm:h-80 w-full min-w-0">\n  ${canvasHtml}\n</div>`;
  });

  return {
    content,
    wrappedCount
  };
}

/**
 * Orchestrates mechanical auto-fix transforms on raw HTML fragment.
 */
export function autoFixFragment(rawContent = "", options = {}) {
  const {
    stripBoilerplate = true,
    injectHeadings = true,
    wrapTables = true,
    fixSteppers = true,
    wrapCanvases = true
  } = options;

  let current = String(rawContent);
  const fixesApplied = [];

  if (stripBoilerplate) {
    const stripRes = stripOuterBoilerplate(current);
    if (stripRes.removedTags.length > 0) {
      fixesApplied.push({
        type: "STRIPPED_BOILERPLATE",
        description: `Stripped outer boilerplate wrappers: ${stripRes.removedTags.join(", ")}`,
        count: stripRes.removedTags.length,
        details: stripRes.removedTags
      });
      current = stripRes.content;
    }
  }

  if (injectHeadings) {
    const headingRes = injectHeadingIds(current);
    if (headingRes.injectedCount > 0) {
      fixesApplied.push({
        type: "INJECTED_HEADING_IDS",
        description: `Injected unique 'id' attributes into ${headingRes.injectedCount} heading(s).`,
        count: headingRes.injectedCount,
        details: headingRes.injected
      });
      current = headingRes.content;
    }
  }

  if (wrapTables) {
    const tableRes = wrapBareTables(current);
    if (tableRes.wrappedCount > 0) {
      fixesApplied.push({
        type: "WRAPPED_BARE_TABLES",
        description: `Wrapped ${tableRes.wrappedCount} bare <table> element(s) with responsive overflow container.`,
        count: tableRes.wrappedCount
      });
      current = tableRes.content;
    }
  }

  if (fixSteppers) {
    const stepperRes = normalizeResponsiveSteppers(current);
    if (stepperRes.fixedCount > 0) {
      fixesApplied.push({
        type: "STEPPER_RESPONSIVE_TRAP",
        description: `Normalized ${stepperRes.fixedCount} responsive stepper class(es) to 'steps-horizontal'.`,
        count: stepperRes.fixedCount
      });
      current = stepperRes.content;
    }
  }

  if (wrapCanvases) {
    const canvasRes = wrapBareCanvases(current);
    if (canvasRes.wrappedCount > 0) {
      fixesApplied.push({
        type: "BARE_CANVAS_WRAPPER",
        description: `Wrapped ${canvasRes.wrappedCount} bare <canvas> element(s) with bounded height container.`,
        count: canvasRes.wrappedCount
      });
      current = canvasRes.content;
    }
  }

  return {
    content: current,
    fixesApplied
  };
}
