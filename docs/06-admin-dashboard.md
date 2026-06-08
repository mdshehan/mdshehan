# 6. Admin Dashboard Design

A single **centralized super-admin dashboard** (Next.js + shadcn/ui) where every module is gated
by RBAC permissions. Navigation items hide when the user lacks the scope.

## 6.1 Navigation Map

```
📊 Dashboard            → analytics overview (revenue, clicks, top products/categories)
📦 Catalog
   ├ Products           → list/create/edit, bulk import, reindex
   ├ Brands
   ├ Categories         → tree + mega-menu builder
   └ Specifications     → attribute dictionary, per-category facets
💰 Pricing & Affiliate
   ├ Stores
   ├ Prices             → manual + feed-managed offers
   ├ Affiliate Links
   └ Affiliate Analytics→ clicks, EPC, CTR, revenue
📝 Content
   ├ Posts / News
   ├ Reviews (editorial)
   ├ Buying Guides
   ├ Deals
   └ Pages
🎨 Builders
   ├ Layout Builder     → drag/drop homepage/header/footer/sidebar/landing
   └ Menu Builder       → main/mobile/footer
📢 Advertising
   ├ Ad Slots
   └ Advertisements     → AdSense/GAM/AFS/custom/affiliate banners
🔍 SEO
   ├ Metadata           → per-entity meta/OG/Twitter/canonical/robots
   ├ Schema (JSON-LD)
   ├ Redirects
   ├ Sitemaps
   └ Hreflang
🌍 Localization         → Countries, Currencies, Languages, Translations
🖼️ Media Library
⭐ Reviews Moderation
👥 Access               → Users, Roles, Permissions
⚙️ System               → Settings, Activity Logs, Notifications
```

## 6.2 Module Details

### Product Editor (tabbed)
| Tab | Fields |
|-----|--------|
| **General** | name, slug (auto + override), brand, category, model #, release date, status, availability, short/long description (MDX editor) |
| **Specifications** | dynamic form generated from `category_attributes`; grouped by spec group; typed inputs (number/enum/bool) |
| **Variants** | RAM/storage/color matrix, SKU, GTIN, per-variant image |
| **Media** | drag-drop gallery (S3 presigned upload), reorder, set featured, alt text |
| **Pricing** | per store/country/currency offers + affiliate link; live "best price" preview |
| **Pros & Cons / Features** | array editors |
| **SEO** | meta title/description, canonical, robots, OG/Twitter, focus keyword, live SERP + social preview, score |
| **Schema** | auto-generated JSON-LD preview + override |
| **Related** | manual related/similar/accessory picker (+ ML suggestions) |

UX: autosave drafts, optimistic updates, inline validation (Zod), "Save & publish" vs schedule.

### Layout Builder (drag & drop)
- Canvas renders **block tree** (`layout_blocks`); palette of block types: `hero`,
  `product_carousel`, `deals_grid`, `brand_strip`, `latest_reviews`, `news_feed`,
  `popular_comparisons`, `buying_guides`, `newsletter`, `banner_ad`, `rich_text`, `html`.
- Built with **dnd-kit**; each block has a props panel (data source, count, filter, country).
- Live preview + responsive breakpoints (desktop/tablet/mobile). Publish toggles `is_active`.

### Menu Builder
- Nested drag/drop tree (`menu_items`); link types: custom URL, category, brand, product,
  page, article. Mega-menu columns supported via parent grouping. Per-location (main/mobile/footer).

### Affiliate Manager & Analytics
- Manage networks: Amazon PA-API, AliExpress, Walmart, BestBuy, eBay, custom.
- Per-link short code (`/go/{code}`), tag, sub-id templating.
- KPI cards + charts: **Clicks**, **Revenue**, **EPC** (revenue/clicks), **CTR**
  (clicks/impressions), conversions; breakdowns by store, product, country, device, date range.

### SEO Manager
- Bulk + per-entity metadata editing, live Google SERP + OG/Twitter preview, character counters,
  readability/keyword score.
- One-click **sitemap regeneration**, robots editor, hreflang cluster manager, redirect manager
  with import/export and 404-to-redirect suggestions from activity logs.

### Schema Manager
- Toggle auto-generation per entity, preview rendered JSON-LD, Rich Results validation hints,
  manual override stored in `schema_data`.

### Analytics Dashboard
- Overview KPIs: revenue, affiliate clicks, sessions, conversion rate.
- Widgets: Top Products, Top Categories, Top Stores, Search Analytics (top queries, zero-result
  queries), Country Analytics (map), Device Analytics, Price-drop alert volume.
- Data sourced from `analytics-rollup` job (PG aggregates + ClickHouse for raw events).

### User & Role Management
- Roles: **Super Admin, Admin, Editor, SEO Manager, Product Manager, Ad Manager, Vendor Manager**.
- Permission matrix UI (group × action grid); per-user grant/deny overrides; 2FA enforcement;
  session management (revoke).

## 6.3 Cross-cutting Admin UX
- **TanStack Table** data grids: server-side pagination/sort/filter, column visibility, CSV export,
  bulk actions (publish, delete, reindex).
- **react-hook-form + Zod** forms sharing the same schemas as the API (`packages/types`).
- Global command palette (⌘K), audit trail on every record ("Activity" tab from `activity_logs`),
  optimistic UI with toast + rollback, dark/light mode.
- Every mutation writes an `activity_logs` entry `{ before, after }`.
