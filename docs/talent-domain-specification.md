# Talent Domain Specification

## Overview

The talent domain owns the talent-side lifecycle in SkillBridge after authentication:

- onboarding
- role track selection
- assessment participation
- score visibility
- readiness state
- publishable profile state
- AI guidance and checklist progress

This domain should stay separate from auth. Auth proves identity. Talent owns talent-facing product state.

## Domain Boundaries

Talent should own:

- talent profile record
- onboarding completion for talent-specific steps
- role track selection
- talent readiness status
- publishable profile metadata
- talent assessment history linkage
- talent checklist and guidance linkage

Talent should not own:

- login, token issuance, refresh, logout
- employer discovery workflows
- admin moderation and override policy
- raw scoring engine rules

## Core Entities

### `users`

Talent depends on `users` but does not replace it.

Required assumptions:

- `users.role` must support `talent` for talent journeys
- one `users` record maps to at most one talent profile
- identity data stays on `users`

### `talent_profiles`

Recommended shape:

```sql
CREATE TABLE talent_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  role_track VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'not_started',
  onboarding_step VARCHAR(50),
  bio TEXT,
  country VARCHAR(100),
  profile_share_link VARCHAR(255) UNIQUE,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

Status should be explicit and product-facing:

- `not_started`
- `in_progress`
- `not_ready`
- `emerging`
- `job_ready`

## Talent-Owned Relationships

Talent is the parent context for:

- assessments
- task submissions
- interviews
- composite scores
- AI guidance
- checklist items
- retake windows

This means talent profile deletion should be treated as destructive and likely admin-only if soft deletion is introduced later.

## Module Layout

Recommended Nest module shape:

```text
src/modules/talent/
  talent.module.ts
  talent.controller.ts
  talent.service.ts
  dto/
  entities/
  actions/
```

Keep this module narrow:

- `talent.service.ts` for talent business rules
- `entities/` for persistence models
- `dto/` for transport contracts
- `actions/` only if you keep the current `AbstractModelAction` pattern

Do not mix assessment scoring logic into talent service. Talent should orchestrate, not calculate.

## API Surface

Initial endpoints:

- `GET /api/v1/talent/me`
- `PATCH /api/v1/talent/me`
- `POST /api/v1/talent/onboarding`
- `POST /api/v1/talent/publish`
- `POST /api/v1/talent/unpublish`
- `GET /api/v1/talent/status`

Likely future endpoints:

- `GET /api/v1/talent/assessments`
- `GET /api/v1/talent/scores`
- `GET /api/v1/talent/guidance`
- `GET /api/v1/talent/checklist`

## Business Rules

- Only users with role `talent` can access talent endpoints.
- Talent profile should be created once, either:
  - immediately after talent signup, or
  - during talent-specific onboarding
- A talent user cannot publish a profile before meeting the minimum readiness rule.
- Readiness state should come from scored product workflows, not from client input.
- `profile_share_link` must be stable once published unless there is an explicit regeneration feature.
- Talent onboarding completion should be tracked separately from auth success.

## Read Model

Talent dashboard reads will eventually need a composed view across:

- `talent_profiles`
- latest assessment state
- latest composite score
- latest AI guidance
- checklist completion counts

Do not force the controller to manually join these pieces. Add service-level query methods or dedicated read services when this grows.

## Security and Permissions

- Talent users can read and update only their own talent profile.
- Talent cannot set their own readiness status directly.
- Talent cannot self-promote role.
- Talent profile publish and unpublish actions should be audited once audit logging exists.

## Rollout Order

1. Add role support and talent profile schema.
2. Create talent module and `me` endpoints.
3. Add onboarding flow persistence.
4. Add publishability rules.
5. Integrate assessment and scoring read models.
6. Add guidance and checklist reads.

## Open Decisions

- Should `country` live on `users` or `talent_profiles`?
- Should onboarding step tracking be generic on `users` or domain-specific on `talent_profiles`?
- Should talent profile use soft delete or hard delete?
- Should publish eligibility be stored or derived on demand?
