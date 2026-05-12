# SkillBridge Backend

NestJS backend starter aligned with the HNG NestJS boilerplate conventions while keeping this service focused on SkillBridge's current auth, users, mail, and health modules.

## Runtime

- Node.js 20+
- pnpm 9+
- PostgreSQL

## Setup

```bash
pnpm install
cp .env.example .env
pnpm migration:run
pnpm start:dev
```

The API runs under `api/v1`, with health and probe endpoints excluded from the prefix.

## Routes

- `GET /health`
- `GET /probe`
- `GET /api/docs`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/users` admin-only

## Scripts

```bash
pnpm build
pnpm lint
pnpm test
pnpm test:e2e
pnpm migration:run
pnpm seed
```

## Docker

```bash
docker compose -f compose/docker-compose.yml up --build
```
