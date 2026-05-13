# RFC: Multi-Factor Authentication (MFA)

## Problem

SkillBridge users have only password protection. If a password is compromised, attackers get full access. Also, users who lose their authenticator app have no way back into their account.

## What We're Building

TOTP-based MFA using authenticator apps (Google Authenticator, Authy) with backup recovery codes.

**How it works:**
1. User logs in with email/password
2. If MFA enabled, they're asked for a code
3. They enter TOTP code from their app OR a recovery code
4. Valid code grants access

**Key features:**
- TOTP secret stored encrypted in database
- 8 recovery codes given on enable (shown once, stored hashed)
- Single-use state token prevents replay attacks
- Disable/regenerate requires password and clears recovery codes

## How It Affects Other Teams

**Frontend:** New login flow handling for "2FA required" state. Settings page for MFA setup/disable.

**Design:** TOTP QR display, recovery codes view, MFA settings UI.

**Product:** Security feature for enterprise positioning. Support docs for locked-out users.

## Alternatives Considered

**SMS OTP:** Rejected - costs money per message, vulnerable to SIM-swap attacks.

**Email OTP:** Rejected - using same channel as first factor reduces security.

**Hardware keys (WebAuthn):** Deferred - requires more frontend work.

## Risks

- User lockout if they lose both authenticator AND recovery codes (defer support flow)
- Adoption friction if setup too complex (make recovery codes prominent)

---

# Change Log

Login activity tracking and suspicious login alerts removed from initial release. Requires extra infrastructure - will add in future sprint.

---

# Message to PM

Hey,

Quick update on MFA for the demo:

**Done:** TOTP setup, login with 2FA, recovery codes as backup, disable/regenerate options.

**Cut for demo:** Login activity history and suspicious login alerts - need extra infrastructure.

**Impact:** Core MFA works fully. Activity tracking comes later.

Let me know if you need anything else.

[Your Name]