# GitHub Marketplace listing (draft, not published)

**Name:** SniffPup Scan
**Category:** Security (primary), Continuous integration (secondary)
**Icon / color:** shield, orange (set in action.yml `branding`)

**Short description (≤125 chars):**
Free passive security scan of your deployed app after every push: score, findings and a link to the full report.

**Listing body:**

Ship fast without shipping your secrets. SniffPup Scan runs SniffPup's free, passive security scan on your live app after each deploy and tells you what anyone on the internet can already see:

- leaked API keys in your JavaScript (OpenAI, Anthropic, Stripe, Supabase and more, always masked)
- exposed files like `/.env` and `/.git`
- missing security headers, insecure cookies, public source maps

You get a 0-100 Sniff score, each finding's severity and title right in the job log and summary, and a link to the full report on sniffpup.com, with full fixes free for every critical issue (with no critical, one other fix is free). Set a threshold to fail the build when the score drops.

Made for vibe-coded apps built with Lovable, Bolt, Cursor, Replit and v0, and it works on any public site.

Passive and read-only: no logins, no form submissions, no attacks. Only scan sites you own or are authorized to test.

**Setup (3 lines):**
```yaml
- uses: sniffpup/scan-action@v1
  with: { url: https://my-app.example.com, consent: "true", threshold: "80" }
```

**Tags/keywords:** security, scanner, secrets, vibe coding, lovable, supabase, ci

## Before publishing (needs the user's decision)
1. Create a public GitHub repo (e.g. `sniffpup/scan-action`; the `uses:` lines above assume that name). Marketplace requires the action at the repo root and a unique action name.
2. Accept the GitHub Marketplace Developer Agreement with the account that owns the repo (2FA required).
3. Tag `v1.0.0` and move a `v1` tag, then "Draft a release" → "Publish this Action to the GitHub Marketplace".
