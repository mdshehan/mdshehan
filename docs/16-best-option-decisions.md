# 16. Best-Option Decisions (optimized for: high traffic · easy to manage & move · easy to extend)

> A decision record. Every choice here is scored against three goals:
> **T** = handles high traffic easily · **M** = easy to manage & move (no lock-in) · **E** = easy to add features.
> The through-line: **portable open components + a modular monolith + edge-cached reads.**

## 16.1 The Verdict (TL;DR)

| Decision | Best option | Why (T / M / E) |
|----------|-------------|-----------------|
| App architecture | **Modular monolith** (NestJS, TypeScript) — split into services later | **E**: add a feature = add a module, clear boundaries · **M**: one deployable, one language, simple to reason about · **T**: stateless → scale horizontally |
| Language | **TypeScript everywhere** (API + web + admin + shared types) | **E/M**: one skillset, shared contracts, no DTO drift |
| Frontend | **Next.js (App Router) + ISR + Cloudflare** | **T**: most reads served from edge cache, origin barely touched · **M**: runs as a container *or* on Vercel |
| Database | **PostgreSQL (managed, portable)** | **T**: read replicas + partitioning · **M**: speaks the same SQL on RDS / Neon / Supabase / self-host · **E**: JSONB + EAV = add fields without migrations |
| Cache / Queue | **Redis** | portable, runs anywhere; cache + BullMQ jobs |
| Search | **Meilisearch** (single binary) → OpenSearch at scale | **M**: trivial to run/move · **T**: offloads filters/facets from PG |
| Object storage | **S3-compatible API** | **M**: identical code on AWS S3 / Cloudflare R2 / MinIO — zero lock-in |
| Edge / CDN | **Cloudflare** | **T**: absorbs traffic, image resizing, WAF · cheap egress |
| Packaging | **Docker containers** | **M**: the unit that moves between any host unchanged |
| Hosting (start) | **Managed container PaaS** (Fly.io / Render / Railway) | **M**: lowest ops burden to run & move · graduate to Kubernetes only when scale demands |
| Hosting (scale) | **Kubernetes (EKS/GKE/any)** | **T**: autoscaling, multi-AZ — *same containers*, no rewrite |
| Infra | **Terraform + Docker Compose** | **M**: reproducible, cloud-agnostic, one command to recreate |

## 16.2 Goal 1 — Handle high traffic *easily*

The strategy is **"don't scale the hard part — cache it."**
- **Edge-first reads**: Cloudflare + Next.js **ISR** serve pre-rendered product/listing HTML from
  cache near users. At steady state, >95% of reads never reach the API or DB. Traffic spikes hit
  cache, not origin → you scale by doing *less*, not by buying bigger DBs.
- **Stateless app tier**: API/web/workers hold no session state (it's in Redis) → add replicas
  linearly behind a load balancer; autoscale on CPU + queue depth.
- **Read offload**: Postgres **read replicas** for reads, **search engine** for filters/facets,
  **Redis** for hot objects. The primary DB only handles writes → it stays small and fast.
- **Write spikes absorbed by queues**: price crawls, click tracking, indexing, emails run async on
  BullMQ → the request path never waits on heavy work.
- **Partitioned hot tables** (`price_history`, `affiliate_clicks`) keep big tables fast and prunable.

> Net effect: 10× traffic is mostly a CDN/cache concern + a few more stateless replicas — not a
> re-architecture.

## 16.3 Goal 2 — Easy to manage *and move* (no lock-in)

The strategy is **"build only on components that run anywhere."**
- Every data component speaks an **open, portable interface**: PostgreSQL (SQL), Redis,
  S3-compatible storage, Meilisearch. The **same code** runs on AWS, GCP, Cloudflare, Fly.io, or a
  laptop — you change connection strings, not code.
- **Containers as the unit of movement**: `docker compose` locally → managed PaaS → Kubernetes, all
  the identical image. Moving clouds = re-point Terraform at a new provider.
- **Avoid proprietary glue**: no provider-specific queues, DBs, or function runtimes in the core
  path. (Managed *versions* of open tech are fine — RDS Postgres, ElastiCache Redis — because the
  interface stays portable.)
- **Low ops to start**: launch on a managed container PaaS so there's almost nothing to operate;
  only adopt Kubernetes when traffic genuinely needs it. Same containers, so the move is painless.
- **One language, one repo, IaC**: a single TypeScript monorepo + Terraform means one onboarding
  path, reproducible environments, and a documented, automatable migration story.

> Net effect: you are never trapped on one vendor; "move" is a config + Terraform change, not a port.

## 16.4 Goal 3 — Add features *easily*

The strategy is **"data-driven, modular, contract-safe."**
- **Modular monolith**: each domain (catalog, pricing, affiliate, content, ads, seo, search…) is a
  self-contained NestJS module with its own controller/service/repo. A new feature is a new module
  or a new method — it doesn't ripple across the codebase, and it can later become its own service
  with no rewrite.
- **Category-agnostic catalog**: new gadget types (drones, EVs, anything) need only new
  `categories` + `specification_attributes` rows. **No schema migration** — EAV + JSONB specs +
  dynamic forms/facets already adapt. This is the single biggest "add features easily" lever.
- **Pluggable UI & monetization**: the **layout builder** adds homepage sections via new
  `block_type` renderers; **ad types** and **affiliate networks** are config/data, not code forks.
- **Shared types package**: API and frontend share Zod schemas/types → adding a field is a
  one-place change the compiler enforces everywhere, so features land without contract bugs.
- **Feature flags**: ship code dark and enable per-cohort → safe, frequent feature releases.

> Net effect: most new capabilities are *configuration or one module*, not surgery on the core.

## 16.5 What we deliberately did NOT pick (and why)

| Tempting option | Rejected because |
|-----------------|------------------|
| Microservices from day one | Heavy ops, distributed-debugging tax — *hurts M & E* early. The modular monolith gets the same extensibility and splits later only where **T** demands. |
| Serverless functions for core API | Cold starts + per-vendor runtime lock-in — *hurts M*; awkward for long crawls/queues. |
| Provider-proprietary DB (e.g. DynamoDB single-table) | Lock-in + rigid for evolving specs — *hurts M & E*. Postgres+JSONB gives flexibility *and* portability. |
| Kubernetes before product-market fit | Real ops burden — *hurts M*. Start on PaaS; same containers move to K8s when **T** justifies it. |

## 16.6 Decision rule going forward

> **When two options tie on features, choose the one that is more portable and simpler to operate.**
> Prefer open interfaces (SQL/Redis/S3/containers) over vendor magic; prefer caching/async over
> bigger machines; prefer adding a module/row over changing the schema. That ordering keeps all
> three goals — traffic, portability, extensibility — satisfied at once.
