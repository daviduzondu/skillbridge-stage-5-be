import { BadRequestException } from '@nestjs/common';
import { ErrorMessages } from '../../../shared';

export class OAuthSignupRoleRequiredException extends BadRequestException {
  constructor() {
    super(ErrorMessages.AUTH.OAUTH_SIGNUP_ROLE_REQUIRED);
  }
}
