# SniffPup Scan (GitHub Action)

Run [SniffPup](https://sniffpup.com/?utm_source=github-action&utm_medium=readme&utm_campaign=github-action)'s free, passive security scan on your **deployed** app from a GitHub workflow. It prints your Sniff score and the titles of what it found, links to the full report, and can fail the build when the score drops below a threshold you choose.

Built for vibe-coded apps (Lovable, Bolt, Cursor, Replit, v0) and any public website.

## What it does
- Calls SniffPup's existing public free-scan API (`POST https://sniffpup.com/api/scan`), exactly like a scan from the website. Same checks, same free report, same limits.
- The scan is **passive and read-only**: it looks at what anyone can see on your live site (JavaScript bundles for leaked keys, exposed files like `/.env`, security headers, cookies, source maps and more). It never logs in, submits forms or attacks anything.
- Prints the score, a count by severity and each finding's severity + title. It never prints evidence or secrets into your logs.
- Writes a short summary to the job summary page and sets outputs (`score`, `report-url`, `critical`, `high`, `passed`).
- The full report link opens the same report you'd get on the website, including the full fixes free for every critical issue (with no critical, one other fix is free).

## Usage
```yaml
- uses: sniffpup/scan-action@v1
  with:
    url: https://my-app.example.com
    consent: "true"   # you own this site or are authorized to test it
    threshold: "80"   # optional: fail below 80 (default 0 = never fail on score)
```
See [`examples/workflow.yml`](examples/workflow.yml) for a full workflow.

### Inputs
| Input | Required | Default | What it does |
| --- | --- | --- | --- |
| `url` | yes | | Public URL of the deployed site. |
| `consent` | yes | | Must be `"true"`. Confirms you own the site or are authorized to test it and agree to the [Terms](https://sniffpup.com/legal/terms) and [Acceptable Use Policy](https://sniffpup.com/legal/acceptable-use). |
| `threshold` | no | `0` | Fail the job if the score is below this (0-100). |
| `fail-on-scan-error` | no | `false` | Fail the job if the scan can't run (unreachable, rate limited, blocked). Otherwise it's a warning. |
| `timeout-seconds` | no | `90` | How long to wait for the scan. |
| `api-base` | no | `https://sniffpup.com` | Leave as is. |

### Outputs
`score`, `report-url`, `critical`, `high`, `passed` (`"true"`/`"false"`).

## Limits
The Action uses the same free-scan limits as the website, so scanning once per deploy is the sweet spot. If a scan is rate limited, the step logs a warning and moves on (unless you set `fail-on-scan-error: "true"`). GitHub-hosted runners share IP addresses with other users, so you may occasionally hit the per-network limit; try again later or re-run the job.

## Only scan sites you own
Only point this at sites you own or have permission to test. SniffPup refuses some sites (for example government, military and banking sites, and sites whose owners have opted out).

## License
MIT
