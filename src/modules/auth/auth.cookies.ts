import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env';
import { parseDurationToMs } from '../../config/duration';
import type { OAuthSignupRole } from './oauth-signup-role';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const OAUTH_SIGNUP_ROLE_COOKIE = 'oauth_signup_role';

const OAUTH_SIGNUP_ROLE_MAX_AGE_MS = 10 * 60 * 1000;

const authCookieSameSite = (): 'strict' | 'lax' | 'none' =>
  env.AUTH_COOKIE_SAMESITE ?? 'strict';

/** `SameSite=None` must be paired with `Secure` (browsers require it). */
const authCookieSecure = (): boolean =>
  authCookieSameSite() === 'none' || env.NODE_ENV === 'production';

export const buildAuthCookieOptions = (maxAge: number): CookieOptions => ({
  httpOnly: true,
  secure: authCookieSecure(),
  sameSite: authCookieSameSite(),
  path: '/',
  ...(maxAge > 0 ? { maxAge } : {}),
});

export const setAuthCookies = (
  response: Response,
  tokens: { accessToken: string; refreshToken: string },
): void => {
  response.cookie(
    ACCESS_TOKEN_COOKIE,
    tokens.accessToken,
    buildAuthCookieOptions(parseDurationToMs(env.JWT_ACCESS_EXPIRES_IN)),
  );
  response.cookie(
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    buildAuthCookieOptions(parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN)),
  );
};

export const clearAuthCookies = (response: Response): void => {
  const options = buildAuthCookieOptions(0);
  response.clearCookie(ACCESS_TOKEN_COOKIE, options);
  response.clearCookie(REFRESH_TOKEN_COOKIE, options);
};

export const buildOAuthSignupRoleCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: authCookieSecure(),
  sameSite: authCookieSameSite(),
  path: '/',
  maxAge: OAUTH_SIGNUP_ROLE_MAX_AGE_MS,
});

export const setOAuthSignupRoleCookie = (
  response: Response,
  role: OAuthSignupRole,
): void => {
  response.cookie(
    OAUTH_SIGNUP_ROLE_COOKIE,
    role,
    buildOAuthSignupRoleCookieOptions(),
  );
};

export const clearOAuthSignupRoleCookie = (response: Response): void => {
  response.clearCookie(
    OAUTH_SIGNUP_ROLE_COOKIE,
    buildOAuthSignupRoleCookieOptions(),
  );
};

export const readCookie = (
  request: Request,
  cookieName: string,
): string | undefined => {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;

  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const cookie = cookies.find((entry) => entry.startsWith(`${cookieName}=`));
  if (!cookie) return undefined;

  const value = cookie.slice(cookieName.length + 1);
  if (!value) return undefined;

  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
};
