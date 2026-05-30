# InboxFlow AI — Folder Architecture

Production SaaS layout for unified Gmail + WhatsApp inbox, AI extraction, automations, and scheduling.

## Top-level layout

```
inboxflow-ai/
├── prisma/                    # Database schema & migrations (Step 2+)
├── public/                    # Static assets
├── src/
│   ├── app/                   # Next.js App Router (routes, layouts, API)
│   ├── components/            # Shared UI (shadcn/ui, layout shells)
│   ├── features/              # Domain modules (colocated logic per feature)
│   ├── hooks/                 # Client React hooks
│   ├── lib/                   # Pure utilities, constants, Zod schemas
│   ├── services/              # Client-side API / integration callers
│   ├── server/                # Server-only: DB, repositories, actions
│   └── types/                 # Shared TypeScript types
├── components.json            # shadcn/ui configuration
└── ARCHITECTURE.md            # This file
```

## Route groups (`src/app`)

| Group | URL prefix | Purpose |
|-------|------------|---------|
| `(marketing)` | `/` | Public landing, pricing, docs |
| `(auth)` | `/sign-in`, `/sign-up` | Clerk auth pages (Step 5) |
| `(dashboard)` | `/dashboard`, `/inbox`, … | Authenticated product shell (Step 6+) |

## API (`src/app/api`)

```
api/
├── health/          # Liveness probe for Vercel / monitoring
└── v1/              # Versioned REST surface (webhooks, CRUD)
    ├── webhooks/    # Gmail, WhatsApp, Stripe ingress
    └── ...
```

## Feature modules (`src/features`)

Each folder owns UI fragments, hooks, and feature-specific types. Cross-cutting server logic lives in `src/server`.

| Module | Responsibility |
|--------|----------------|
| `auth` | Session UX, org switcher |
| `dashboard` | Overview metrics & widgets |
| `gmail` | OAuth, sync, Gmail-specific UI |
| `whatsapp` | Meta Business API connection |
| `inbox` | Unified thread list & composer |
| `ai-extraction` | Structured field extraction from messages |
| `automations` | Rule builder & execution history |
| `scheduler` | Outbound message queue UI |
| `billing` | Stripe subscription management |
| `settings` | Org & account preferences |

## Server layer (`src/server`)

```
server/
├── db/              # Prisma client singleton (Step 4)
├── repositories/    # Data access per aggregate (Step 9)
└── actions/         # Server Actions for mutations
```

## Import aliases

- `@/*` → `src/*` (configured in `tsconfig.json`)

## Conventions

1. **Colocation**: Prefer `features/<name>/` for domain UI; keep `components/ui` for design system only.
2. **Server boundary**: Never import `src/server/*` from client components.
3. **API versioning**: All external contracts under `api/v1/`.
4. **Types**: Shared DTOs in `src/types`; Prisma-generated types re-exported from `src/server/db` when needed.
