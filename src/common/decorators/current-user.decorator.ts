import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { UserRole } from '../../modules/users/entities/user.entity';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: UserRole;
  onboardingComplete: boolean;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();
    const user = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
