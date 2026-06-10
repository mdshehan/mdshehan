# Global Gadget Price Hub — Architecture & Design

> Enterprise-grade international gadget **price-comparison + content + affiliate** platform.
> Comparable to **GSMArena + MobileDokan + PriceRunner + PriceGrabber + Kimovil + PhoneArena**, combined.

This repository folder contains the **complete production-ready system design**: architecture,
database schema, API surface, admin dashboard modules, SEO/Schema strategy, caching, security,
deployment, AWS infrastructure, CI/CD, and a future scalability plan.

---

## 📚 Document Index (15 Deliverables)

| # | Deliverable | Document |
|---|-------------|----------|
| 1 | Complete System Architecture | [01-system-architecture.md](./01-system-architecture.md) |
| 2 | Database Schema | [02-database-schema.md](./02-database-schema.md) · [`/database/schema.sql`](../database/schema.sql) |
| 3 | ER Diagram | [03-er-diagram.md](./03-er-diagram.md) |
| 4 | API Structure | [04-api-structure.md](./04-api-structure.md) |
| 5 | Folder Structure | [05-folder-structure.md](./05-folder-structure.md) |
| 6 | Admin Dashboard Design | [06-admin-dashboard.md](./06-admin-dashboard.md) |
| 7 | Frontend Wireframes | [07-frontend-wireframes.md](./07-frontend-wireframes.md) |
| 8 | SEO Architecture | [08-seo-architecture.md](./08-seo-architecture.md) |
| 9 | Schema (JSON-LD) Architecture | [09-schema-architecture.md](./09-schema-architecture.md) |
| 10 | Caching Strategy | [10-caching-strategy.md](./10-caching-strategy.md) |
| 11 | Security Architecture | [11-security-architecture.md](./11-security-architecture.md) |
| 12 | Deployment Architecture | [12-deployment-architecture.md](./12-deployment-architecture.md) |
| 13 | AWS Infrastructure Design | [13-aws-infrastructure.md](./13-aws-infrastructure.md) |
| 14 | CI/CD Pipeline | [14-cicd-pipeline.md](./14-cicd-pipeline.md) |
| 15 | Future Scalability Plan | [15-scalability-plan.md](./15-scalability-plan.md) |
| 16 | **Best-Option Decisions** (high traffic · easy to manage/move · easy to extend) | [16-best-option-decisions.md](./16-best-option-decisions.md) |

---

## 🧱 Tech Stack (Decision Summary)

| Layer | Choice | Why |
|-------|--------|-----|
| **Backend API** | **NestJS (TypeScript)** primary, Laravel 12 alt | Single-language stack with Next.js, first-class GraphQL + REST, modular DI, type-safety end-to-end |
| **Frontend** | Next.js (App Router) + React + TypeScript | SSR/ISR/RSC for SEO + Core Web Vitals |
| **UI** | TailwindCSS + shadcn/ui + Radix | Accessible, themeable (dark/light), fast |
| **Primary DB** | PostgreSQL 16 | Relational integrity, JSONB for flexible specs, partitioning for price_history |
| **Cache / Queue** | Redis 7 (+ BullMQ) | Caching, rate-limit, sessions, background jobs |
| **Search** | Meilisearch (start) → Elasticsearch (scale) | Typo-tolerant autocomplete, faceted filters |
| **Object Storage** | S3-compatible (AWS S3 / R2) | Media library, sitemaps, exports |
| **CDN / Edge** | Cloudflare | Caching, WAF, image resizing, DDoS |
| **Infra** | AWS (EKS) + Terraform | Reproducible, autoscaling, multi-AZ |

> **Why NestJS over Laravel as the default?** A single TypeScript monorepo (API + web + shared
> types + validation schemas) eliminates DTO drift, lets us share Zod/validation and the product
> domain model across server and client, and simplifies hiring for one language. Laravel 12 remains
> a fully-supported alternative — the database schema, API contract, and infra are framework-agnostic.

---

## 🗂️ Domain Overview

```
Catalog        → Products, Brands, Categories, Subcategories, Specifications, Variants, Tags
Commerce       → Stores, Prices, Price History, Affiliate Links, Click Tracking
Localization   → Countries, Currencies, Languages, Translations, Hreflang
Content        → Articles, Pages, Reviews, Ratings, Menus, Layout Blocks, Media
Monetization   → Advertisements, Ad Slots, Affiliate Revenue, EPC/CTR analytics
Discovery      → Search (Meili/ES), Comparisons, Recommendations
Platform       → Users, Roles, Permissions, SEO Metadata, Schema Data, Redirects,
                 Notifications, Activity Logs, Settings
```

## 🚀 Quick Start (intended)

```bash
# Monorepo (pnpm + turborepo)
pnpm install
docker compose up -d         # postgres, redis, meilisearch, minio
pnpm --filter api migrate     # run prisma/typeorm migrations
pnpm --filter api seed        # seed countries/currencies/roles
pnpm dev                      # web (3000) + api (4000) + admin (3001)
```

See [05-folder-structure.md](./05-folder-structure.md) for the full monorepo layout.
