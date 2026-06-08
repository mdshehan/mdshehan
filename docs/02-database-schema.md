# 2. Database Schema

> Full executable DDL: [`/database/schema.sql`](../database/schema.sql) (PostgreSQL 16).
> This document explains the design decisions, table groups, keys, and indexing strategy.

## 2.1 Design Principles

1. **UUID v7 primary keys** — time-ordered UUIDs avoid hotspotting while keeping global uniqueness
   (safe for sharding, public IDs, and offline ID generation).
2. **Normalized core + JSONB escape hatches** — relational integrity for entities/relationships,
   `JSONB` for sparse/variable data (product `specs`, layout `props`, `settings`, `schema_data`).
3. **EAV for specs, cached snapshot for reads** — `product_specifications` (queryable, filterable)
   is canonical; `products.specs` JSONB is a denormalized cache for single-query page render.
4. **Append-only + partitioning for time-series** — `price_history` and `affiliate_clicks` are
   range-partitioned by month so old partitions can be detached/archived cheaply.
5. **Denormalized counters** — `rating_avg`, `rating_count`, `min_price_usd`, `product_count`,
   `view_count` are maintained by triggers/jobs to keep read paths single-query.
6. **Polymorphic attach tables** — `mediables`, `taggables`, `seo_metadata`, `schema_data`,
   `translations` attach to any entity via `(entity_type, entity_id)`.
7. **Soft deletes** (`deleted_at`) on user-facing content; hard deletes on join tables.

## 2.2 Table Groups (40+ tables)

| Group | Tables |
|-------|--------|
| **Identity & Access** | `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_permissions`, `auth_sessions` |
| **Localization** | `countries`, `currencies`, `languages`, `translations` |
| **Catalog** | `brands`, `categories`, `products`, `product_variants`, `specification_groups`, `specification_attributes`, `category_attributes`, `product_specifications`, `product_relations`, `tags`, `taggables` |
| **Media** | `media`, `mediables` |
| **Commerce** | `stores`, `store_countries`, `prices`, `price_history`, `affiliate_links`, `affiliate_clicks`, `price_alerts` |
| **Reviews** | `reviews`, `rating_criteria` |
| **Content** | `articles`, `article_products`, `pages`, `menus`, `menu_items`, `layouts`, `layout_blocks` |
| **Ads** | `ad_slots`, `advertisements` |
| **SEO** | `seo_metadata`, `seo_hreflangs`, `schema_data`, `redirects` |
| **Platform** | `settings`, `notifications`, `activity_logs` |

## 2.3 Key Relationships

```
brands 1───* products *───1 categories (self-referential tree via parent_id + ltree path)
products 1───* product_variants
products 1───* product_specifications *───1 specification_attributes *───1 specification_groups
products 1───* prices *───1 stores, countries, currencies
products 1───* price_history (partitioned)
products 1───* affiliate_links 1───* affiliate_clicks
products 1───* reviews 1───* rating_criteria
products *───* products (product_relations: related/similar/accessory/successor)
products *───* tags (taggables, polymorphic)
products/articles/pages/... 1───* seo_metadata / schema_data / seo_hreflangs (polymorphic)
users *───* roles *───* permissions
countries 1───1 currencies, languages
```

## 2.4 Indexing Strategy

| Goal | Index |
|------|-------|
| Slug lookups (every page) | unique `CITEXT` on `products.slug`, `brands.slug`, `articles.slug`… |
| Category subtree queries | GIST on `categories.path` (ltree) |
| Spec facet filtering | `product_specifications(attribute_id, value_number)` + GIN on `products.specs` |
| Fuzzy product search fallback | GIN `gin_trgm_ops` on `products.name` |
| Best-price-by-country | `prices(product_id, country_id, price_usd)` |
| Price history charts | `price_history(product_id, recorded_at DESC)` per partition |
| Click analytics | `affiliate_clicks(affiliate_link_id, clicked_at DESC)` per partition |
| SEO/schema/media polymorphic | composite `(entity_type, entity_id)` |
| Listing sorts | `products(release_date DESC)`, `products(min_price_usd)` partial WHERE not deleted |

## 2.5 Money & FX Handling

- Each price row stores **merchant-native** `price` + `currency_id`, **plus** a normalized
  `price_usd` (computed from `currencies.usd_rate` at ingest) used for cross-store sorting,
  "best price" computation, and analytics.
- Display currency is converted **at read time** from `price_usd` using the visitor's country
  currency — never re-storing rounded conversions to avoid drift.
- FX rates refreshed by a scheduled worker writing `currencies.usd_rate` + `rate_updated_at`.

## 2.6 Partitioning & Retention

| Table | Strategy | Retention |
|-------|----------|-----------|
| `price_history` | Monthly RANGE partitions | Keep 24 months hot, archive older to S3 (Parquet) |
| `affiliate_clicks` | Monthly RANGE partitions | 12 months hot; mirror to ClickHouse for analytics |
| `activity_logs` | BRIN on `created_at` (or monthly) | 12 months |

A nightly maintenance job pre-creates next-month partitions and detaches/archives expired ones.

## 2.7 Data Integrity

- Foreign keys with `ON DELETE CASCADE` for owned children, `RESTRICT`/`SET NULL` for references.
- `CHECK` constraints on enums where not using PG enum types (e.g., rating 0–10).
- Unique business keys: `(product_id, variant_id, store_id, country_id)` on `prices` prevents
  duplicate offers; `(entity_type, entity_id, language_id)` on `seo_metadata`.
- `updated_at` auto-maintained by a trigger applied to every table that has the column.
