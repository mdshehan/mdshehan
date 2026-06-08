# 1. System Architecture

## 1.1 High-Level Architecture

```mermaid
flowchart TB
    subgraph Client["👤 Clients"]
        WEB["Web (Next.js SSR/ISR)"]
        MOB["Mobile Web / PWA"]
        BOT["Search Engine Bots"]
    end

    subgraph Edge["☁️ Cloudflare Edge"]
        CDN["CDN + Cache"]
        WAF["WAF / DDoS / Bot Mgmt"]
        IMG["Image Resizing"]
    end

    subgraph FrontTier["Frontend Tier (Next.js on EKS)"]
        NEXT["Next.js App Router\n(RSC, SSR, ISR, on-demand revalidate)"]
        ADMIN["Admin Dashboard (Next.js)"]
    end

    subgraph APITier["API Tier (NestJS on EKS)"]
        GW["API Gateway / BFF"]
        REST["REST API v1"]
        GQL["GraphQL Gateway"]
        AUTH["Auth Service (JWT/RBAC)"]
        CATALOG["Catalog Service"]
        PRICE["Pricing Service"]
        AFF["Affiliate Service"]
        CONTENT["Content/CMS Service"]
        SEO["SEO/Schema Service"]
        SEARCHSVC["Search Service"]
        ADS["Ad Service"]
        ANALYTICS["Analytics Service"]
    end

    subgraph Async["⚙️ Async Workers (BullMQ)"]
        W1["Price Crawlers / Feed Ingest"]
        W2["Search Indexer"]
        W3["Sitemap Generator"]
        W4["Image Processing"]
        W5["Notification Dispatcher"]
        W6["Analytics Rollups"]
    end

    subgraph Data["🗄️ Data Stores"]
        PG[("PostgreSQL 16\nPrimary + Read Replicas")]
        REDIS[("Redis 7\nCache / Queue / Sessions")]
        SEARCH[("Meilisearch / Elasticsearch")]
        S3[("S3 / R2 Object Storage")]
        CH[("ClickHouse\n(events/analytics — scale)")]
    end

    subgraph External["🔌 External"]
        AMZ["Amazon PA-API"]
        ALI["AliExpress"]
        STORES["Walmart / BestBuy / eBay / Feeds"]
        ADSENSE["AdSense / GAM"]
        MAIL["Email/SMS (SES/Twilio)"]
    end

    Client --> Edge --> FrontTier
    NEXT -->|BFF calls| GW
    ADMIN --> GW
    GW --> REST & GQL
    REST --> AUTH & CATALOG & PRICE & AFF & CONTENT & SEO & SEARCHSVC & ADS & ANALYTICS
    GQL --> CATALOG & PRICE & CONTENT

    CATALOG & PRICE & CONTENT & SEO & ANALYTICS --> PG
    AUTH & GW --> REDIS
    SEARCHSVC --> SEARCH
    CONTENT & CATALOG --> S3
    ANALYTICS --> CH

    APITier -.enqueue.-> Async
    W1 --> External
    W1 --> PG
    W2 --> SEARCH
    W3 --> S3
    W4 --> S3
    W5 --> MAIL
    W6 --> CH & PG
    ADS --> ADSENSE
```

## 1.2 Architectural Style

- **Modular monolith first, microservice-ready.** Start as a single NestJS app organized into
  bounded **modules** (Catalog, Pricing, Affiliate, Content, SEO, Search, Ads, Analytics, Auth).
  Each module has clean boundaries (controllers → services → repositories) so any module can be
  extracted into its own deployable service when traffic justifies it — without rewrites.
- **BFF (Backend-for-Frontend).** Next.js server components call a thin gateway that aggregates,
  shapes, and localizes responses for the UI, keeping the public REST/GraphQL contract clean.
- **CQRS-lite for read scale.** Heavy read paths (product pages, listings, comparisons) are served
  from Redis + read replicas + search index; writes go to the primary.
- **Event-driven async.** Crawling, indexing, sitemap regen, image processing, notifications, and
  analytics rollups run as idempotent background jobs on Redis/BullMQ.

## 1.3 Request Lifecycles

### A) Product page (read, SEO-critical)
```
Bot/User → Cloudflare (HTML cache, stale-while-revalidate)
         → Next.js (ISR: cached HTML, revalidate=300s, on-demand purge on price change)
         → BFF → Catalog/Pricing service
         → Redis (product:{id}:{country}) hit? serve : query PG read-replica → cache → serve
         → JSON-LD injected server-side (Product + AggregateRating + Breadcrumb)
```

### B) Affiliate click (write + redirect)
```
User clicks "Buy at Amazon"
  → GET /go/{affiliateLinkId}?ctx=...   (NestJS Affiliate service, 302)
  → fire-and-forget enqueue click event (BullMQ) — never block the redirect
  → append affiliate tag + sub-id → 302 to merchant
  → worker persists click (country, device, product, store, EPC attribution) → CH/PG
```

### C) Price ingestion (async)
```
Cron/feed → W1 crawler/feed-parser normalizes price+stock+currency
  → upsert prices, write price_history (append-only, partitioned by month)
  → if price changed: invalidate Redis + trigger Next.js on-demand revalidate + reindex search
  → if price drop watched: enqueue notification
```

## 1.4 Multi-Region / International Strategy
- **Single global catalog**, per-country **pricing, ads, affiliate links, SEO pages** (see
  localization tables). Country resolved by `Cf-IPCountry` header + user override (cookie).
- **Hreflang clusters** per locale; canonical points to the locale-specific URL.
- Currency display converts via cached FX rates; **stored prices keep the merchant's native
  currency** + a normalized USD column for sorting/analytics.

## 1.5 Non-Functional Targets

| Concern | Target |
|---|---|
| Product page TTFB (cached) | < 200 ms at edge |
| API p95 latency | < 150 ms (cached), < 400 ms (DB) |
| PageSpeed / Lighthouse | ≥ 95 mobile |
| Core Web Vitals | LCP < 2.0s, INP < 200ms, CLS < 0.1 (green) |
| Availability | 99.95% |
| Scale | 10M+ products, 100M+ price rows, 50k RPS read at edge |
| Search latency | < 50 ms autocomplete |
