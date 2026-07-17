# News Snapshotter

News Snapshotter is a React SPA and Cloudflare Worker that captures and displays
full-page screenshots of configured websites. Browser Rendering stores a full PNG
and JPEG thumbnail for each capture in R2. Opted-in desktop sites also preserve
sanitised, compressed rendered HTML and extraction metadata in a separate private
R2 bucket.

## Architecture

Screenshots use deterministic Hive-style R2 partitions:

```text
brand=bbc/category=sport/date=2026-07-16/bbc-football-2026-07-16T12-34-56-789Z.png
```

Using the workflow trigger time in the key makes captures idempotent. R2 object metadata records that `triggeredAt` time separately from `capturedAt`, which is set immediately before each device screenshot is taken. The gallery sorts, filters, and displays the actual capture time while using the trigger time to associate desktop and mobile variants from the same run.

## Capture profiles

Brand profiles in `src/capture-profiles.ts` control desktop and mobile viewports, user agents, JavaScript, cookies, navigation timeouts, image waits, scrolling, screenshot formats, thumbnails, consent selectors, and failure indicators. Sites use their brand profile by default and can name another profile explicitly.

Every configured device is captured once per workflow run. There are no same-run retries. HTTP errors, known challenge selectors, captcha or access-denied text, and blank pages are treated as failed captures before screenshots are stored.

Failures are written to the `CAPTURE_FAILURES` KV namespace under a date partition and retained for 90 days. Records contain the site, brand, category, device, reason, source URL, and capture timestamps. Wrangler automatically provisions the namespace when it is first deployed.

## API

Every request requires `Authorization: Bearer <API_KEY>`.

The examples below target the local Wrangler server configured on port `8787`:

```sh
BASE_URL=http://localhost:8787
```

For a deployed Worker, set `BASE_URL` to the route configured in `wrangler.json`.

Start a workflow for every configured site:

```sh
curl -X POST "$BASE_URL/api/workflows" \
  -H "Authorization: Bearer $API_KEY"
```

Capture every site for a brand:

```sh
curl -X POST "$BASE_URL/api/workflows" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"brand":"bbc"}'
```

Capture one named site:

```sh
curl -X POST "$BASE_URL/api/workflows" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"bbc-football"}'
```

`brand` and `name` are mutually exclusive. Unknown values return `400`; successful workflow creation returns `202` with the workflow ID and selected sites.

Check workflow status:

```sh
curl "$BASE_URL/api/workflows/<WORKFLOW_ID>" \
  -H "Authorization: Bearer $API_KEY"
```

The public gallery uses `GET /api/screenshots`, `GET /api/screenshots/image`, and `GET /api/catalogue`.

## Website

The archive at `/` groups captures by date and filters them by search text, brand, and category. Selecting a thumbnail opens the full-page screenshot in a modal.

The `/admin` page starts a workflow for all sites, one brand, or one named site. The API key remains in memory for the current page session and is not written to browser storage.

The archive displays each captured source URL and links visitors to the original publisher. An independent-archive disclosure appears below the gallery, with separate `/terms` and `/privacy` pages.

The contact modal posts to `POST /api/contact`. It sends rights-holder, privacy, and general enquiries to `pashi@nicholasgriffin.dev` through Cloudflare Email Service. The endpoint uses a honeypot, a minimum completion time, strict field limits, a fixed sender and recipient, and Cloudflare's native rate limiter.

## Catalogue

Site definitions live in `src/sites`. `src/constants.ts` composes every provider list into the active catalogue and assigns each site a `brand`; each definition supplies a unique `name`, a `category` of `news` or `sport`, and a fixed HTTPS URL.

Provider-backed local sites use their parent brand, such as `bbc`, `itv`, `reach`, or `newsquest`. Standalone sites in `other.ts` use their site name as the brand.

## Configuration

The Worker requires these bindings:

- `BROWSER`: Cloudflare Browser Rendering
- `NEWS_SNAPSHOTTER`: Cloudflare Workflow
- `SCREENSHOTS`: R2 bucket
- `ARCHIVE_DATA`: private R2 bucket for compressed HTML and extraction artefacts
- `CAPTURE_FAILURES`: Workers KV namespace for failed captures
- `CONTACT_EMAIL`: restricted Email Service binding for archive enquiries
- `CONTACT_RATE_LIMIT`: native Rate Limiting binding for contact submissions
- `API_KEY`: secret used to authenticate requests

Create the production and preview R2 buckets, then set the API secret:

```sh
pnpm wrangler r2 bucket create news-snapshotter
pnpm wrangler r2 bucket create news-snapshotter-preview
pnpm wrangler r2 bucket create news-snapshotter-archive-data
pnpm wrangler r2 bucket create news-snapshotter-archive-data-preview
pnpm wrangler secret put API_KEY
```

Before deploying contact email, onboard your email with Cloudflare Email Service.

`wrangler.json` contains the deployable binding configuration. `wrangler.toml.example` shows the equivalent TOML shape.

## Development

Install dependencies and generate binding types after changing Wrangler configuration:

```sh
pnpm install
pnpm run cf-typegen
```

Run static validation before deployment:

```sh
pnpm run check
```

Deploy with:

```sh
pnpm run deploy
```
