"use strict";
/**
 * Pure helpers for the SniffPup GitHub Action. No dependencies.
 * Uses only SniffPup's existing public free-scan endpoint: POST {api-base}/api/scan
 * with JSON { url, consent: "true", utm_* tags }. Same rules and limits as a scan from the website.
 */

const UTM = "utm_source=github-action&utm_medium=ci&utm_campaign=github-action";
const SEVERITIES = ["critical", "high", "medium", "low", "info"];

function parseInputs(get) {
  const url = (get("url") || "").trim();
  if (!/^https?:\/\/[^\s/]+/i.test(url)) throw new Error('Input "url" must be a full http(s) URL, e.g. https://my-app.example.com');
  if ((get("consent") || "").trim().toLowerCase() !== "true") {
    throw new Error('Input "consent" must be "true": it confirms you own this site or are authorized to test it, and agree to SniffPup\'s Terms and Acceptable Use Policy.');
  }
  const thrRaw = (get("threshold") || "0").trim();
  const threshold = Number(thrRaw);
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100) throw new Error('Input "threshold" must be a whole number from 0 to 100');
  const base = (get("api-base") || "https://sniffpup.com").trim().replace(/\/+$/, "");
  if (!/^https:\/\/[^\s/]+$/i.test(base) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(base)) throw new Error('Input "api-base" must be an https origin');
  const timeout = Number((get("timeout-seconds") || "90").trim());
  return {
    url,
    threshold,
    base,
    failOnScanError: (get("fail-on-scan-error") || "false").trim().toLowerCase() === "true",
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? Math.min(timeout, 300) * 1000 : 90_000,
  };
}

function reportUrl(base, data, siteUrl) {
  if (data && typeof data.id === "string" && /^[0-9a-f-]{36}$/i.test(data.id)) return `${base}/scan/${data.id}?${UTM}`;
  return `${base}/?url=${encodeURIComponent(siteUrl)}&${UTM}`;
}

async function runScan({ url, base, timeoutMs }, fetchImpl = fetch) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${base}/api/scan`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", "user-agent": "sniffpup-github-action/1.0" },
      // UTM tags let SniffPup count scans from this Action (existing source tracking; no personal data).
      body: JSON.stringify({ url, consent: "true", utm_source: "github-action", utm_medium: "ci", utm_campaign: "github-action" }),
      signal: ctrl.signal,
    });
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    if (!res.ok) {
      const msg = body && typeof body.error === "string" ? body.error : `HTTP ${res.status}`;
      return { ok: false, status: res.status, code: body && body.code, message: msg, retryAfter: body && body.retry_after };
    }
    if (!body || typeof body.score !== "number") return { ok: false, status: res.status, message: "Unexpected response from SniffPup" };
    return { ok: true, data: body };
  } catch (e) {
    return { ok: false, status: 0, message: e && e.name === "AbortError" ? `No response within ${Math.round(timeoutMs / 1000)}s` : `Network error: ${e && e.message}` };
  } finally {
    clearTimeout(t);
  }
}

/** Only what the free web report already shows by title: severity + title. Never evidence or fix steps. */
function summarize(data) {
  const findings = Array.isArray(data.findings) ? data.findings : [];
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, Number(data.counts && data.counts[s]) || 0]));
  const items = findings
    .filter((f) => f && typeof f.title === "string" && SEVERITIES.includes(f.severity))
    .map((f) => ({ severity: f.severity, title: oneLine(f.title), fixInReport: f.locked === false && !!f.fix }));
  return { score: data.score, counts, items };
}

const oneLine = (s) => String(s).replace(/[\r\n\t]+/g, " ").replace(/::/g, ": :").slice(0, 200);

function formatText(summary, link, threshold) {
  const lines = [`SniffPup score: ${summary.score}/100${threshold ? ` (threshold ${threshold})` : ""}`];
  const c = summary.counts;
  lines.push(`Findings: ${c.critical} critical, ${c.high} high, ${c.medium} medium, ${c.low} low`);
  for (const f of summary.items) if (f.severity !== "info") lines.push(`  [${f.severity}] ${f.title}${f.fixInReport ? " (free fix in the report)" : ""}`);
  lines.push(`Full report: ${link}`);
  return lines.join("\n");
}

const mdEsc = (s) => String(s).replace(/[|<>]/g, (ch) => ({ "|": "\\|", "<": "&lt;", ">": "&gt;" })[ch]);
function formatMarkdown(summary, link, threshold, passed) {
  const c = summary.counts;
  const rows = summary.items.filter((f) => f.severity !== "info").map((f) => `| ${f.severity} | ${mdEsc(f.title)} |`);
  return [
    `### SniffPup scan: ${summary.score}/100 ${threshold ? (passed ? "(meets threshold " + threshold + ")" : "(below threshold " + threshold + ")") : ""}`.trim(),
    "",
    `${c.critical} critical · ${c.high} high · ${c.medium} medium · ${c.low} low`,
    "",
    ...(rows.length ? ["| Severity | Finding |", "| --- | --- |", ...rows, ""] : ["No issues found in this passive scan.", ""]),
    `[Open the full report on SniffPup](${link})`,
    "",
  ].join("\n");
}

const meetsThreshold = (score, threshold) => !threshold || score >= threshold;

module.exports = { UTM, parseInputs, reportUrl, runScan, summarize, formatText, formatMarkdown, meetsThreshold };
