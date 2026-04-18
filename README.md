# LinkedIn Personal Branding MCP

A local MCP server that uses Playwright to open a LinkedIn profile in a real browser session, extract the visible profile sections, and return a structured JSON payload designed for personal branding analysis.

## What this repo does

- boots a local MCP server over **stdio**
- uses **Playwright** for browser-driven extraction
- saves a timestamped JSON export under `exports/`
- provides a CLI extractor for manual runs
- includes a simple export comparison script

## Recommended use

Use this as a **read-only** data feeder for your branding workflow:

1. extract your profile
2. pass the JSON to ChatGPT
3. get an audit, rewrite, or positioning review
4. apply changes manually on LinkedIn

## Safety notes

This project is intentionally conservative:

- it does **not** write back to LinkedIn
- it uses a real authenticated browser session saved locally in `state.json`
- it is meant for occasional personal use, not high-frequency scraping

You should still review LinkedIn's terms and only use it on your own account and at a human pace.

## Prerequisites

- Node.js 18+
- npm
- a local desktop session where you can complete LinkedIn login once

## Install

```bash
npm install
npx playwright install chromium
cp .env.example .env
```

Then edit `.env` and set:

```bash
LINKEDIN_PROFILE_URL=https://www.linkedin.com/in/your-public-slug/
HEADLESS=false
```

## First login bootstrap

Run:

```bash
npm run login
```

A browser window opens on LinkedIn login.

1. complete login manually
2. wait until you land on your feed or profile
3. come back to the terminal and press Enter

This saves the browser session into `state.json`.

## Manual extraction

```bash
npm run extract -- https://www.linkedin.com/in/your-public-slug/
```

Or rely on the URL in `.env`:

```bash
npm run extract
```

The script writes a file like:

```text
exports/linkedin_profile_2026-04-18T09-31-22.222Z.json
```

## Start the MCP server

```bash
npm run dev
```

The server exposes one tool:

- `extract_profile`

### Tool input

```json
{
  "profile_url": "https://www.linkedin.com/in/your-public-slug/",
  "save_to_exports": true,
  "include_recent_posts": true
}
```

### Tool output

A structured JSON payload like the example in `examples/profile-template.json`.

## Compare two exports

```bash
npm run compare -- exports/old.json exports/new.json
```

This prints a small diff summary, useful to see whether your profile changed over time.

## Repo structure

```text
src/
  browser.ts           Playwright browser/context setup
  config.ts            environment configuration
  extractor.ts         profile extraction logic
  extract-cli.ts       run extraction manually
  index.ts             MCP server entrypoint
  login.ts             one-time login bootstrap
  compare-exports.ts   compare two JSON exports
  types.ts             output schema
  utils.ts             helpers
examples/
  profile-template.json
exports/
```

## Known limits

LinkedIn changes markup frequently, so selectors may need adjustment over time. The extractor is designed as a practical starting point, not as a forever-stable connector.

The most reliable sections are usually:

- headline
- about
- experience
- skills

Featured and recent posts are more brittle because their layout changes more often.

## How to use the output with ChatGPT

Once you have an export, upload the JSON here and ask for one of these:

- "Audit my LinkedIn profile for VP-level positioning"
- "Rewrite my headline and about section"
- "Check consistency between profile and my recent posts"
- "Suggest what to add to Featured"

## Next upgrades worth adding

- stronger section-specific selectors
- markdown export alongside JSON
- optional screenshots for debugging
- richer post extraction
- a lightweight UI
- versioned branding snapshots
