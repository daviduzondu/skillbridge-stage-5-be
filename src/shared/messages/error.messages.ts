export const ErrorMessages = {
  AUTH: {
    INVALID_OR_EXPIRED_OTP: 'Invalid or expired otp',
    ACCOUNT_NOT_FOUND: 'Account not found',
    ACCOUNT_ALREADY_VERIFIED: 'Account is already verified',
    TOO_MANY_REQUESTS: 'Too many requests. Please wait before trying again.',
    INVALID_CREDENTIALS: 'Invalid credentials',
    EMAIL_NOT_VERIFIED: 'Please verify your email to continue',
    INVALID_OR_EXPIRED_TOKEN: 'Invalid or expired token',
    TOKEN_ALREADY_USED: 'Token already used',
    INVALID_REFRESH_TOKEN: 'Invalid refresh token',
    REFRESH_TOKEN_REVOKED: 'Refresh token has been revoked',
    INVALID_ACCESS_TOKEN: 'Invalid access token',
    GOOGLE_AUTH_FAILED: 'Google authentication failed',
    INVALID_OAUTH_SIGNUP_ROLE: 'Invalid OAuth signup role',
    OAUTH_SIGNUP_ROLE_REQUIRED: 'OAuth signup role required',
    TWO_FA_REQUIRED: 'Two-Factor Authentication required',
    TWO_FA_INVALID_CODE:
      'Invalid Two-Factor Authentication code, please try again',
    TWO_FA_NOT_SETUP: '2FA has not been set up on this account',
    TWO_FA_ALREADY_ENABLED:
      'A 2FA method is already active on this account. Please disable it first before setting up a new one.',
  },
  USER: {
    EMAIL_ALREADY_REGISTERED: 'Email already registered',
    NOT_FOUND: (id: string) => `User ${id} not found`,
    UPDATE_FAILED: 'Failed to update user',
  },
  INQUIRIES: {
    EMAIL_ALREADY_ON_WAITLIST: 'Email already on waitlist',
  },
  ONBOARDING: {
    INVALID_USER: 'Invalid user',
    ALREADY_COMPLETED: 'Onboarding already completed',
    TALENT_PROFILE_EXISTS: 'Talent profile already exists',
    EMPLOYER_PROFILE_EXISTS: 'Employer profile already exists',
    CANDIDATE_PROFILE_EXISTS: 'Candidate profile already exists',
  },
  COMMON: {
    INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
    INTERNAL_SERVER_ERROR: 'Internal server error',
  },
} as const;
