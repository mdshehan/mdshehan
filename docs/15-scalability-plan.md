# 15. Future Scalability Plan

A staged roadmap from launch to **10M+ products, 100M+ price rows, billions of monthly requests**,
unlimited countries/languages/currencies — without rewrites, by leaning on the modular-monolith
boundaries and stateless app tier established in §1.

## 15.1 Scaling Stages

| Stage | Traffic / Scale | Key moves |
|-------|-----------------|-----------|
| **0 — Launch** | <100k products, 1M MAU | Modular monolith API, single RDS primary + 1 replica, Redis, Meilisearch, Cloudflare ISR |
| **1 — Growth** | 1M products, 10M MAU | Add read replicas, Redis cluster mode, OpenSearch, KEDA worker autoscaling, ClickHouse for events |
| **2 — Scale** | 5M products, 50M MAU | Extract hot modules (Pricing, Search, Affiliate) into services; table partitioning everywhere; CDN tiered cache |
| **3 — Hyperscale** | 10M+ products, global | Citus/sharded Postgres or per-domain DBs; multi-region active-active reads; event streaming (Kafka) |

## 15.2 Database Scaling Path
1. **Vertical + read replicas** first (cheapest win; reads dominate).
2. **Partitioning**: already designed for `price_history`, `affiliate_clicks`; extend to
   `activity_logs`, `notifications`.
3. **Read/write split** at the ORM/router level; route analytics to replicas/ClickHouse.
4. **Sharding** when a single primary's write throughput is the bottleneck:
   - Catalog rarely write-heavy → keep central.
   - **Prices/clicks** are the write hotspots → shard by `product_id` hash or move to Citus
     (distributed Postgres) / dedicated time-series store.
5. **CQRS hardening**: materialized read models in search + Redis so the primary serves a small,
   write-mostly footprint.

## 15.3 Service Extraction (when justified)
- Boundaries already clean (§5.2). Extract in this order based on load:
  1. **Search Service** (independent scaling, heavy CPU)
  2. **Pricing/Ingestion Service** (crawler fan-out, write-heavy)
  3. **Affiliate/Redirect Service** (ultra-high RPS, latency-critical `/go`)
  4. **Analytics Service** (event firehose → ClickHouse)
- Inter-service comms: start sync (HTTP/gRPC) → introduce **Kafka** for price/click/event streams
  and async projections as volume grows.

## 15.4 Global Performance
- **Edge-first**: most reads served from Cloudflare cache + ISR near users; writes localized to
  primary region — already the default, scales geographically for free.
- Multi-region **active-active reads** via cross-region replicas; writes via region-routing
  (latency-based) with conflict-free design (append-only history, idempotent ingest).
- Pre-render popular comparison/landing pages; precompute facet counts.

## 15.5 Search & Discovery Evolution
- Meilisearch → **OpenSearch/Elasticsearch** cluster (sharded indices per category/locale).
- Add **vector search** (pgvector/OpenSearch kNN) for semantic "best phone under $500 with good
  camera" queries and AI suggestions; LLM-assisted query understanding + spec extraction from feeds.

## 15.6 Data & ML Platform
- Event lake on S3 (Parquet) + Athena/ClickHouse; dbt models for analytics.
- ML: price-drop prediction, demand forecasting, recommendation (`product_relations.score`),
  duplicate-product matching across merchant feeds, automated spec normalization.

## 15.7 Reliability at Scale
- SLOs with error budgets; multi-region failover; chaos testing; cell-based architecture to limit
  blast radius; autoscaling on custom metrics (queue depth, RPS, p95).
- Per-tenant/region rate isolation; graceful degradation (serve cached prices + "updated X ago" when
  ingestion lags; hide ads before breaking page; stale-while-revalidate everywhere).

## 15.8 Extensibility (future gadget categories & business lines)
- **Category-agnostic catalog**: new gadget types need only new `categories` + `specification_*`
  rows — **no schema change** (EAV + JSONB specs + dynamic facets/forms already handle this).
- Plugin-style **layout blocks** and **ad types** extend the UI/monetization without core changes.
- Roadmap options: native mobile apps (shared `sdk` package), partner/public API tier with API keys
  + billing, B2B price-data feeds, browser extension for price tracking, marketplace/vendor portal
  (Vendor Manager role already modeled).

## 15.9 Guiding Principles
- **Stateless app tier** → scale horizontally by default.
- **Bounded staleness** via event-driven cache invalidation → cheap reads, fresh-enough data.
- **Extract, don't rewrite** → module boundaries let services peel off under load.
- **Measure before scaling** → SLOs + per-key cache/DB metrics drive each next investment.
