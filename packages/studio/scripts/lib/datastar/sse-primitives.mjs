/**
 * Zero-dependency Server-Sent Events (SSE) & Datastar protocol primitives.
 */

export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sendSSE(res, event, dataLines) {
  if (!res || res.writableEnded) return;
  const lines = [`event: ${event}`];
  const list = Array.isArray(dataLines) ? dataLines : [dataLines];
  for (const item of list) {
    if (typeof item === "string") {
      for (const sub of item.split("\n")) {
        lines.push(`data: ${sub}`);
      }
    } else {
      lines.push(`data: ${JSON.stringify(item)}`);
    }
  }
  res.write(lines.join("\n") + "\n\n");
}

export function buildFragmentEvents({ selector, mergeMode = "outer", merge, html = "" } = {}) {
  const resolvedMerge = merge || mergeMode || "outer";
  const fragmentLines = String(html || "").replace(/\r\n/g, "\n").trim().split("\n");

  const mergeData = [];
  if (selector) mergeData.push(`selector ${selector}`);
  if (resolvedMerge && resolvedMerge !== "outer" && resolvedMerge !== "morph") {
    mergeData.push(`mergeMode ${resolvedMerge}`);
  }
  for (const line of fragmentLines) {
    mergeData.push(`fragments ${line}`);
  }

  const legacyData = [];
  if (selector) legacyData.push(`selector ${selector}`);
  if (resolvedMerge) legacyData.push(`merge ${resolvedMerge}`);
  for (const line of fragmentLines) {
    legacyData.push(`fragment ${line}`);
  }

  return { mergeData, legacyData };
}

export function sendFragment(res, options = {}) {
  const { mergeData, legacyData } = buildFragmentEvents(options);
  sendSSE(res, "datastar-merge-fragments", mergeData);
  sendSSE(res, "datastar-fragment", legacyData);
}

export function sendSignals(res, signals) {
  const payload = typeof signals === "string" ? signals : JSON.stringify(signals);
  sendSSE(res, "datastar-merge-signals", [`signals ${payload}`]);
}

export function removeFragment(res, selector) {
  sendSSE(res, "datastar-remove-fragments", [`selector ${selector}`]);
}

export function executeScript(res, script) {
  sendSSE(res, "datastar-execute-script", [`script ${script}`]);
}
