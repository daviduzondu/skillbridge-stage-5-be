export const OAUTH_PROVIDER_LINKEDIN = 'linkedin' as const;

export const LINKEDIN_AUTHORIZATION_URL =
  'https://www.linkedin.com/oauth/v2/authorization';
export const LINKEDIN_ACCESS_TOKEN_URL =
  'https://www.linkedin.com/oauth/v2/accessToken';
export const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
/** Sign In with LinkedIn using OpenID Connect (member data v2). */
export const LINKEDIN_OAUTH_SCOPES = 'openid profile email';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

export function parseLinkedInTokenResponse(body: unknown): {
  access_token: string;
  error?: string;
  error_description?: string;
} | null {
  if (!isRecord(body)) return null;
  const access_token = body.access_token;
  if (typeof access_token !== 'string' || access_token.length === 0) {
    return null;
  }
  const error = typeof body.error === 'string' ? body.error : undefined;
  const error_description =
    typeof body.error_description === 'string'
      ? body.error_description
      : undefined;
  return { access_token, error, error_description };
}
