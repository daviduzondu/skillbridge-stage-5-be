import { AbstractModelAction } from '@hng-sdk/orm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import type { CreateVerifiedUserWithOauthLinkParams } from '../user-oauth-provisioning.types';
import { OAuthUser } from '../entities/user-oauth-account.entity';
import { User, UserRole } from '../entities/user.entity';

export type { CreateVerifiedUserWithOauthLinkParams } from '../user-oauth-provisioning.types';

export type CreateUserWithOauthLinkUserPayload = {
  email: string;
  first_name: string;
  last_name: string;
  country: string;
  avatar_url: string | null;
};

export type CreateUserWithOauthLinkOAuthPayload = {
  provider: string;
  providerId: string;
  role: UserRole.TALENT | UserRole.EMPLOYER;
};

@Injectable()
export class UserModelAction extends AbstractModelAction<User> {
  constructor(
    @InjectRepository(User) protected readonly repository: Repository<User>,
  ) {
    super(repository, User);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.get({ identifierOptions: { email } });
  }

  /**
   * Inserts a verified user row and linked OAuth account inside the given manager (caller supplies transaction).
   */
  async createUserWithOauthLink(
    manager: EntityManager,
    userPayload: CreateUserWithOauthLinkUserPayload,
    oauthPayload: CreateUserWithOauthLinkOAuthPayload,
  ): Promise<User> {
    const userRepo = manager.getRepository(User);
    const oauthRepo = manager.getRepository(OAuthUser);

    const user = userRepo.create({
      email: userPayload.email,
      password: null,
      first_name: userPayload.first_name,
      last_name: userPayload.last_name,
      country: userPayload.country,
      avatar_url: userPayload.avatar_url,
      is_verified: true,
      onboarding_complete: false,
      role: oauthPayload.role,
    });
    await userRepo.save(user);

    await oauthRepo.save(
      oauthRepo.create({
        user_id: user.id,
        provider: oauthPayload.provider,
        provider_id: oauthPayload.providerId,
      }),
    );

    return userRepo.findOneOrFail({ where: { id: user.id } });
  }

  async createVerifiedUserWithOauthLink(
    params: CreateVerifiedUserWithOauthLinkParams,
  ): Promise<User> {
    return await this.repository.manager.transaction(
      async (manager: EntityManager): Promise<User> => {
        return await this.createUserWithOauthLink(
          manager,
          {
            email: params.email,
            first_name: params.first_name,
            last_name: params.last_name,
            country: params.country,
            avatar_url: params.avatar_url,
          },
          {
            provider: params.provider,
            providerId: params.providerId,
            role: params.role,
          },
        );
      },
    );
  }

  async rotateRefreshTokenHash(
    id: string,
    currentHash: string,
    nextHash: string,
  ): Promise<boolean> {
    const result = await this.repository.update(
      { id, refreshTokenHash: currentHash },
      { refreshTokenHash: nextHash },
    );
    return (result.affected ?? 0) > 0;
  }
}
