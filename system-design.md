# Multi-Factor Authentication System Design

## 1. Overview

The MFA system adds an additional security layer to user authentication. Users can enable 2FA via TOTP (Time-based One-Time Password) using an authenticator app (Google Authenticator, Authy, etc.), and receive 8 recovery codes as a backup. During login, after verifying their password, users must provide either a TOTP code or a recovery code to complete authentication.

## 2. Architecture

```mermaid
graph TB
    subgraph Client
        UI[Frontend App]
    end

    subgraph NestJS Backend
        AC[Auth Controller]
        AS[Auth Service]
        US[Users Service]
        G2[TwoFaPendingGuard]
        EU[Encryption Utils]
        R[Redis]
    end

    subgraph Database
        U[users table]
    end

    UI -->|POST /auth/mfa/totp/setup| AC
    UI -->|POST /auth/mfa/totp/enable| AC
    UI -->|POST /auth/mfa/disable| AC
    UI -->|POST /auth/mfa/verify| AC

    AC --> AS
    AS --> US
    AS --> EU
    AS --> R
    G2 --> AS
    US -->|SELECT/UPDATE| U
    EU -->|encrypt/decrypt| U
    R -->|state_token storage| AS
```

## 3. Components

| Component | Responsibility |
|-----------|----------------|
| AuthController | Exposes 2FA and MFA endpoints, validates DTOs |
| AuthService | TOTP/recovery code verification, secret generation, token issuance |
| UsersService | Persists 2FA state and encrypted secrets to database |
| EncryptionUtils | AES-256-GCM encryption for TOTP secrets |
| TwoFaPendingGuard | Validates temporary 2FA pending JWT tokens |
| RecoveryCode Entity | Stores hashed recovery codes, tracks used status |

## 4. Data Flow

### 4.1 Setup TOTP

```mermaid
sequenceDiagram
    participant U as User
    participant C as Auth Controller
    participant S as Auth Service
    participant E as Encryption Utils
    participant DB as Database

    U->>C: POST /auth/mfa/totp/setup
    C->>S: setup2faTotp(user)
    S->>E: generate secret + URI
    S->>DB: store encrypted secret
    DB-->>S: success
    S-->>C: { uri, secret }
    C-->>U: QR code URI + manual key
```

### 4.2 Enable TOTP (Verify First Code)

```mermaid
sequenceDiagram
    participant U as User
    participant C as Auth Controller
    participant S as Auth Service
    participant E as Encryption Utils
    participant DB as Database

    U->>C: POST /auth/mfa/totp/enable { code: "123456" }
    C->>S: enableTotp2fa(userId, code)
    S->>DB: fetch user + encrypted secret
    DB-->>S: user with encrypted secret
    S->>E: decrypt(encryptedSecret)
    E-->>S: plain secret
    S->>S: verifySync(secret, code)
    alt valid
        S->>DB: set two_fa_enabled = true
        DB-->>S: success
        S-->>C: success message
        C-->>U: "TOTP 2FA enabled"
    else invalid
        S-->>C: UnauthorizedError
        C-->>U: 401 Invalid code
    end
```

### 4.3 Login with 2FA

```mermaid
sequenceDiagram
    participant U as User
    participant C as Auth Controller
    participant S as Auth Service
    participant R as Redis

    U->>C: POST /auth/login { email, password }
    C->>S: login(dto)
    S->>S: validate password
    alt 2FA enabled
        S->>S: sign 2fa_pending JWT (5min)
        S->>R: SETEX state_token:{userId} 300 jwt
        R-->>S: OK
        S-->>C: { state_token, message: "2FA_REQUIRED" }
        C-->>U: redirect to 2FA input
    else no 2FA
        S-->>C: full tokens + user
    end
```

### 4.4 Verify TOTP After Login

```mermaid
sequenceDiagram
    participant U as User
    participant C as Auth Controller
    participant G as TwoFaPendingGuard
    participant S as Auth Service
    participant R as Redis
    participant E as Encryption Utils
    participant DB as Database

    U->>C: POST /auth/mfa { code: "123456" }
    Note over C,G: JWT with type="2fa_pending"
    G->>G: verify token type = 2fa_pending
    G-->>C: user.id
    C->>S: verifyMfa(userId, code)
    S->>R: DEL state_token:{userId}
    R-->>S: 1 (deleted) or 0 (not found)
    alt token found and deleted
        S->>DB: fetch user + encrypted secret
        S->>E: decrypt(encryptedSecret)
        S->>S: verifySync(secret, code)
        alt valid
            S->>S: issue full tokens
            S-->>C: tokens + user
            C-->>U: redirect to dashboard
        else invalid
            S-->>C: UnauthorizedError
        end
    else token already used/expired
        S-->>C: UnauthorizedError("state_token already used or expired")
    end
```

### 4.5 Verify Recovery Code After Login

```mermaid
sequenceDiagram
    participant U as User
    participant C as Auth Controller
    participant G as TwoFaPendingGuard
    participant S as Auth Service
    participant R as Redis
    participant DB as Database

    U->>C: POST /auth/mfa/recovery { code: "A1B2-C3D4" }
    Note over C,G: JWT with type="2fa_pending"
    G->>G: verify token type = 2fa_pending
    G-->>C: user.id
    C->>S: verifyRecoveryCode(userId, code)
    S->>R: DEL state_token:{userId}
    R-->>S: 1 (deleted) or 0 (not found)
    alt token found and deleted
        S->>DB: fetch unused recovery codes
        S->>S: argon2.verify(input, code_hash)
        alt match found
            S->>DB: SET used_at = NOW()
            S->>S: issue full tokens
            S-->>C: tokens + user
            C-->>U: redirect to dashboard
        else no match
            S-->>C: UnauthorizedError
        end
    else token already used/expired
        S-->>C: UnauthorizedError("state_token already used or expired")
    end
```

## 5. Database Schema

```mermaid
erDiagram
    users {
        uuid id PK
        varchar email
        boolean two_fa_enabled
        varchar two_fa_method
        text two_fa_totp_secret
    }

    recovery_codes {
        uuid id PK
        uuid user_id FK
        varchar code_hash
        timestamp used_at
        timestamp created_at
        timestamp updated_at
    }
```

**Users table:**
- `two_fa_enabled`: Boolean flag indicating if 2FA is active
- `two_fa_method`: Enum (`'totp'`) - supports future methods (email, SMS)
- `two_fa_totp_secret`: Encrypted TOTP secret (IV:AuthTag:Ciphertext)

**Recovery codes table:**
- `code_hash`: Argon2 hashed recovery code (plaintext never stored)
- `used_at`: Timestamp when code was used (null = unused)

## 6. API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/mfa/totp/setup` | POST | JWT | Generate TOTP secret + QR URI |
| `/auth/mfa/totp/enable` | POST | JWT | Verify first code, enable 2FA, returns 8 recovery codes |
| `/auth/mfa/disable` | POST | JWT | Verify password, disable 2FA, log out all sessions |
| `/auth/mfa` | POST | 2FA Pending JWT | Verify TOTP code, issue tokens |
| `/auth/mfa/recovery` | POST | 2FA Pending JWT | Verify recovery code, issue tokens |
| `/auth/mfa/recovery-codes/regenerate` | POST | JWT | Verify password, invalidate old codes, generate 8 new ones, log out all sessions |

## 7. Security Considerations

### 7.1 Secret Encryption
- Algorithm: AES-256-GCM (authenticated encryption)
- Key: 32-byte key from `TOTP_ENCRYPTION_KEY` env (64 hex chars)
- IV: 12 random bytes per encryption
- Format: `iv:authTag:ciphertext` (colon-separated hex)

### 7.2 Token Security
- 2FA pending token: 5-minute expiry, type claim = `2fa_pending`
- Single-use enforcement: Stored in Redis (`state_token:{userId}`) with 5-minute TTL
- On verify: Redis key deleted before processing; if key missing → reject as "already used or expired"
- If Redis is unavailable: Falls back to JWT-only (token valid until expiry)

### 7.3 Recovery Codes
- Generated on 2FA enable: 8 codes in format `XXXX-XXXX` (16 chars)
- Stored as Argon2 hashes (plaintext never persisted)
- One-time use: after successful login, `used_at` timestamp is set
- Shown once to user on enable; regeneration invalidates all old codes
- Can be used as alternative to TOTP in `/auth/mfa/recovery`
- Regeneration requires password authentication and logs out all sessions

### 7.4 Attack Mitigations
- Rate limiting on verify endpoint (prevent brute force)
- 30-second time window for TOTP validation (standard RFC 6238)
- Encrypted secrets at rest (not plaintext)
- Argon2 for password and recovery code hashing

## 8. Edge Cases

| Scenario | Handling |
|----------|----------|
| User loses authenticator | Use recovery code instead of TOTP at `/auth/mfa/recovery` |
| All recovery codes used | Prompted to regenerate new codes (requires password) |
| Clock skew on device | 1 window before/after current time (90s total) |
| Re-setup while enabled | Allowed - generates new secret, invalidates old |
| Disable 2FA without valid password | Rejected - requires current password |
| Regenerate recovery codes | Requires password, logs out all sessions |

## 9. Future Considerations

1. **Email 2FA**: Alternative method using email OTP
2. **SMS 2FA**: Phone-based OTP (requires Twilio integration)
3. **2FA Required Policy**: Admin can force 2FA for organization members
4. **Session Management**: View/revoke 2FA sessions
5. **Login Audit Logs**: Track when recovery codes are used

## 10. Configuration

```env
# Required for TOTP secret encryption
TOTP_ENCRYPTION_KEY=64-character-hex-string
```

## 11. Dependencies

- `otplib`: TOTP generation and verification
- `crypto` (Node.js built-in): AES-256-GCM encryption
- `@nestjs/jwt`: Token management
- `ioredis`: Redis client for state_token single-use enforcement