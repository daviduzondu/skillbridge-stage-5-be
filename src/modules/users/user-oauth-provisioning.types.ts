import { UserRole } from './entities/user.entity';
import type { User } from './entities/user.entity';

/** Payload for transactional create of a verified user + OAuth link. */
export type CreateVerifiedUserWithOauthLinkParams = {
  email: string;
  first_name: string;
  last_name: string;
  country: string;
  avatar_url: string | null;
  provider: string;
  providerId: string;
  role: UserRole.TALENT | UserRole.EMPLOYER;
};

/**
 * Surface used by UsersService for OAuth user creation.
 * Lets type-aware ESLint see a concrete signature (AbstractModelAction hides it on the class).
 */
export type UserOauthProvisioning = {
  createVerifiedUserWithOauthLink(
    params: CreateVerifiedUserWithOauthLinkParams,
  ): Promise<User>;
};
