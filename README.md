# News Snapshotter

News Snapshotter is a Cloudflare Worker that captures and displays
full-page screenshots of configured websites.

## Architecture

The source is organised as a feature-first modular monolith:

- `src/core` owns shared domain and transport contracts.
- `src/features` owns capture, workflow, archive, catalogue, and contact behaviour.
- Feature `application` modules orchestrate use cases, `domain` modules hold policy, `adapters` implement variable providers, and `infrastructure` modules persist data or integrate with external runtimes.
- `src/platform` adapts Cloudflare bindings and HTTP requests to feature use cases.
- `src/react-app/features` groups UI behaviour by user-facing feature; its `platform`, `core`, and `shared` folders contain transport, view contracts, and genuinely cross-feature presentation logic.
- Tests are colocated with the module interface they exercise.

Screenshots use deterministic Hive-style R2 partitions:

```text
brand=bbc/category=sport/date=2026-07-16/bbc-football-2026-07-16T12-34-56-789Z.png
```

Using the workflow trigger time in the key makes captures idempotent. R2 object metadata records that `triggeredAt` time separately from `capturedAt`, which is set immediately before each device screenshot is taken. The gallery sorts, filters, and displays the actual capture time while using the trigger time to associate desktop and mobile variants from the same run.

## Catalogue

Site definitions live in `src/features/catalogue/domain/sites`. `src/features/catalogue/domain/sites.ts`.

Each definition supplies a unique `name`, a `category` of `news` or `sport`, a fixed HTTPS URL, and a capture priority, which will be assigned if not supplied. The priorities are:

- `1` — primary publisher home routes
- `2` — major news and sport section fronts
- `3` — specialist categories, topics, and subsections
- `4` — local and regional pages

## Capture profiles

Brand profiles in `src/features/capture/domain/profiles.ts` control desktop and mobile viewports, user agents, JavaScript, cookies, navigation timeouts, image waits, scrolling, screenshot formats, thumbnails, consent selectors, and failure indicators. Sites use their brand profile by default and can name another profile explicitly.

Every configured device is captured once per workflow run. There are no same-run retries. HTTP errors, known challenge selectors, captcha or access-denied text, and blank pages are treated as failed captures before screenshots are stored.

Failures are written to the `CAPTURE_FAILURES` KV namespace under a date partition and retained for 90 days. Records contain the site, brand, category, device, reason, source URL, and capture timestamps. Wrangler automatically provisions the namespace when it is first deployed.

## API

Screenshot, catalogue, and history reads are public. Workflow and admin requests require
`Authorization: Bearer <API_KEY>`.

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

Check workflow status:

```sh
curl "$BASE_URL/api/workflows/<WORKFLOW_ID>" \
  -H "Authorization: Bearer $API_KEY"
```

The website uses `GET /api/screenshots`, `GET /api/screenshots/image`, and `GET /api/catalogue` to display the archive.

Analysed history is exposed through bounded public reads:

```text
GET /api/history/:site/captures?from=&to=&limit=&cursor=
GET /api/history/:site/captures/:captureId
GET /api/history/:site/stories/:storyId?from=&to=&limit=&cursor=
GET /api/history/:site/changes?from=&to=&type=&limit=&cursor=
```

Responses include publisher source URLs and capture provenance. They never expose private
rendered-HTML keys or stored HTML.

## Website

The archive at groups captures by date and filters them by search text, brand, and category. Selecting a thumbnail opens the full-page screenshot in a modal.

The `/admin` page starts a workflow for all sites, one brand, or one named site.

## Configuration

The Worker requires these bindings:

- `BROWSER`: Cloudflare Browser Rendering
- `NEWS_SNAPSHOTTER`: Cloudflare Workflow
- `SCREENSHOTS`: R2 bucket
- `ARCHIVE_DATA`: private R2 bucket for compressed HTML and extraction artefacts
- `HISTORY_DB`: D1 database containing queryable capture, observation, and change metadata
- `HISTORY_INDEX_QUEUE`: Queue producer for persisted extraction artefacts
- `CAPTURE_FAILURES`: Workers KV namespace for failed captures
- `CONTACT_EMAIL`: restricted Email Service binding for archive enquiries
- `CONTACT_RATE_LIMIT`: native Rate Limiting binding for contact submissions
- `API_KEY`: secret used to authenticate requests
- `HYPERBROWSER_API_KEY`: secret used when a profile or admin capture selects Hyperbrowser

Create the production and preview R2 buckets, then set the API secret:

```sh
pnpm wrangler r2 bucket create news-snapshotter
pnpm wrangler r2 bucket create news-snapshotter-preview
pnpm wrangler r2 bucket create news-snapshotter-archive-data
pnpm wrangler r2 bucket create news-snapshotter-archive-data-preview
pnpm wrangler secret put API_KEY
pnpm wrangler secret put HYPERBROWSER_API_KEY
```

History deployment also requires account-specific D1 and Queue resources. Create them before
adding their bindings to `wrangler.json`:

```sh
pnpm wrangler d1 create news-snapshotter-history
pnpm wrangler queues create news-snapshotter-history-index
pnpm wrangler queues create news-snapshotter-history-index-dlq
```

Add the returned D1 UUID as `HISTORY_DB`, bind the producer as `HISTORY_INDEX_QUEUE`, and attach
the same queue as this Worker's consumer with `max_concurrency: 1`. Use the dead-letter queue and
apply all D1 migrations before enabling the producer.
Single-consumer concurrency preserves adjacent-edge convergence while D1 neighbour discovery and
edge replacement run as separate database batches.

Apply migrations to the local development database with:

```sh
pnpm run db:migrate:local
```

Production deployment applies pending remote migrations before publishing the Worker. If a migration
fails, Wrangler rolls it back and the Worker deployment does not run.

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
