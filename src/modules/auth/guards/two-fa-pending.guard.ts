import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import * as jwt from '@nestjs/jwt';

@Injectable()
export class TwoFaPendingGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    const token = authHeader?.split(' ')[1];
    if (!authHeader || !authHeader.startsWith('Bearer ') || !token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        type: string;
      }>(token);
      if (payload.type !== '2fa_pending') {
        throw new UnauthorizedException();
      }

      request.user = { sub: payload.sub };
      return true;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('state_token has expired');
      }
      throw new UnauthorizedException();
    }
  }
}
