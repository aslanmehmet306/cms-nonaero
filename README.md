# CMS Non-Aero

**Airport Non-Aeronautical Commercial Revenue Management Platform**

Havalimanı ticari gelir yönetimi SaaS platformu. Kontrat yönetimi, obligation schedule üretimi, revenue declaration, billing run orchestration ve Stripe entegrasyonu ile uçtan uca gelir döngüsünü yönetir.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS + TypeScript + Prisma |
| Frontend (Admin) | React 18 + Shadcn/ui + TanStack Query |
| Frontend (Tenant) | React 18 + Shadcn/ui (ayrı app) |
| Database | PostgreSQL 15 |
| Queue | BullMQ + Redis 7 |
| Invoice | Stripe (Provider-Agnostic Adapter) |
| Monorepo | Turborepo |

## Project Structure

```
cms-nonaero/
├── apps/
│   ├── api/          # NestJS Backend
│   ├── admin/        # React Admin Portal
│   └── portal/       # React Tenant Portal
├── packages/
│   ├── shared-types/ # Shared TypeScript interfaces
│   └── formula-engine/ # math.js expression parser
├── prisma/           # Schema + migrations + seed
├── docker/           # Docker Compose + Dockerfiles
└── docs/             # All design & specification docs
```

## Documentation

Tüm tasarım ve spesifikasyon dokümanları `docs/` klasöründe:

| # | Document | Description |
|---|----------|-------------|
| 01 | PRD v6 | Product Requirements Document |
| 02 | Phase 1 MVP Scope | MVP kapsam ve Go/No-Go checklist |
| 03 | Entity State Machines | 9 entity lifecycle tanımı |
| 04 | Core API Contracts | REST API endpoint tanımları |
| 05 | Data Model | Prisma schema (PostgreSQL) |
| 06 | Non-Functional Requirements | Performance, security, resilience |
| 07 | Role & Permission Matrix | RBAC (7 rol) |
| 08 | Tech Decisions & Architecture | Mimari kararlar ve monorepo yapısı |
| 09 | Gap Analysis | Geliştirme hazırlık değerlendirmesi (93/100) |
| 10 | Algorithm Pseudocode | 20+ temel algoritma |
| 11 | UI Page Specifications | Admin (21) + Tenant (10) sayfa tanımları |
| 12 | Revised Timeline | Solo developer 40 hafta plan |
| 13 | Email Notification Templates | 7 email template (Turkish) |

## Pilot

**Airport:** ADB (İzmir Adnan Menderes)
**Currency:** TRY
**Tenants:** 5 dummy tenant ile test

## License

Private — All rights reserved.
