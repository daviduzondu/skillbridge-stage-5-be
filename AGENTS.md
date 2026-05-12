# AGENTS.md

## Inheritance

- Follow the user root AGENTS instructions above this repo.
- Repo-local instructions here narrow behavior for `skillbridge-be`.

## Project Context

- This repository is the backend for SkillBridge.
- Current stack: NestJS, TypeORM, PostgreSQL, JWT auth, Swagger, Resend.
- Product direction extends beyond current code into talent, employer, assessment, scoring, AI guidance, and notification domains.

## Caveman

- Talk plain. Short words. Clear steps.
- Do not hand-wave. Name the file, module, table, or endpoint.
- Small safe changes beat big clever rewrites.
- Schema first for backend architecture changes.
- Keep module boundaries obvious.
- If product spec and code disagree, call it out fast.
- Prefer boring, operable designs over fancy abstractions.

## Architecture Rules

- Treat PostgreSQL schema design as a first-class architecture concern.
- Keep Nest modules aligned to product domains, not generic utility buckets.
- Prefer explicit service and data boundaries over shared mutable logic.
- Add migrations deliberately. Do not rely on schema sync for real changes.
- Keep auth, user identity, profile domains, assessment domains, and scoring domains separable.
- Capture major design decisions in docs before or alongside invasive changes.

## Preferred Skills

- `postgres`
  - Use for schema design, migration strategy, relational modeling, indexing, query review, and performance planning.
- `documents:documents`
  - Use for architecture decision records, technical specs, domain docs, rollout plans, and stakeholder-facing backend design artifacts.

## When These Skills Matter

- Use `postgres` when changing `users`, future profile tables, refresh token storage, assessment data, scoring data, or reporting queries.
- Use `documents:documents` when introducing a new domain, changing auth or role models, proposing service boundaries, or formalizing product/backend architecture.

## Docs References

- Read `docs/auth-module-specification.md` before changing auth flows, roles, cookies, onboarding-related auth fields, or session contracts.
- Read `docs/database-schema.dbml` before changing tables, enums, relations, or introducing new persistence models.
- Read `docs/talent-domain-specification.md` before changing talent onboarding, talent profile shape, readiness state, publishability, or talent-facing endpoints.
- Read `docs/employer-domain-specification.md` before changing employer onboarding, employer profile shape, shortlist flows, contact flows, or employer-facing endpoints.
- If code and docs disagree, call out the mismatch clearly and propose which source should become canonical.

## Testing And Startup Flow

- Before starting the backend server, check if it is already running.
- Reuse the active server if it is healthy instead of starting a second copy.
- Check the existing server with a plain health probe first.
- Preferred checks:
  - process check for the Nest app or bound port
  - HTTP check against the running backend
- Only start the server if:
  - no active backend process is found, or
  - the process exists but the service is not healthy
- If a server must be started, use the normal project flow:
  - `pnpm install`
  - ensure `.env` is present
  - `pnpm migration:run` if the database is required and not ready
  - `pnpm start:dev` for local development unless a different mode is clearly needed
- Do not start duplicate dev servers on the same port.
- When tests depend on a running app, prefer the already active app before spawning a new one.
