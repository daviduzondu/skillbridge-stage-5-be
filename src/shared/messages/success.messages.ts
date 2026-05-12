export const SuccessMessages = {
  AUTH: {
    VERIFICATION_OTP_SENT: 'Verification otp sent',
    EMAIL_VERIFIED: 'Email verified',
TOTP_2FA_SETUP_SUCCESS: 'TOTP Two-Factor Authentication setup successful',
TOTP_2FA_ENABLE_SUCCESS: 'TOTP Two-Factor Authentication enabled successfully',
TOTP_2FA_DISABLE_SUCCESS: 'TOTP Two-Factor Authentication disabled successfully',
    VERIFICATION_EMAIL_RESENT: 'Verification email resent',
    LOGIN: 'Login successful',
    FORGOT_PASSWORD: 'If that email exists, a reset link has been sent',
    PASSWORD_UPDATED: 'Password updated. Please log in.',
    TOKEN_REFRESHED: 'Token refreshed successfully',
    LOGGED_OUT: 'Logged out',
  },
  INQUIRIES: {
    WAITLIST_JOINED: 'Added to waitlist',
    MESSAGE_RECEIVED: 'Message received',
  },
  ONBOARDING: {
    TALENT_COMPLETED: 'Talent onboarding completed',
    EMPLOYER_COMPLETED: 'Employer onboarding completed',
    CANDIDATE_COMPLETED: 'Candidate onboarding completed',
  },
  COMMON: {
    SUCCESS: 'success',
    API_PROBE: 'I am the NestJs api responding',
  },
} as const;
