# Contributing

## Before You Start

- Node.js 20+
- pnpm 9+
- PostgreSQL 14+

## Local Setup

```bash
pnpm install
cp .env.example .env
pnpm migration:run
pnpm start:dev
```

## Branches

- Branch from `main`
- Use `type/short-description` in lowercase kebab-case
- Allowed types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `build`, `ci`, `perf`, `style`

## Commits

- Use Conventional Commits: `type(scope)!: short summary`
- Keep subjects imperative and under 72 characters
- Add `!` or a `BREAKING CHANGE:` footer for breaking changes

## Checks

- Run `pnpm lint`
- Run `pnpm test:e2e`
- Run `pnpm build`
- A pre-commit hook runs `pnpm lint` and `pnpm test:e2e`

## PRs

Keep PRs short and use this structure:

1. What changed and why
2. Tasks completed
3. How it was implemented
4. Trade-offs or constraints
5. Tests run and evidence
6. Related issue

PRs should include:

- A clear description, not just a one-line summary
- Screenshots or a short video when the change benefits from visual proof
- Test output or logs for the relevant checks
- A link to the related issue

## Migrations

- Update entities first
- Generate a migration
- Run the migration

## Issues

- Reproduction steps
- Expected vs actual behavior
- Environment details
- Relevant logs or error output
