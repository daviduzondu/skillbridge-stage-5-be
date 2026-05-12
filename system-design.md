# TOTP Two-Factor Authentication System Design

## 1. Overview

The TOTP (Time-based One-Time Password) 2FA system adds an additional security layer to user authentication. Users enable 2FA by linking an authenticator app (Google Authenticator, Authy, etc.), then must provide a 6-digit code during login after verifying their password.

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
    end

    subgraph Database
        U[users table]
    end

    UI -->|POST /auth/2fa/totp/setup| AC
    UI -->|POST /auth/2fa/totp/enable| AC
    UI -->|POST /auth/2fa/disable| AC
    UI -->|POST /auth/2fa/verify| AC

    AC --> AS
    AS --> US
    AS --> EU
    G2 --> AS
    US -->|SELECT/UPDATE| U
    EU -->|encrypt/decrypt| U
```

## 3. Components

| Component | Responsibility |
|-----------|----------------|
| AuthController | Exposes TOTP endpoints, validates DTOs |
| AuthService | TOTP secret generation, code verification, token issuance |
| UsersService | Persists 2FA state and encrypted secrets to database |
| EncryptionUtils | AES-256-GCM encryption for TOTP secrets |
| TwoFaPendingGuard | Validates temporary 2FA pending JWT tokens |
| User Entity | Stores `two_fa_enabled`, `two_fa_method`, `two_fa_totp_secret` |

## 4. Data Flow

### 4.1 Setup TOTP

```mermaid
sequenceDiagram
    participant U as User
    participant C as Auth Controller
    participant S as Auth Service
    participant E as Encryption Utils
    participant DB as Database

    U->>C: POST /auth/2fa/totp/setup
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

    U->>C: POST /auth/2fa/totp/enable { code: "123456" }
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

    U->>C: POST /auth/login { email, password }
    C->>S: login(dto)
    S->>S: validate password
    alt 2FA enabled
        S->>S: sign 2fa_pending JWT (5min)
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
    participant E as Encryption Utils
    participant DB as Database

    U->>C: POST /auth/2fa/verify { code: "123456" }
    Note over C,G: JWT with type="2fa_pending"
    G->>G: verify token type = 2fa_pending
    G-->>C: user.id
    C->>S: verify2fa(userId, code)
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
```

**Fields:**
- `two_fa_enabled`: Boolean flag indicating if 2FA is active
- `two_fa_method`: Enum (`'totp'`) - supports future methods (email, SMS)
- `two_fa_totp_secret`: Encrypted TOTP secret (IV:AuthTag:Ciphertext)

## 6. API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/2fa/totp/setup` | POST | JWT | Generate TOTP secret + QR URI |
| `/auth/2fa/totp/enable` | POST | JWT | Verify first code, enable 2FA |
| `/auth/2fa/disable` | POST | JWT | Verify code, disable 2FA |
| `/auth/2fa/verify` | POST | 2FA Pending JWT | Verify code, issue tokens |

## 7. Security Considerations

### 7.1 Secret Encryption
- Algorithm: AES-256-GCM (authenticated encryption)
- Key: 32-byte key from `TOTP_ENCRYPTION_KEY` env (64 hex chars)
- IV: 12 random bytes per encryption
- Format: `iv:authTag:ciphertext` (colon-separated hex)

### 7.2 Token Security
- 2FA pending token: 5-minute expiry, type claim = `2fa_pending`
- Single-use: Token invalidated after successful verification

### 7.3 Attack Mitigations
- Rate limiting on verify endpoint (prevent brute force)
- 30-second time window for TOTP validation (standard RFC 6238)
- Encrypted secrets at rest (not plaintext)

## 8. Edge Cases

| Scenario | Handling |
|----------|----------|
| User loses authenticator | Recovery flow TBD (future: backup codes, email reset) |
| Clock skew on device | 1 window before/after current time (90s total) |
| Re-setup while enabled | Allowed - generates new secret, invalidates old |
| Disable without valid code | Rejected - requires current TOTP code |

## 9. Future Considerations

1. **Recovery Codes**: Generate 8 single-use backup codes on 2FA enable
2. **Email 2FA**: Alternative method using email OTP
3. **SMS 2FA**: Phone-based OTP (requires Twilio integration)
4. **2FA Required Policy**: Admin can force 2FA for organization members
5. **Session Management**: View/revoke 2FA sessions

## 10. Configuration

```env
# Required for TOTP secret encryption
TOTP_ENCRYPTION_KEY=64-character-hex-string
```

## 11. Dependencies

- `otplib`: TOTP generation and verification
- `crypto` (Node.js built-in): AES-256-GCM encryption
- `@nestjs/jwt`: Token management