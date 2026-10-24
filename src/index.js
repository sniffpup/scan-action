"use strict";
const fs = require("node:fs");
const { parseInputs, reportUrl, runScan, summarize, formatText, formatMarkdown, meetsThreshold } = require("./sniffpup");

const input = (name) => process.env[`INPUT_${name.replace(/ /g, "_").toUpperCase()}`] || "";
const setOutput = (k, v) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${String(v).replace(/[\r\n]/g, " ")}\n`); };
const summaryOut = (md) => { if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md); };
const esc = (s) => String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

async function main(fetchImpl = fetch) {
  let opts;
  try { opts = parseInputs(input); } catch (e) { console.log(`::error::${esc(e.message)}`); return 1; }
  console.log(`Scanning ${opts.url} with SniffPup (passive, read-only)…`);
  const r = await runScan(opts, fetchImpl);
  if (!r.ok) {
    const msg = `SniffPup scan didn't run: ${r.message}${r.retryAfter ? ` (try again in ${r.retryAfter}s)` : ""}`;
    console.log(`${opts.failOnScanError ? "::error::" : "::warning::"}${esc(msg)}`);
    setOutput("score", ""); setOutput("passed", opts.failOnScanError ? "false" : "true");
    return opts.failOnScanError ? 1 : 0;
  }
  const s = summarize(r.data);
  const link = reportUrl(opts.base, r.data, opts.url);
  const passed = meetsThreshold(s.score, opts.threshold);
  console.log(formatText(s, link, opts.threshold));
  summaryOut(formatMarkdown(s, link, opts.threshold, passed));
  setOutput("score", s.score); setOutput("report-url", link); setOutput("critical", s.counts.critical); setOutput("high", s.counts.high); setOutput("passed", passed);
  if (!passed) { console.log(`::error::${esc(`SniffPup score ${s.score} is below the threshold ${opts.threshold}. Full report: ${link}`)}`); return 1; }
  return 0;
}

if (require.main === module) main().then((code) => process.exit(code), (e) => { console.log(`::error::${esc(e && e.message)}`); process.exit(1); });
module.exports = { main };
