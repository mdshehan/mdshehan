# 8. SEO Architecture

SEO is a **first-class platform concern**, not a plugin. The whole rendering, URL, metadata,
sitemap, schema, and i18n strategy is built for indexing millions of product/comparison/content
pages and winning long-tail "price", "specs", "vs", and "best X" queries.

## 8.1 Rendering Strategy (Core Web Vitals + Crawlability)

| Page type | Rendering | Revalidation |
|-----------|-----------|--------------|
| Homepage | ISR | 5 min + on-demand on layout publish |
| Product | ISR | 5 min + **on-demand** on price/spec change |
| Category/listing | ISR | 15 min |
| Comparison | ISR per slug-set (popular precomputed) | 1 h |
| Article/news/guide | SSG/ISR | on publish |
| Search results | SSR (noindex) or CSR | — |
| User/account | SSR, `noindex` | — |

Fully server-rendered HTML (RSC) → bots get complete content + JSON-LD without JS execution.

## 8.2 URL Architecture (clean, stable, keyword-rich)

```
/                                     homepage
/phones                               category landing
/phones/samsung                       brand-in-category
/samsung-galaxy-s25-ultra             product (flat, brandable slug)
/samsung-galaxy-s25-ultra/prices      price comparison deep page
/compare/iphone-16-pro-vs-galaxy-s25-ultra
/reviews/samsung-galaxy-s25-ultra-review
/news/{slug}    /buying-guides/{slug}    /deals/{slug}
/brands/samsung
```
- One canonical URL per resource; **301 redirects** managed in `redirects` for slug changes.
- Filters use query params with a canonical pointing to the clean category URL; selected
  high-value facets (e.g. `/phones/5g`) can be promoted to indexable landing pages.
- Trailing-slash + case normalized at the edge.

## 8.3 Internationalization (hreflang)

- Locale strategy: **subdirectory** `gadgethub.com/{country}/...` (or ccTLD/subdomain configurable).
- Every localized URL emits an `hreflang` cluster from `seo_hreflangs` + `x-default`.
- Per-country pricing/availability change content but canonical stays locale-specific; duplicate
  guard via hreflang reciprocity.

## 8.4 Metadata Pipeline

`generateMetadata()` (Next.js) reads `seo_metadata` (with sensible auto-fallbacks):
- Auto title templates: `"{Product} Price & Specs ({Year}) | {Site}"`,
  `"{A} vs {B}: Specs & Price Comparison"`.
- Meta description auto-composed from key specs + best price + rating when not overridden.
- Canonical, robots, Open Graph (image = product gallery/OG override), Twitter card.
- Editors override any field in the admin SEO tab; live SERP/social preview + scoring.

## 8.5 Sitemaps (sharded, generated to S3, served via CDN)

```
/sitemap.xml                 → index referencing all child sitemaps
/sitemaps/products-{n}.xml   → 50,000 URLs/file, <lastmod> from updated_at
/sitemaps/categories.xml
/sitemaps/brands.xml
/sitemaps/articles.xml
/sitemaps/news.xml           → Google News (last 48h, <news:news>)
/sitemaps/images-{n}.xml     → product gallery images (<image:image>)
/sitemaps/comparisons.xml    → popular precomputed comparisons
```
- A worker regenerates affected shards on content change (event-driven) + full nightly rebuild.
- `<lastmod>` accuracy drives efficient recrawl; `changefreq`/`priority` tuned per type.
- Submitted via Google/Bing **IndexNow** + Search Console API on publish for fast indexing.

## 8.6 On-Page SEO Features
- Breadcrumbs (UI + `BreadcrumbList` schema).
- Auto FAQ blocks ("What is the price of X?", "Is X waterproof?") → `FAQPage` schema.
- Internal linking: related/similar products, "vs" suggestions, brand/category hubs — distributes
  link equity and boosts crawl depth.
- Semantic HTML, single `H1`, descriptive `alt` text (from `media.alt_text`), table markup for specs.
- Pagination via `rel=next/prev` semantics + canonical; infinite scroll has crawlable `<a>` fallbacks.

## 8.7 Technical SEO Guardrails
- `robots.txt` from settings; block faceted noise, `/go/` redirects, search results, admin.
- Soft-404 prevention; `410` for permanently removed products (`redirect_type='410'`).
- Mobile-first, fast TTFB (edge cache), valid structured data (Rich Results),
  `Last-Modified`/`ETag` for conditional GETs.
- Monitoring: Search Console + log-based crawl analytics + Lighthouse CI budget gate in CI/CD.
- Optional integration with the **Ahrefs/keyword MCP tooling** in this environment for ongoing rank
  tracking, keyword research feeding content briefs, and site-audit issue triage.
