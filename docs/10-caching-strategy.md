# 10. Caching Strategy

Multi-layer caching from the browser to the database, designed so the hot read paths
(product pages, listings, search) almost never touch Postgres.

## 10.1 Cache Layers

```
Browser cache / SWR
   │
Cloudflare edge (HTML + assets + image resizing)
   │
Next.js ISR (rendered HTML/RSC payload, on-demand revalidate)
   │
API response cache (Redis) + GraphQL persisted-query cache
   │
Domain object cache (Redis: product/category/price by key)
   │
PostgreSQL (primary + read replicas)  ·  Search engine (Meili/ES)
```

## 10.2 Layer Details

### 1) Cloudflare (edge)
- Cache static assets immutably (`/_next/static`, images) `max-age=31536000, immutable`.
- Cache HTML for anonymous users with `s-maxage` + `stale-while-revalidate`; bypass on auth cookie.
- Cloudflare **Image Resizing** for responsive AVIF/WebP from S3 originals.
- Tiered cache + Argo; cache purge by URL/tag on content change.

### 2) Next.js ISR / Data Cache
- Product/listing pages cached HTML with `revalidate` windows (see §8.1).
- **On-demand revalidation**: price-ingest worker calls `/api/revalidate?tag=product:{id}` so a
  price change refreshes only affected pages within seconds (not the whole site).
- `fetch` data cache tagged (`next: { tags: ['product:'+id] }`) for granular invalidation.

### 3) API / Redis caching
| Key pattern | Value | TTL | Invalidation |
|-------------|-------|-----|--------------|
| `product:{id}:{country}` | rendered product DTO | 5 min | on price/spec/review change |
| `prices:{productId}:{country}` | offer list | 2 min | on price ingest |
| `category:{slug}:facets` | facet counts | 15 min | on product change in category |
| `home:layout:active` | homepage block tree | 10 min | on layout publish |
| `menu:{location}` | resolved menu | 1 h | on menu edit |
| `config:public` | settings/currencies/langs | 1 h | on settings change |
| `fx:rates` | currency table | until refresh | FX job |
| `search:auto:{q}` | top suggestions | 1 min | rolling |

- Pattern: **cache-aside** with stampede protection (single-flight lock / `SETNX` + jittered TTL).
- Negative caching for 404s (short TTL) to absorb bot scans of bad slugs.

### 4) Search engine
- Meilisearch/ES holds denormalized product docs → serves listing facets + autocomplete in <50ms,
  offloading complex filter queries from Postgres entirely.

### 5) Database
- **Read replicas** for all read traffic; primary for writes only.
- Materialized views / denormalized counters for aggregates (rating, min price, product counts).
- `pgBouncer` connection pooling; prepared statements; partition pruning on history tables.

## 10.3 Invalidation Flow (price change example)

```
price ingest worker upserts prices + price_history
  → DEL redis prices:{productId}:* , product:{id}:*
  → reindex product doc in search
  → POST /api/revalidate { tags: ['product:'+id, 'category:'+catSlug] }
  → Cloudflare cache purge by tag for affected URLs
  → (if drop) enqueue price_alert notifications
```

## 10.4 Sessions, Queues, Rate-limits in Redis
- Refresh-token/session store, BullMQ job queues, sliding-window rate limiters, idempotency keys,
  and ephemeral compare-tray state all live in Redis (separate logical DBs / key prefixes).

## 10.5 Cache Governance
- **Cache keys versioned** with a global prefix (`v3:`) so a schema/DTO change can mass-invalidate
  by bumping the version.
- TTL + event-driven invalidation combined → bounded staleness even if an event is missed.
- Per-key metrics (hit ratio, evictions) exported to Grafana; target product-page cache hit ≥ 95%.
- Redis runs in **cluster mode** (sharded) with replicas; eviction policy `allkeys-lru` for the
  cache DB, `noeviction` for the queue/session DB.
