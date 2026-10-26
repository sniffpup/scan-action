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

## Readiness (checked Oct 26, 2026)
- action.yml at repo root, only one action metadata file: OK.
- Name "SniffPup Scan": not taken on GitHub Marketplace, not a GitHub user/org name, not a category: OK.
- branding: icon `shield`, color `orange` (allowed values; orange is the closest to our amber): OK.
- runs.using `node24` (GitHub removed Node 20 from runners on Sep 23, 2026; node20 actions would fail): FIXED.
- No dependencies to bundle (only node: built-ins), so no dist/ build step: OK.
- README with usage, inputs, outputs, limits, consent: OK. LICENSE (MIT): OK.
- Tests: 7/7 on Node 20 and Node 24. CI workflow uses checkout@v5 / setup-node@v5 on Node 24.
- Local tags v1.0.0 and v1 point at the release commit (not pushed).

## Steps for Ember and Saru (needs the @sniffpup GitHub login and 2FA)
1. Sign in to GitHub as @sniffpup. Make sure two-factor authentication is on (Settings → Password and authentication); publishing to Marketplace requires it.
2. Create a new **public** repository named `scan-action` under @sniffpup (no README, no license, no .gitignore, so it starts empty).
3. Tell me it exists and I push the local repo: `git remote add origin https://github.com/sniffpup/scan-action.git && git push -u origin main && git push origin v1.0.0 v1` (or run that yourself from this folder).
4. On github.com/sniffpup/scan-action, open `action.yml` and click **Draft a release** in the banner.
5. Tick **Publish this Action to the GitHub Marketplace**. If it's greyed out, click the link to accept the **GitHub Marketplace Developer Agreement**, accept it, and come back.
6. Wait for "Everything looks good!". Primary category: **Security**. Second category: **Continuous integration**.
7. Choose the existing tag **v1.0.0**. Title: `v1.0.0`. Notes: the short description above.
8. Click **Publish release** and confirm with your 2FA code.
9. Later releases: tag `v1.x.y`, then move `v1` to it (`git tag -f v1 && git push -f origin v1`) so `@v1` users get the update.
