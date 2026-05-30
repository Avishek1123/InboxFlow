# InboxFlow AI

Unified Gmail + WhatsApp Business inbox with AI extraction, automations, and scheduled outbound messaging.

## Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui (Step 1+)
- **Backend:** Next.js API Routes, Prisma, PostgreSQL (Neon)
- **Auth:** Firebase Authentication (email, Google, +91 phone)
- **Queue:** Upstash Redis, BullMQ, Trigger.dev
- **AI:** OpenAI
- **Hosting:** Vercel

## Getting started

### Option A — Local Node.js

```bash
npm install
npm run dev
```

### Option B — Docker (recommended for full stack)

Runs **Next.js**, **PostgreSQL 16**, and **Redis 7** together.

```bash
# 1. Environment
cp .env.docker.example .env
# Edit .env — add AI keys, Clerk, etc.

# 2. Start stack (dev mode with hot reload)
npm run docker:dev:build

# 3. Open app
# http://localhost:3000
```

**Useful commands:**

| Command | Description |
|---------|-------------|
| `npm run docker:dev` | Start dev stack |
| `npm run docker:dev:build` | Rebuild and start |
| `npm run docker:dev:down` | Stop containers |
| `npm run docker:migrate` | Run Prisma migrations only |
| `npm run docker:prod` | Production build + compose |

**Production Docker:**

```bash
cp .env.docker.example .env
# Set POSTGRES_PASSWORD in shell or .env for docker-compose.prod.yml
export POSTGRES_PASSWORD=your-secure-password
npm run docker:prod
```

**Services:**

| Service | URL / Port |
|---------|------------|
| App | http://localhost:3000 |
| PostgreSQL | `localhost:5432` (user/pass/db: `inboxflow`) |
| Redis | `localhost:6379` |

Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health).

## Project structure

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full folder layout and conventions.

## Phase 1 progress

| Step | Status |
|------|--------|
| 1. Folder architecture | ✅ |
| 2. Prisma schema | Pending |
| 3. Environment variables | Pending |
| 4. Prisma client | Pending |
| 5. Clerk auth | Pending |
| 6. Protected dashboard | Pending |
| 7. Sidebar navigation | Pending |
| 8. Database service layer | Pending |
| 9. Repository pattern | Pending |
| 10. API architecture | Pending |
