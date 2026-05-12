import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import {
  clearOAuthSignupRoleCookie,
  setOAuthSignupRoleCookie,
} from '../auth.cookies';
import { normalizeOAuthSignupRole } from '../oauth-signup-role';
import { BadRequestError, ErrorMessages } from '../../../shared';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  constructor() {
    super({
      accessType: 'offline',
    });
  }

  handleRequest<TUser = unknown>(
    err: Error | undefined,
    user: TUser | false,
    _info: unknown,
    _context: ExecutionContext,
    _status?: unknown,
  ): TUser {
    if (err) {
      throw err;
    }
    if (!user) {
      throw new BadRequestError(ErrorMessages.AUTH.GOOGLE_AUTH_FAILED);
    }
    return user;
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<
      Request & {
        params?: { role?: string };
      }
    >();
    const response = context.switchToHttp().getResponse<Response>();
    const path = request.path ?? '';
    const role = request.params?.role;

    if (!path.includes('/google/signup/')) {
      return super.canActivate(context);
    }

    if (role !== undefined) {
      const normalizedRole = normalizeOAuthSignupRole(role);
      if (!normalizedRole) {
        throw new BadRequestError(ErrorMessages.AUTH.INVALID_OAUTH_SIGNUP_ROLE);
      }
      setOAuthSignupRoleCookie(response, normalizedRole);
    } else {
      clearOAuthSignupRoleCookie(response);
    }

    return super.canActivate(context);
  }
}
