"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { parseInputs, reportUrl, runScan, summarize, formatText, formatMarkdown, meetsThreshold, UTM } = require("../src/sniffpup");
const { main } = require("../src/index");

const ID = "0b9e2f3c-1a2b-4c5d-8e9f-0123456789ab";
const sample = {
  id: ID, score: 72, url: "https://my-app.example.dev/", counts: { critical: 1, high: 1, medium: 0, low: 1, info: 1 },
  findings: [
    { id: "secret:x", severity: "critical", title: "Supabase service_role key in your JavaScript", locked: false, summary: "evidence-ish summary", evidence: ["sk_live_MASKED"], fix: { steps: [] } },
    { id: "hdr:csp", severity: "high", title: "Missing Content-Security-Policy\n::set-output name=x::y", locked: true },
    { id: "cookie", severity: "low", title: "Cookie without Secure flag", locked: true },
    { id: "info:x", severity: "info", title: "Info note", locked: false },
  ],
};
const inputs = (o) => (k) => ({ url: "https://my-app.example.dev", consent: "true", ...o })[k];

test("parseInputs requires a URL and explicit consent", () => {
  assert.throws(() => parseInputs(inputs({ url: "my-app.dev" })), /full http\(s\) URL/);
  assert.throws(() => parseInputs(inputs({ consent: "" })), /consent/);
  assert.throws(() => parseInputs(inputs({ consent: "yes" })), /consent/);
  assert.throws(() => parseInputs(inputs({ threshold: "101" })), /threshold/);
  assert.throws(() => parseInputs(inputs({ threshold: "7.5" })), /threshold/);
  assert.throws(() => parseInputs(inputs({ "api-base": "http://evil.example" })), /api-base/);
  const o = parseInputs(inputs({ threshold: "80" }));
  assert.equal(o.threshold, 80);
  assert.equal(o.base, "https://sniffpup.com");
  assert.equal(o.failOnScanError, false);
});

test("calls only POST /api/scan with url + consent, nothing else", async () => {
  let seen;
  const fake = async (u, init) => { seen = { u, init }; return { ok: true, status: 200, json: async () => sample }; };
  const r = await runScan({ url: "https://my-app.example.dev", base: "https://sniffpup.com", timeoutMs: 5000 }, fake);
  assert.equal(r.ok, true);
  assert.equal(seen.u, "https://sniffpup.com/api/scan");
  assert.equal(seen.init.method, "POST");
  assert.deepEqual(JSON.parse(seen.init.body), { url: "https://my-app.example.dev", consent: "true" });
  assert.ok(!("authorization" in seen.init.headers));
});

test("passes API errors through (rate limit, consent, unreachable)", async () => {
  const fake = async () => ({ ok: false, status: 429, json: async () => ({ error: "Easy, pup!", code: "rate_limited", retry_after: 600 }) });
  const r = await runScan({ url: "https://a.dev", base: "https://sniffpup.com", timeoutMs: 5000 }, fake);
  assert.deepEqual([r.ok, r.status, r.code, r.retryAfter], [false, 429, "rate_limited", 600]);
  const net = await runScan({ url: "https://a.dev", base: "https://sniffpup.com", timeoutMs: 5000 }, async () => { throw new Error("ECONNRESET"); });
  assert.match(net.message, /Network error/);
});

test("prints score + titles only, never evidence; strips workflow-command injection from titles", () => {
  const s = summarize(sample);
  const link = reportUrl("https://sniffpup.com", sample, "https://my-app.example.dev");
  const text = formatText(s, link, 80);
  assert.match(text, /SniffPup score: 72\/100 \(threshold 80\)/);
  assert.match(text, /\[critical\] Supabase service_role key in your JavaScript \(free fix in the report\)/);
  assert.match(text, /\[high\] Missing Content-Security-Policy : :set-output/);
  assert.doesNotMatch(text, /sk_live|evidence-ish|Info note|\n::/);
  assert.doesNotMatch(text, /\$\d|price/i);
  assert.equal(link, `https://sniffpup.com/scan/${ID}?${UTM}`);
  assert.equal(UTM, "utm_source=github-action&utm_medium=ci&utm_campaign=github-action");
  assert.equal(reportUrl("https://sniffpup.com", { id: null }, "https://a.dev/x"), `https://sniffpup.com/?url=https%3A%2F%2Fa.dev%2Fx&${UTM}`);
  const md = formatMarkdown(s, link, 80, false);
  assert.match(md, /below threshold 80/);
  assert.match(md, /\| high \| Missing Content-Security-Policy/);
});

test("threshold logic", () => {
  assert.equal(meetsThreshold(72, 0), true);
  assert.equal(meetsThreshold(72, 72), true);
  assert.equal(meetsThreshold(72, 80), false);
});

function withServer(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer(handler).listen(0, "127.0.0.1", () => resolve(srv));
  });
}
async function runMain(env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sp-action-"));
  const out = path.join(dir, "out"), sum = path.join(dir, "sum");
  const saved = { ...process.env };
  Object.assign(process.env, { GITHUB_OUTPUT: out, GITHUB_STEP_SUMMARY: sum, INPUT_CONSENT: "true", INPUT_URL: "https://my-app.example.dev", ...env });
  const logs = []; const orig = console.log; console.log = (m) => logs.push(String(m));
  try {
    const code = await main();
    return { code, logs: logs.join("\n"), out: fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "", sum: fs.existsSync(sum) ? fs.readFileSync(sum, "utf8") : "" };
  } finally {
    console.log = orig;
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
}

test("end to end against a local fake SniffPup: passes, fails below threshold, warns on scan errors", async () => {
  let mode = "ok";
  const srv = await withServer((req, res) => {
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
      assert.equal(req.url, "/api/scan");
      if (mode === "ok") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(sample)); }
      else { res.writeHead(429, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "Easy, pup!", code: "rate_limited", retry_after: 60 })); }
    });
  });
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    let r = await runMain({ "INPUT_API-BASE": base, INPUT_THRESHOLD: "70" });
    assert.equal(r.code, 0);
    assert.match(r.out, /score=72\n/);
    assert.match(r.out, /passed=true/);
    assert.match(r.out, new RegExp(`report-url=${base}/scan/${ID}\\?utm_source=github-action`));
    assert.match(r.sum, /### SniffPup scan: 72\/100/);
    r = await runMain({ "INPUT_API-BASE": base, INPUT_THRESHOLD: "80" });
    assert.equal(r.code, 1);
    assert.match(r.logs, /::error::SniffPup score 72 is below the threshold 80/);
    mode = "limited";
    r = await runMain({ "INPUT_API-BASE": base });
    assert.equal(r.code, 0);
    assert.match(r.logs, /::warning::SniffPup scan didn't run: Easy, pup! \(try again in 60s\)/);
    r = await runMain({ "INPUT_API-BASE": base, "INPUT_FAIL-ON-SCAN-ERROR": "true" });
    assert.equal(r.code, 1);
    r = await runMain({ "INPUT_API-BASE": base, INPUT_CONSENT: "" });
    assert.equal(r.code, 1);
    assert.match(r.logs, /::error::Input "consent" must be "true"/);
  } finally {
    srv.close();
  }
});

test("action.yml points at src/index.js on node20 and declares the inputs", () => {
  const y = fs.readFileSync(path.join(__dirname, "..", "action.yml"), "utf8");
  assert.match(y, /using: "node20"/);
  assert.match(y, /main: "src\/index.js"/);
  for (const k of ["url:", "consent:", "threshold:", "fail-on-scan-error:", "api-base:"]) assert.ok(y.includes(k), k);
});
