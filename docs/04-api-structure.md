# 4. API Structure

Two coordinated interfaces over the same domain services:
- **REST API v1** (`/api/v1/*`) — primary public + admin contract, cache-friendly, versioned.
- **GraphQL** (`/graphql`) — flexible aggregation for the storefront BFF and partner integrations.

All responses are JSON. Auth via **JWT access token** (15 min) + **rotating refresh token**
(httpOnly cookie). Admin routes additionally enforce **RBAC permission scopes**.

## 4.1 Conventions

- Base URL: `https://api.gadgethub.com/v1`
- Versioning: URI prefix `/v1`; breaking changes → `/v2`.
- Pagination: cursor-based `?cursor=...&limit=24` (keyset on indexed columns) — returns
  `{ data, page_info: { end_cursor, has_next_page }, meta: { total? } }`.
- Filtering: `?filter[brand]=apple&filter[price_min]=200&filter[ram]=8`.
- Sorting: `?sort=-release_date,price_usd`.
- Localization: `?country=US&lang=en` or headers `X-Country`, `Accept-Language`.
- Errors: RFC 7807 `application/problem+json` `{ type, title, status, detail, errors[] }`.
- Rate limits: returned via `RateLimit-*` headers; 429 on exceed.
- Idempotency: `Idempotency-Key` header honored on POST for mutations.

## 4.2 Public REST Endpoints

### Catalog
```
GET    /v1/products                       # list + filters + facets
GET    /v1/products/{slug}                # full product (specs, gallery, prices, reviews, schema)
GET    /v1/products/{slug}/prices         # price comparison across stores (country-aware)
GET    /v1/products/{slug}/price-history  # time-series for chart  ?store=&days=180
GET    /v1/products/{slug}/reviews        # paginated reviews
GET    /v1/products/{slug}/related        # related + similar
POST   /v1/products/{slug}/reviews        # submit user review (auth)
GET    /v1/brands                         # list brands
GET    /v1/brands/{slug}                  # brand + products
GET    /v1/categories                     # tree (mega-menu)
GET    /v1/categories/{slug}              # category landing + filtered products + facets
GET    /v1/categories/{slug}/facets       # available filter facets + counts
```

### Discovery
```
GET    /v1/search?q=galaxy+s24            # full search (Meili/ES) + facets
GET    /v1/search/autocomplete?q=gal      # typeahead suggestions (products/brands/categories)
GET    /v1/search/suggestions             # AI/trending suggestions
POST   /v1/compare                        # body: { slugs: [a,b,c,d] } → normalized spec matrix
GET    /v1/deals                          # active deals (country-aware)
GET    /v1/trending                       # trending products
```

### Content
```
GET    /v1/articles?type=review|news|buying_guide|deal
GET    /v1/articles/{slug}
GET    /v1/pages/{slug}
GET    /v1/menus/{location}               # main | mobile | footer (resolved tree)
GET    /v1/layouts/{type}                 # homepage | header | footer (active layout blocks)
```

### Localization / Config
```
GET    /v1/config                         # public settings, currencies, languages, countries
GET    /v1/geo/resolve                    # resolve country from IP (edge)
```

### Monetization
```
GET    /v1/ads?slot=sidebar&country=US&category=phones&device=mobile   # ad decisioning
POST   /v1/ads/{id}/impression            # beacon (batched)
GET    /go/{short_code}                    # affiliate redirect (302) + async click tracking
```

### User
```
POST   /v1/auth/register
POST   /v1/auth/login                      # → access + refresh
POST   /v1/auth/refresh
POST   /v1/auth/logout
GET    /v1/me
POST   /v1/me/price-alerts                 # watch a product for price drop
GET    /v1/me/notifications
```

### SEO surfaces (served by Next.js but powered by API)
```
GET    /sitemap.xml                        # index
GET    /sitemaps/products-{n}.xml          # sharded (50k urls/file)
GET    /sitemaps/news.xml                  # Google News
GET    /sitemaps/images-{n}.xml
GET    /robots.txt
```

## 4.3 Admin REST Endpoints (RBAC-gated)

All under `/v1/admin/*`, each requiring a permission scope (e.g. `product.create`).

```
# Products
GET|POST            /v1/admin/products
GET|PATCH|DELETE    /v1/admin/products/{id}
POST                /v1/admin/products/{id}/variants
POST                /v1/admin/products/{id}/specifications      # bulk upsert
POST                /v1/admin/products/import                   # CSV/feed bulk import (async job)
POST                /v1/admin/products/{id}/reindex

# Brands / Categories
GET|POST|PATCH|DELETE   /v1/admin/brands[/{id}]
GET|POST|PATCH|DELETE   /v1/admin/categories[/{id}]
PATCH                   /v1/admin/categories/reorder            # drag/drop tree

# Pricing / Stores / Affiliate
GET|POST|PATCH|DELETE   /v1/admin/stores[/{id}]
GET|POST|PATCH|DELETE   /v1/admin/prices[/{id}]
GET|POST|PATCH|DELETE   /v1/admin/affiliate-links[/{id}]
GET                     /v1/admin/affiliate/analytics           # clicks, EPC, CTR, revenue

# Content / Layout / Menu
GET|POST|PATCH|DELETE   /v1/admin/articles[/{id}]
GET|POST|PATCH|DELETE   /v1/admin/pages[/{id}]
GET|POST|PATCH|DELETE   /v1/admin/layouts[/{id}]
PUT                     /v1/admin/layouts/{id}/blocks           # save builder tree
GET|POST|PATCH|DELETE   /v1/admin/menus[/{id}]/items

# Ads
GET|POST|PATCH|DELETE   /v1/admin/ad-slots[/{id}]
GET|POST|PATCH|DELETE   /v1/admin/advertisements[/{id}]

# SEO / Schema / Redirects
GET|PUT                 /v1/admin/seo/{entity_type}/{entity_id}
GET|PUT                 /v1/admin/schema/{entity_type}/{entity_id}
POST                    /v1/admin/sitemaps/regenerate
GET|POST|PATCH|DELETE   /v1/admin/redirects[/{id}]

# Localization
GET|POST|PATCH|DELETE   /v1/admin/countries[/{id}]
GET|POST|PATCH|DELETE   /v1/admin/currencies[/{id}]
GET|POST|PATCH|DELETE   /v1/admin/languages[/{id}]
GET|PUT                 /v1/admin/translations/{entity_type}/{entity_id}

# Media
POST                    /v1/admin/media                          # presigned S3 upload init
GET|DELETE              /v1/admin/media[/{id}]

# Users / Roles
GET|POST|PATCH|DELETE   /v1/admin/users[/{id}]
GET|POST|PATCH|DELETE   /v1/admin/roles[/{id}]
GET                     /v1/admin/permissions

# Reviews moderation
GET                     /v1/admin/reviews?status=pending
PATCH                   /v1/admin/reviews/{id}                   # approve/reject

# Settings / System
GET|PUT                 /v1/admin/settings/{group}
GET                     /v1/admin/activity-logs
GET                     /v1/admin/analytics/overview             # revenue, clicks, top products...
```

## 4.4 GraphQL (read-optimized storefront)

```graphql
type Query {
  product(slug: String!, country: String): Product
  products(filter: ProductFilter, sort: [ProductSort!], first: Int, after: String): ProductConnection!
  compare(slugs: [String!]!, country: String): Comparison!
  search(q: String!, filter: ProductFilter, first: Int): SearchResult!
  category(slug: String!): Category
  homepage: Layout
  deals(country: String, first: Int): [Product!]!
}

type Product {
  id: ID!
  name: String!
  slug: String!
  brand: Brand!
  category: Category!
  specs: JSON
  gallery: [Media!]!
  variants: [Variant!]!
  prices(country: String): [Offer!]!     # cheapest first
  bestPrice(country: String): Offer
  priceHistory(days: Int = 180): [PricePoint!]!
  reviews(first: Int): ReviewConnection!
  ratingAvg: Float
  related: [Product!]!
  pros: [String!]!
  cons: [String!]!
  seo: Seo!
  jsonLd: JSON!                           # server-built Product schema
}

type Offer { store: Store!, price: Float!, currency: String!, url: String!, availability: String! }
```

> GraphQL is **read-only** for the public surface (mutations stay on REST + RBAC). Query depth /
> complexity limiting + persisted queries protect against abuse.

## 4.5 Webhooks (outbound)

```
product.price_dropped     → notify subscribers / partner feeds
review.submitted          → moderation queue
affiliate.conversion      → revenue attribution (merchant postback inbound at /v1/postback/{store})
```
