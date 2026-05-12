# Candidate Domain Specification

## Overview

The candidate domain owns the talent-side lifecycle in SkillBridge after authentication:

- onboarding
- role track selection
- assessment participation
- score visibility
- readiness state
- publishable profile state
- AI guidance and checklist progress

This domain should stay separate from auth. Auth proves identity. Candidate owns candidate-facing product state.

## Domain Boundaries

Candidate should own:

- candidate profile record
- onboarding completion for candidate-specific steps
- role track selection
- candidate readiness status
- publishable profile metadata
- candidate assessment history linkage
- candidate checklist and guidance linkage

Candidate should not own:

- login, token issuance, refresh, logout
- employer discovery workflows
- admin moderation and override policy
- raw scoring engine rules

## Core Entities

### `users`

Candidate depends on `users` but does not replace it.

Required assumptions:

- `users.role` must support `candidate`
- one `users` record maps to at most one candidate profile
- identity data stays on `users`

### `candidate_profiles`

Recommended shape:

```sql
CREATE TABLE candidate_profiles (
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

## Candidate-Owned Relationships

Candidate is the parent context for:

- assessments
- task submissions
- interviews
- composite scores
- AI guidance
- checklist items
- retake windows

This means candidate profile deletion should be treated as destructive and likely admin-only if soft deletion is introduced later.

## Module Layout

Recommended Nest module shape:

```text
src/modules/candidate/
  candidate.module.ts
  candidate.controller.ts
  candidate.service.ts
  dto/
  entities/
  actions/
```

Keep this module narrow:

- `candidate.service.ts` for candidate business rules
- `entities/` for persistence models
- `dto/` for transport contracts
- `actions/` only if you keep the current `AbstractModelAction` pattern

Do not mix assessment scoring logic into candidate service. Candidate should orchestrate, not calculate.

## API Surface

Initial endpoints:

- `GET /api/v1/candidate/me`
- `PATCH /api/v1/candidate/me`
- `POST /api/v1/candidate/onboarding`
- `POST /api/v1/candidate/publish`
- `POST /api/v1/candidate/unpublish`
- `GET /api/v1/candidate/status`

Likely future endpoints:

- `GET /api/v1/candidate/assessments`
- `GET /api/v1/candidate/scores`
- `GET /api/v1/candidate/guidance`
- `GET /api/v1/candidate/checklist`

## Business Rules

- Only users with role `candidate` can access candidate endpoints.
- Candidate profile should be created once, either:
  - immediately after candidate signup, or
  - during role-selection onboarding
- A candidate cannot publish a profile before meeting the minimum readiness rule.
- Readiness state should come from scored product workflows, not from client input.
- `profile_share_link` must be stable once published unless there is an explicit regeneration feature.
- Candidate onboarding completion should be tracked separately from auth success.

## Read Model

Candidate dashboard reads will eventually need a composed view across:

- `candidate_profiles`
- latest assessment state
- latest composite score
- latest AI guidance
- checklist completion counts

Do not force the controller to manually join these pieces. Add service-level query methods or dedicated read services when this grows.

## Security and Permissions

- Candidate can read and update only their own candidate profile.
- Candidate cannot set their own readiness status directly.
- Candidate cannot self-promote role.
- Candidate profile publish and unpublish actions should be audited once audit logging exists.

## Rollout Order

1. Add role support and candidate profile schema.
2. Create candidate module and `me` endpoints.
3. Add onboarding flow persistence.
4. Add publishability rules.
5. Integrate assessment and scoring read models.
6. Add guidance and checklist reads.

## Open Decisions

- Should `country` live on `users` or `candidate_profiles`?
- Should onboarding step tracking be generic on `users` or domain-specific on `candidate_profiles`?
- Should candidate profile use soft delete or hard delete?
- Should publish eligibility be stored or derived on demand?
