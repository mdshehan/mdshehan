# 5. Folder Structure

A **pnpm + Turborepo monorepo** keeps the Next.js storefront, Next.js admin, NestJS API, async
workers, and shared packages (types, validation, UI) in one place with shared TypeScript types —
eliminating contract drift between client and server.

## 5.1 Monorepo Top Level

```
global-gadget-price-hub/
├── apps/
│   ├── web/            # Next.js storefront (App Router, SSR/ISR/RSC)
│   ├── admin/          # Next.js admin dashboard (shadcn/ui)
│   ├── api/            # NestJS REST + GraphQL
│   └── workers/        # BullMQ background jobs (crawlers, indexer, sitemaps...)
├── packages/
│   ├── types/          # shared TS types + Zod schemas (single source of truth)
│   ├── ui/             # shared shadcn/ui component library + Tailwind preset
│   ├── sdk/            # generated typed API client (OpenAPI → TS)
│   ├── config/         # eslint, tsconfig, tailwind, prettier presets
│   └── schema-ld/      # JSON-LD builders (Product/Review/FAQ/Breadcrumb...)
├── infra/
│   ├── terraform/      # AWS infra as code (VPC, EKS, RDS, ElastiCache, S3...)
│   ├── k8s/            # Helm charts / manifests
│   └── docker/         # Dockerfiles + docker-compose for local dev
├── database/
│   ├── schema.sql      # canonical DDL
│   ├── migrations/     # prisma/typeorm migrations
│   └── seeds/          # countries, currencies, roles, demo catalog
├── docs/               # this architecture set
├── .github/workflows/  # CI/CD pipelines
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## 5.2 API (NestJS) — modular monolith

```
apps/api/src/
├── main.ts
├── app.module.ts
├── common/                     # cross-cutting: guards, interceptors, filters, decorators
│   ├── guards/                 # JwtAuthGuard, PermissionsGuard, ThrottlerGuard
│   ├── interceptors/           # logging, transform, cache, idempotency
│   ├── filters/                # ProblemJsonExceptionFilter
│   ├── pipes/                  # ZodValidationPipe
│   └── decorators/             # @Permissions(), @CurrentUser(), @Country()
├── config/                     # env schema (Zod), typed config service
├── database/                   # Prisma/TypeORM module, repositories base
├── modules/
│   ├── auth/                   # login, refresh, RBAC, sessions, 2FA
│   ├── users/
│   ├── catalog/
│   │   ├── products/           # controller, service, repo, dto, mapper
│   │   ├── brands/
│   │   ├── categories/
│   │   ├── specifications/
│   │   └── variants/
│   ├── pricing/                # prices, price-history, FX
│   ├── stores/
│   ├── affiliate/              # links, redirect /go, click tracking, postbacks
│   ├── reviews/
│   ├── content/                # articles, pages, menus, layouts (builder)
│   ├── media/                  # S3 presign, image variants
│   ├── search/                 # Meili/ES indexing + query
│   ├── compare/
│   ├── ads/                    # ad decisioning + impression beacons
│   ├── seo/                    # metadata, hreflang, sitemaps, robots
│   ├── schema/                 # JSON-LD generation
│   ├── localization/           # countries, currencies, languages, translations
│   ├── notifications/
│   ├── analytics/              # rollups, dashboards
│   └── settings/
├── graphql/                    # schema-first SDL, resolvers wiring modules
└── jobs/                       # queue producers (consumers live in apps/workers)
```

Each module follows: `*.controller.ts` → `*.service.ts` → `*.repository.ts` with `dto/`
(Zod-validated) and `entities/`. This boundary lets any module graduate to its own service.

## 5.3 Web Storefront (Next.js App Router)

```
apps/web/src/
├── app/
│   ├── (storefront)/
│   │   ├── layout.tsx                  # header/footer from layout API, theme provider
│   │   ├── page.tsx                    # homepage (ISR, layout blocks)
│   │   ├── [country]/                  # optional country-prefixed locale routes
│   │   ├── products/[slug]/page.tsx    # product page (ISR + on-demand revalidate)
│   │   ├── brands/[slug]/page.tsx
│   │   ├── category/[...slug]/page.tsx # category landing + faceted filters
│   │   ├── compare/page.tsx
│   │   ├── search/page.tsx
│   │   ├── deals/page.tsx
│   │   ├── reviews/[slug]/page.tsx
│   │   ├── news/[slug]/page.tsx
│   │   └── buying-guides/[slug]/page.tsx
│   ├── sitemap.xml/route.ts            # dynamic sitemap index
│   ├── robots.txt/route.ts
│   └── api/revalidate/route.ts         # on-demand ISR webhook (price change)
├── components/                          # product cards, spec table, price table, charts
│   ├── product/
│   ├── compare/
│   ├── search/
│   ├── ads/                            # AdSlot, lazy-loaded
│   └── layout-blocks/                  # renderers for builder block_types
├── lib/
│   ├── api.ts                          # typed SDK client (server + client)
│   ├── seo.ts                          # generateMetadata helpers
│   ├── jsonld.ts                       # inject schema-ld package output
│   └── currency.ts                     # FX display formatting
├── hooks/
├── stores/                             # zustand (compare tray, country, theme)
└── styles/
```

## 5.4 Admin Dashboard (Next.js)

```
apps/admin/src/app/
├── (dashboard)/
│   ├── layout.tsx                      # sidebar nav gated by permissions
│   ├── page.tsx                        # analytics overview
│   ├── products/                       # list, create, edit (tabs: specs/variants/media/seo/prices)
│   ├── brands/  categories/
│   ├── content/  pages/  deals/
│   ├── layout-builder/                 # drag/drop block editor (dnd-kit)
│   ├── menu-builder/
│   ├── ads/  affiliate/
│   ├── seo/  schema/  redirects/  sitemaps/
│   ├── localization/                   # countries/currencies/languages/translations
│   ├── media/                          # media library grid
│   ├── reviews/                        # moderation queue
│   ├── users/  roles/
│   └── settings/  activity-logs/
└── components/                          # data tables (TanStack), forms (react-hook-form + zod)
```

## 5.5 Workers

```
apps/workers/src/
├── index.ts                # bootstraps BullMQ workers
├── queues.ts               # queue names + connection
├── jobs/
│   ├── price-ingest.ts     # crawl/feed → prices + price_history
│   ├── fx-rates.ts         # refresh currencies.usd_rate
│   ├── search-index.ts     # upsert/delete search docs
│   ├── sitemap.ts          # regenerate sitemaps → S3
│   ├── image-process.ts    # generate webp/avif/thumb + blurhash
│   ├── notifications.ts    # price-drop alerts, emails
│   ├── analytics-rollup.ts # nightly aggregates → dashboards
│   └── revalidate.ts       # trigger Next.js on-demand ISR
└── schedulers/             # repeatable/cron job definitions
```

## 5.6 Alternative: Laravel 12 API

If Laravel is chosen instead of NestJS, `apps/api` becomes a standard Laravel app
(`app/Models`, `app/Http/Controllers/Api`, `app/Services`, `routes/api.php`,
`database/migrations`) using **Laravel Sanctum** (JWT/SPA auth), **spatie/laravel-permission**
(RBAC), **Laravel Scout** (Meili/ES), **Horizon** (Redis queues), and **Octane** (high-perf).
The DB schema, REST contract, and infra in this repo are framework-agnostic.
