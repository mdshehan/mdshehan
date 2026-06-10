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
1. ✅ Monorepo + DB layer + seed
2. ✅ Auth (JWT + rotating refresh sessions) + RBAC permissions guard + catalog write endpoints
3. Pricing/affiliate modules + `/go/:code` redirect + click tracking
4. Search module (Meilisearch indexer + autocomplete)
5. `apps/web` Next.js storefront consuming the API (product page first)
6. `apps/admin` dashboard
