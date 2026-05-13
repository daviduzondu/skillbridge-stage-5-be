import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type {
  CreateVerifiedUserWithOauthLinkParams,
  UserOauthProvisioning,
} from './user-oauth-provisioning.types';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { UserModelAction } from './actions/user.action';
import { CreateUserDto } from './dto/create-user.dto';
import { PaginationDto } from './dto/pagination.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { TwoFactorAuthMethod, User, UserRole } from './entities/user.entity';
import { OAuthUserModelAction } from './actions/user-oauth.action';
import { OAuthUser } from './entities/user-oauth.entity';
import {
  ConflictError,
  ErrorMessages,
  InternalServerError,
  NotFoundError,
} from '../../shared';
import type { OAuthSignupRole } from '../auth/oauth-signup-role';
import { OAuthSignupRoleRequiredException } from '../auth/exceptions/oauth-signup-role-required.exception';

const NO_TRANSACTION = {
  transactionOptions: { useTransaction: false as const },
};

function isPostgresUniqueViolation(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const code =
    (err as QueryFailedError & { code?: string }).code ??
    (err.driverError as { code?: string } | undefined)?.code;
  return code === '23505';
}

export type OAuthProviderProfileInput = {
  providerId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

export const OAUTH_DEFAULT_COUNTRY = 'Unknown';

@Injectable()
export class UsersService {
  constructor(
    private readonly userModelAction: UserModelAction,
    @InjectRepository(OAuthUser)
    private readonly oauthRepository: Repository<OAuthUser>,
    private readonly oauthUserModelAction: OAuthUserModelAction,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userModelAction.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError(ErrorMessages.USER.EMAIL_ALREADY_REGISTERED);
    }

    const passwordHash = await argon2.hash(dto.password);
    const signupReason =
      dto.signup_reason == null || dto.signup_reason.trim() === ''
        ? null
        : dto.signup_reason.trim();
    return this.userModelAction.create({
      ...NO_TRANSACTION,
      createPayload: {
        email: dto.email,
        password: passwordHash,
        first_name: dto.first_name,
        last_name: dto.last_name,
        country: dto.country,
        avatar_url: dto.profile_pic_url ?? null,
        is_verified: false,
        onboarding_complete: false,
        role: dto.role ?? UserRole.TALENT,
        signup_reason: signupReason,
      },
    });
  }

  findAll(pagination: PaginationDto) {
    return this.userModelAction.list({
      paginationPayload: { page: pagination.page!, limit: pagination.limit! },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userModelAction.get({
      identifierOptions: { id },
    });
    if (!user) throw new NotFoundError(ErrorMessages.USER.NOT_FOUND(id));
    return user;
  }

  findOneOrNull(id: string): Promise<User | null> {
    return this.userModelAction.get({
      identifierOptions: { id },
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userModelAction.findByEmail(email);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    await this.findOne(id);

    const { profile_pic_url: profilePicUrl, ...userDto } = dto;
    const payload: Partial<User> = {
      ...userDto,
      ...(profilePicUrl !== undefined ? { avatar_url: profilePicUrl } : {}),
    };
    if (dto.password) {
      payload.password = await argon2.hash(dto.password);
    }

    const updated = await this.userModelAction.update({
      ...NO_TRANSACTION,
      identifierOptions: { id },
      updatePayload: payload,
    });
    if (!updated) {
      throw new InternalServerError(ErrorMessages.USER.UPDATE_FAILED);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.userModelAction.delete({
      ...NO_TRANSACTION,
      identifierOptions: { id },
    });
  }

  async setRefreshTokenHash(id: string, hash: string | null): Promise<void> {
    await this.userModelAction.update({
      ...NO_TRANSACTION,
      identifierOptions: { id },
      updatePayload: { refreshTokenHash: hash },
    });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.userModelAction.update({
      ...NO_TRANSACTION,
      identifierOptions: { id },
      updatePayload: { password: passwordHash, refreshTokenHash: null },
    });
  }

  async markVerified(id: string): Promise<User> {
    await this.userModelAction.update({
      ...NO_TRANSACTION,
      identifierOptions: { id },
      updatePayload: { is_verified: true },
    });
    return this.findOne(id);
  }

  async markOnboardingComplete(id: string): Promise<User> {
    await this.userModelAction.update({
      ...NO_TRANSACTION,
      identifierOptions: { id },
      updatePayload: { onboarding_complete: true },
    });
    return this.findOne(id);
  }

  async getUserForOnboarding(
    manager: EntityManager,
    id: string,
  ): Promise<User> {
    const user = await manager.findOne(User, {
      where: { id },
    });
    if (!user) {
      throw new NotFoundError(ErrorMessages.USER.NOT_FOUND(id));
    }
    return user;
  }

  async markOnboardingCompleteWithManager(
    manager: EntityManager,
    id: string,
  ): Promise<void> {
    await manager.update(User, { id }, { onboarding_complete: true });
  }

  rotateRefreshTokenHash(
    id: string,
    currentHash: string,
    nextHash: string,
  ): Promise<boolean> {
    return this.userModelAction.rotateRefreshTokenHash(
      id,
      currentHash,
      nextHash,
    );
  }

  async findOauthAccountWithUser(
    provider: string,
    providerId: string,
  ): Promise<{ oauth: OAuthUser; user: User } | null> {
    const oauth = await this.oauthRepository.findOne({
      where: { provider, provider_id: providerId },
      relations: ['user'],
    });
    if (!oauth?.user) return null;
    return { oauth, user: oauth.user };
  }

  async createVerifiedUserWithOauthLink(
    params: CreateVerifiedUserWithOauthLinkParams,
  ): Promise<User> {
    const provisioning = this.userModelAction as UserOauthProvisioning;
    return await provisioning.createVerifiedUserWithOauthLink(params);
  }

  async linkOauthAccountToUser(
    userId: string,
    provider: string,
    providerId: string,
  ): Promise<void> {
    try {
      await this.oauthRepository.save(
        this.oauthRepository.create({
          user_id: userId,
          provider,
          provider_id: providerId,
        }),
      );
    } catch (err) {
      if (!isPostgresUniqueViolation(err)) {
        throw err;
      }
      const byExternal = await this.findOauthAccountWithUser(
        provider,
        providerId,
      );
      if (byExternal?.user.id === userId) {
        return;
      }
      const forUserProvider = await this.oauthRepository.findOne({
        where: { user_id: userId, provider },
      });
      if (forUserProvider?.provider_id === providerId) {
        return;
      }
      throw err;
    }
  }

  async set2faTotpActiveState(userId: string, state: boolean) {
    await this.userRepository.update(
      { id: userId },
      {
        two_fa_enabled: state,
        two_fa_method: TwoFactorAuthMethod.TOTP,
        ...(state === false ? { two_fa_totp_secret: null, two_fa_method: null } : {}),
      },
    );
  }

  async setup2faTotp({
    userId,
    encryptedSecret,
  }: {
    userId: string;
    encryptedSecret: string;
  }): Promise<void> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });

      if (!user) {
        throw new NotFoundException(ErrorMessages.USER.NOT_FOUND(userId));
      }

      if (user.two_fa_method !== null) {
        throw new ConflictError(
          'A 2FA method is already active on this account. Please disable it first before setting up a new one.',
        );
      }

      await this.userRepository.update(
        { id: userId },
        { two_fa_totp_secret: encryptedSecret },
      );
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictError
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        ErrorMessages.COMMON.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * OAuth callback resolution: existing provider link, auto-link by email, or new user.
   */
  async resolveOAuthUserFromProviderProfile(
    provider: string,
    profile: OAuthProviderProfileInput,
    signupRole?: OAuthSignupRole,
  ): Promise<User> {
    const linked = await this.findOauthAccountWithUser(
      provider,
      profile.providerId,
    );
    if (linked) {
      return linked.user;
    }

    const byEmail = await this.findByEmail(profile.email);
    if (byEmail) {
      if (!byEmail.is_verified) {
        await this.markVerified(byEmail.id);
      }
      await this.linkOauthAccountToUser(
        byEmail.id,
        provider,
        profile.providerId,
      );
      return this.findOne(byEmail.id);
    }

    try {
      if (!signupRole) {
        throw new OAuthSignupRoleRequiredException();
      }
      return await this.createVerifiedUserWithOauthLink({
        email: profile.email,
        first_name: profile.firstName,
        last_name: profile.lastName,
        country: OAUTH_DEFAULT_COUNTRY,
        avatar_url: profile.avatarUrl,
        provider,
        providerId: profile.providerId,
        role: signupRole,
      });
    } catch (err) {
      if (!isPostgresUniqueViolation(err)) {
        throw err;
      }
      const raced = await this.findByEmail(profile.email);
      if (!raced) {
        throw err;
      }
      if (!raced.is_verified) {
        await this.markVerified(raced.id);
      }
      await this.linkOauthAccountToUser(raced.id, provider, profile.providerId);
      return this.findOne(raced.id);
    }
  }
}
