# Docker Guide — InboxFlow AI

## Quick start (development)

```bash
cp .env.docker.example .env
npm run docker:dev:build
```

| Service    | Endpoint |
|-----------|----------|
| App       | http://localhost:3000 |
| PostgreSQL | `localhost:5432` |
| Redis     | `localhost:6379` |

Default DB credentials: `inboxflow` / `inboxflow` / database `inboxflow`

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   app       │────▶│  postgres    │     │   redis     │
│  (Next.js)  │     │  (Prisma)    │     │  (queues)   │
│  :3000      │     │  :5432       │     │  :6379      │
└─────────────┘     └──────────────┘     └─────────────┘
```

- **Dockerfile.dev** — hot reload, volume-mounted source
- **Dockerfile** — multi-stage production build (`output: standalone`)
- **docker-compose.yml** — local dev stack
- **docker-compose.prod.yml** — production images + migrate job

## Commands

```bash
npm run docker:dev          # Start dev stack
npm run docker:dev:build    # Rebuild images
npm run docker:dev:down     # Stop
npm run docker:migrate      # Run migrations only
npm run docker:prod         # Production stack
```

## Environment

Inside Docker, the app uses service hostnames:

- `DATABASE_URL=postgresql://inboxflow:inboxflow@postgres:5432/inboxflow`
- `REDIS_URL=redis://redis:6379`

Copy `.env.docker.example` to `.env` and add API keys (Groq, Gemini, Clerk, etc.).

## Production notes

1. Set a strong `POSTGRES_PASSWORD` before `docker compose -f docker-compose.prod.yml up`
2. Migrations run via the `migrate` service before `app` starts
3. For Neon/production DB, run the app container only and point `DATABASE_URL` to Neon

## Troubleshooting

**Port 5432 already in use** — change the host port in `docker-compose.yml`:

```yaml
ports:
  - "5433:5432"
```

**Prisma errors on first boot** — wait for Postgres healthcheck, or run:

```bash
npm run docker:migrate
```

**Rebuild after dependency changes:**

```bash
docker compose down -v   # optional: reset DB volumes
npm run docker:dev:build
```
