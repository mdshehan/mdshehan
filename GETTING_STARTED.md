# Getting Started — Global Gadget Price Hub

This is the **monorepo foundation** (step 1): pnpm + Turborepo workspace, a NestJS API, and the
PostgreSQL data layer (Prisma) with seed data. See [`docs/`](./docs) for the full architecture and
[`docs/16-best-option-decisions.md`](./docs/16-best-option-decisions.md) for the guiding choices.

## Prerequisites
- Node.js ≥ 20, **pnpm** ≥ 9 (`npm i -g pnpm`)
- Docker (for Postgres/Redis/Meilisearch/MinIO)

## 1. Install & configure
```bash
pnpm install
cp .env.example .env            # adjust if needed
```

## 2. Start local infrastructure (portable, open components)
```bash
pnpm db:up                      # postgres, redis, meilisearch, minio via docker compose
```

## 3. Create the database schema + seed data
```bash
pnpm db:migrate                 # applies Prisma migrations
pnpm db:seed                    # currencies, languages, countries, roles, demo catalog
```
> The canonical advanced DDL (partitioning, ltree, GIN/GiST indexes, triggers) lives in
> [`database/schema.sql`](./database/schema.sql); Prisma manages the app-facing tables.

## 4. Run the API
```bash
pnpm dev                        # or: pnpm --filter @ggph/api dev
```
API on **http://localhost:4000** (global prefix `/v1`).

## 5. Try it — public reads
```bash
curl http://localhost:4000/healthz
curl http://localhost:4000/readyz
curl http://localhost:4000/v1/config
curl http://localhost:4000/v1/categories
curl http://localhost:4000/v1/brands
curl http://localhost:4000/v1/products
curl http://localhost:4000/v1/products/samsung-galaxy-s25-ultra
curl "http://localhost:4000/v1/products/samsung-galaxy-s25-ultra/prices?country=US"
```

## 6. Try it — auth + RBAC-gated writes
Seed creates a super-admin: **admin@gadgethub.com / Admin123!** (change in production).

```bash
# Log in → get accessToken + refreshToken
TOKEN=$(curl -s -X POST http://localhost:4000/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@gadgethub.com","password":"Admin123!"}' | jq -r .accessToken)

# Who am I (roles + effective permissions)
curl http://localhost:4000/v1/auth/me -H "Authorization: Bearer $TOKEN"

# Create a brand (requires brand.create permission)
curl -X POST http://localhost:4000/v1/admin/brands \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Google","slug":"google","websiteUrl":"https://store.google.com"}'

# Without a token → 401; with a token lacking the scope → 403
curl -i -X POST http://localhost:4000/v1/admin/brands -d '{}'
```

### Auth endpoints
| Method | Path | Notes |
|--------|------|-------|
| POST | `/v1/auth/register` | email + password (≥8) |
| POST | `/v1/auth/login` | → access (15m) + refresh (rotating) |
| POST | `/v1/auth/refresh` | rotate tokens; reuse-detection revokes family |
| POST | `/v1/auth/logout` | revoke session |
| GET | `/v1/auth/me` | current user + permissions (Bearer) |

### RBAC-gated admin writes
`/v1/admin/products`, `/v1/admin/brands`, `/v1/admin/categories` — `POST` / `PATCH /:id` /
`DELETE /:id` (soft delete), each guarded by `<group>.<action>` permission scopes.

## 7. Pricing & Affiliate

### Pricing (admin offers + public history)
```bash
# Upsert an offer (price.create) — records price_history + recomputes best price
curl -X POST http://localhost:4000/v1/admin/prices \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"productId":"<uuid>","storeId":"<uuid>","countryId":"<uuid>","currencyId":"<uuid>","price":1149.00}'

# Public price-history (powers the chart)
curl "http://localhost:4000/v1/products/samsung-galaxy-s25-ultra/price-history?days=180"
```
- `POST /v1/admin/prices` (`price.create`) · `PATCH /v1/admin/prices/:id` (`price.update`) ·
  `DELETE /v1/admin/prices/:id` (`price.delete`)
- Every price change appends a `price_history` row and recomputes `products.min_price_usd`.
- `price_usd` is normalized from the offer currency's `usd_rate` for cross-store sorting.

### Affiliate (links + redirect + analytics)
```bash
# Create an affiliate link (auto short code if omitted)
curl -X POST http://localhost:4000/v1/admin/affiliate-links \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"storeId":"<uuid>","targetUrl":"https://amazon.com/dp/XYZ","affiliateTag":"ggph-20"}'

# Public redirect — 302 to merchant, click tracked asynchronously
curl -i http://localhost:4000/go/<shortCode>

# Analytics: clicks, revenue, EPC, conversion, breakdowns (affiliate.view)
curl "http://localhost:4000/v1/admin/affiliate/analytics?days=30" -H "Authorization: Bearer $TOKEN"
```
- `GET /go/:code` lives at the **root** (excluded from `/v1`): resolve → **302** immediately →
  append `tag`/`subid` → record the click **fire-and-forget** (never blocks the redirect).
- Admin link CRUD under `/v1/admin/affiliate-links` (`affiliate.*` scopes).

## 8. Search (Meilisearch + Postgres fallback)
```bash
# Full search with filters + facets
curl "http://localhost:4000/v1/search?q=galaxy&brand=samsung&price_max=1300&sort=price"

# Typeahead autocomplete (products + brand/category suggestions)
curl "http://localhost:4000/v1/search/autocomplete?q=gal"

# Rebuild the index (product.update scope)
curl -X POST http://localhost:4000/v1/admin/search/reindex -H "Authorization: Bearer $TOKEN"
```
- Products are indexed in **Meilisearch** (filterable: brand, category, ram, storage, priceUsd,
  availability; sortable: price, rating, release).
- The indexer is **event-driven**: catalog/price writes emit `product.changed` / `product.deleted`
  → the index updates automatically (decoupled via Nest `EventEmitter`).
- **Graceful degradation**: if Meilisearch is unavailable, search/autocomplete transparently fall
  back to a Postgres query (`engine` field in the response shows which path served it).

## 9. Run the storefront (Next.js)
```bash
pnpm --filter @ggph/web dev      # http://localhost:3000 (reads the API)
```
- **Homepage** (`/`) — hero, trending, latest launches, popular brands (ISR, 15 min).
- **Product page** (`/products/:slug`) — gallery, best-price CTA, price-comparison table,
  price-history chart, full specs, pros/cons. SSR/ISR (5 min) with **JSON-LD** (Product +
  AggregateOffer + AggregateRating + BreadcrumbList) and SEO `generateMetadata`.
- Dark/light theme (no-flash, persisted), Tailwind design tokens, accessible semantic markup.
- **Resilient fetch**: pages render with empty-state fallbacks if the API is down, so the build
  always succeeds; affiliate "Buy" buttons route through `/go/:code` with `rel="nofollow sponsored"`.
- **Category pages** (`/category/:slug`) — faceted filters (brand, price, RAM, storage, sort) as a
  plain GET form: zero client JS, filters live in the URL (shareable + crawlable). Facet counts
  come from the search engine.
- **Search** (`/search`) — client autocomplete box (debounced, products/brands/categories) +
  server-rendered results with the same facet sidebar; `noindex` per the SEO architecture.
- **Compare** (`/compare?p=slug-a,slug-b[,c,d]`) — 2–4 products side by side: spec matrix with
  difference highlighting, best price, rating, pros/cons, buy buttons; sticky label column.
- **Brand pages** (`/brands/:slug`) and **Deals** (`/deals`).

## 10. Run the admin dashboard
```bash
pnpm --filter @ggph/admin dev   # http://localhost:3001
```
Sign in with the seeded super-admin (**admin@gadgethub.com / Admin123!**).
- **Overview** — affiliate KPIs (clicks, revenue, EPC, conversion rate) + device/store breakdowns.
- **Products** — searchable list (includes drafts), create form, soft-delete.
- **Brands** — list + inline create + soft-delete.
- **Prices** — offer upsert form (product/store/country/currency selects); each save appends
  price history and recomputes the product's best price + search index.
- **Affiliate** — link CRUD with live `/go/<code>` short links.
- Navigation and actions are **permission-gated client-side** (`can('product.create')` etc.) and
  enforced server-side by the RBAC guards — the UI hides what the API would reject anyway.
- Auth: login stores the JWT pair; `authFetch` auto-refreshes on 401 (rotating refresh tokens).
  Dev note: tokens are in localStorage for simplicity — move the refresh token to an httpOnly
  cookie for production.

## Workspace layout (current)
```
apps/api/                 NestJS API
  prisma/schema.prisma    data layer (mirrors database/schema.sql)
  prisma/seed.ts          seed data
  src/
    modules/auth/         JWT + RBAC (guards, AccessService, sessions)
    modules/catalog/      products · brands · categories (read + admin write)
    modules/pricing/      offers · price_history · public price-history
    modules/affiliate/    links · /go/:code redirect · click tracking · analytics
    modules/search/       Meilisearch index · /v1/search · autocomplete · indexer
    modules/localization/ countries · currencies · languages · /config
    health/               /healthz · /readyz
apps/web/                 Next.js storefront (App Router, Tailwind)
  src/app/                homepage · products/[slug] · layout
  src/components/         header · footer · product-card · price/spec tables · chart
  src/lib/                typed api client · jsonld · format helpers
database/schema.sql       canonical reference DDL
docs/                     full architecture (16 docs)
```

## Next steps (roadmap)
1. ✅ Monorepo + DB layer + seed
2. ✅ Auth (JWT + rotating refresh sessions) + RBAC permissions guard + catalog write endpoints
3. ✅ Pricing (offers + price_history) + Affiliate (links, `/go/:code` redirect, click tracking, analytics)
4. ✅ Search (Meilisearch index, faceted `/v1/search`, autocomplete, event-driven indexer, PG fallback)
5. ✅ `apps/web` Next.js storefront — homepage + product page (price comparison, history, JSON-LD, SEO)
6. ✅ Storefront breadth: category pages + faceted filters, search UI + autocomplete, compare (2–4), brands, deals
7. ✅ `apps/admin` dashboard — login, RBAC-gated nav, products/brands/prices/affiliate management, analytics
8. Hardening: rate limiting, audit-log writes on mutations, sitemaps, CI workflow
9. Workers: price-feed ingest, FX refresh, sitemap generation (BullMQ)
