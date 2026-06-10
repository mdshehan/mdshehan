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

## 5. Try it
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

## Workspace layout (current)
```
apps/api/                 NestJS API
  prisma/schema.prisma    data layer (mirrors database/schema.sql)
  prisma/seed.ts          seed data
  src/
    modules/catalog/      products · brands · categories (vertical slice)
    modules/localization/ countries · currencies · languages · /config
    health/               /healthz · /readyz
database/schema.sql       canonical reference DDL
docs/                     full architecture (16 docs)
```

## Next steps (roadmap)
1. ✅ Monorepo + DB layer + seed (this step)
2. Catalog write endpoints + RBAC auth module (JWT + permissions guard)
3. Pricing/affiliate modules + `/go/:code` redirect + click tracking
4. Search module (Meilisearch indexer + autocomplete)
5. `apps/web` Next.js storefront consuming the API (product page first)
6. `apps/admin` dashboard
