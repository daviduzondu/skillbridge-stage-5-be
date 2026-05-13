import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { IsNull } from 'typeorm';
import type { StringValue } from 'ms';
import { Repository } from 'typeorm';
import { env } from '../../config/env';
import { MailService } from '../mail/mail.service';
import { User, UserRole } from '../users/entities/user.entity';
import { OAUTH_DEFAULT_COUNTRY, UsersService } from '../users/users.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerificationOtpSource } from './entities/verification-otp.entity';
import { RecoveryCode } from './entities/recovery-code.entity';
import { JwtPayload } from './strategies/jwt.strategy';
import { VerificationOtpService } from './verification-otp.service';
import { PasswordResetOtpService } from './password-reset-otp.service';
import { PasswordResetQueueService } from './password-reset-queue.service';
import { GoogleProfile } from './strategies/google.strategy';
import { type OAuthSignupRole } from './oauth-signup-role';
import {
  BadRequestError,
  ErrorMessages,
  SuccessMessages,
  UnauthorizedError,
} from '../../shared';
import Redis from 'ioredis';
import { generateSecret, verifySync, generateURI } from 'otplib';
import { encrypt, decrypt } from 'src/utils/encryption.utils';
import { AuthenticatedUser } from '@shared/decorators/current-user.decorator';

export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  fullname: string;
  avatar_url: string | null;
  country: string;
  role: UserRole;
  is_verified: boolean;
  onboardingComplete: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSession {
  message: string;
  data: {
    user: AuthUser;
  };
}

export interface AuthResult {
  message: string;
  data: AuthSession['data'];
  tokens: AuthTokens;
}

export interface TwoFaNeededResult extends AuthResult {
  message: string;
  state_token: string;
}

export interface AuthResponse {
  message: string;
  status: 'success';
  data: AuthSession['data'];
}

export interface VerifyEmailResult {
  message: string;
  user: AuthUser;
  tokens: AuthTokens;
}

export interface ForgotPasswordResponse {
  status: 'success';
  message: string;
}

export interface ResetPasswordResponse {
  status: 'success';
  message: string;
}

/** Normalized profile used by OAuth callbacks (e.g. Google). */
export interface OAuthProfilePayload {
  providerId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private redis: Redis | null = null;

  private getRedis(): Redis {
    if (!this.redis) {
      const url = env.REDIS_URL?.trim();
      if (url) {
        this.redis = new Redis(url);
      }
    }
    return this.redis!;
  }

  private generateRecoveryCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const part1 = randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase();
      const part2 = randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase();
      codes.push(`${part1}-${part2}`);
    }
    return codes;
  }

  private async saveRecoveryCodes(
    userId: string,
    codes: string[],
  ): Promise<void> {
    const hashedCodes = await Promise.all(
      codes.map((code) => argon2.hash(code)),
    );
    const records = hashedCodes.map((hash) => ({
      user_id: userId,
      code_hash: hash,
      used_at: null,
    }));
    await this.recoveryCodeRepository.insert(records);
  }

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly verificationOtpService: VerificationOtpService,
    private readonly passwordResetOtpService: PasswordResetOtpService,
    private readonly mailService: MailService,
    private readonly passwordResetQueue: PasswordResetQueueService,
    @InjectRepository(RecoveryCode)
    private readonly recoveryCodeRepository: Repository<RecoveryCode>,
  ) {}

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      first_name: dto.firstName,
      last_name: dto.lastName,
      country: OAUTH_DEFAULT_COUNTRY,
      role: dto.role,
      signup_reason: dto.reasonForJoining,
    });

    const issuedOtp = await this.verificationOtpService.issue(
      user.id,
      VerificationOtpSource.INITIAL,
    );
    await this.mailService.sendVerificationOtp({
      to: user.email,
      otp: issuedOtp.code,
      expiresAt: issuedOtp.expiresAt,
      recipientFirstName: user.first_name,
    });

    return {
      message: SuccessMessages.AUTH.VERIFICATION_OTP_SENT,
    };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<VerifyEmailResult> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestError(ErrorMessages.AUTH.INVALID_OR_EXPIRED_OTP);
    }

    const isValidOtp = await this.verificationOtpService.consume(
      user.id,
      dto.otp,
    );
    if (!isValidOtp) {
      throw new BadRequestError(ErrorMessages.AUTH.INVALID_OR_EXPIRED_OTP);
    }

    const verifiedUser: User = user.is_verified
      ? user
      : await this.usersService.markVerified(user.id);
    const tokens = await this.signTokens(verifiedUser);
    await this.persistRefreshToken(verifiedUser.id, tokens.refreshToken);

    return {
      message: SuccessMessages.AUTH.EMAIL_VERIFIED,
      user: this.toAuthUser(verifiedUser),
      tokens,
    };
  }

  async resendVerification(
    dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestError(ErrorMessages.AUTH.ACCOUNT_NOT_FOUND);
    }
    if (user.is_verified) {
      throw new BadRequestError(ErrorMessages.AUTH.ACCOUNT_ALREADY_VERIFIED);
    }

    const resendCount = await this.verificationOtpService.countRecentResends(
      user.id,
      new Date(Date.now() - 60 * 60 * 1000),
    );
    if (resendCount >= env.VERIFICATION_RESEND_LIMIT_PER_HOUR) {
      throw new HttpException(
        ErrorMessages.AUTH.TOO_MANY_REQUESTS,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const issuedOtp = await this.verificationOtpService.issue(
      user.id,
      VerificationOtpSource.RESEND,
    );
    await this.mailService.sendVerificationOtp({
      to: user.email,
      otp: issuedOtp.code,
      expiresAt: issuedOtp.expiresAt,
      recipientFirstName: user.first_name,
    });

    return {
      message: SuccessMessages.AUTH.VERIFICATION_EMAIL_RESENT,
    };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user)
      throw new UnauthorizedError(ErrorMessages.AUTH.INVALID_CREDENTIALS);

    if (!user.is_verified) {
      throw new ForbiddenException({
        error: 'EMAIL_NOT_VERIFIED',
        message: ErrorMessages.AUTH.EMAIL_NOT_VERIFIED,
        email: user.email,
      });
    }

    if (user.two_fa_enabled) {
      const tempToken = await this.jwtService.signAsync(
        { sub: user.id, type: '2fa_pending' },
        { expiresIn: '5m' },
      );
      const redis = this.getRedis();
      if (redis) {
        await redis.setex(`state_token:${user.id}`, 300, tempToken);
      }
      return {
        message: ErrorMessages.AUTH.TWO_FA_REQUIRED,
        state_token: tempToken,
      } as TwoFaNeededResult;
    }

    if (!user.password) {
      throw new UnauthorizedError(ErrorMessages.AUTH.INVALID_CREDENTIALS);
    }
    const valid = await argon2.verify(user.password, dto.password);
    if (!valid) {
      throw new UnauthorizedError(ErrorMessages.AUTH.INVALID_CREDENTIALS);
    }

    return this.issueTokens(user, SuccessMessages.AUTH.LOGIN);
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponse> {
    const email = dto.email.trim();
    const user = await this.usersService.findByEmail(email);

    if (user) {
      this.passwordResetQueue.enqueue(user.id);
    }

    return {
      status: 'success',
      message: SuccessMessages.AUTH.FORGOT_PASSWORD,
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<ResetPasswordResponse> {
    const user = await this.usersService.findByEmail(dto.email.trim());
    if (!user) {
      throw new BadRequestError(ErrorMessages.AUTH.INVALID_OR_EXPIRED_OTP);
    }

    const valid = await this.passwordResetOtpService.consume(user.id, dto.otp);
    if (!valid) {
      throw new BadRequestError(ErrorMessages.AUTH.INVALID_OR_EXPIRED_OTP);
    }

    const passwordHash = await argon2.hash(dto.password);
    await this.usersService.updatePassword(user.id, passwordHash);

    return {
      status: 'success',
      message: SuccessMessages.AUTH.PASSWORD_UPDATED,
    };
  }

  async googleCallback(
    profile: GoogleProfile,
    signupRole?: OAuthSignupRole,
  ): Promise<AuthResult> {
    // Normalize GoogleProfile to OAuthProfilePayload format
    const normalizedProfile: OAuthProfilePayload = {
      providerId: profile.providerId,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: profile.picture,
    };

    return this.finalizeOAuthLogin('google', normalizedProfile, signupRole);
  }

  async refresh(
    refreshToken: string | undefined,
  ): Promise<{ message: string; tokens: AuthTokens }> {
    if (!refreshToken) {
      throw new UnauthorizedError(ErrorMessages.AUTH.INVALID_REFRESH_TOKEN);
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedError(ErrorMessages.AUTH.INVALID_REFRESH_TOKEN);
    }

    const user = await this.usersService.findOneOrNull(payload.sub);
    if (!user?.refreshTokenHash) {
      throw new UnauthorizedError(ErrorMessages.AUTH.REFRESH_TOKEN_REVOKED);
    }

    const matches = await argon2.verify(user.refreshTokenHash, refreshToken);
    if (!matches) {
      throw new UnauthorizedError(ErrorMessages.AUTH.INVALID_REFRESH_TOKEN);
    }

    const tokens = await this.signTokens(user);
    const nextHash = await argon2.hash(tokens.refreshToken);
    const rotated = await this.usersService.rotateRefreshTokenHash(
      user.id,
      user.refreshTokenHash,
      nextHash,
    );
    if (!rotated) {
      throw new UnauthorizedError(ErrorMessages.AUTH.INVALID_REFRESH_TOKEN);
    }

    return {
      message: SuccessMessages.AUTH.TOKEN_REFRESHED,
      tokens,
    };
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.setRefreshTokenHash(userId, null);
  }

  async logoutByRefreshToken(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: env.JWT_REFRESH_SECRET,
      });
    } catch {
      return;
    }

    const user = await this.usersService.findOneOrNull(payload.sub);
    if (!user?.refreshTokenHash) return;

    const matches = await argon2.verify(user.refreshTokenHash, refreshToken);
    if (!matches) return;

    await this.usersService.setRefreshTokenHash(user.id, null);
  }

  async getProfile(userId: string): Promise<AuthUser> {
    const user = await this.usersService.findOne(userId);
    return this.toAuthUser(user);
  }

  async issueSessionForUser(
    userId: string,
    message: string,
  ): Promise<AuthResult> {
    const user = await this.usersService.findOne(userId);
    return this.issueTokens(user, message);
  }

  toResponse(session: AuthSession): AuthResponse {
    return {
      message: session.message,
      status: 'success',
      data: session.data,
    };
  }

  /**
   * Returns OAuth row, auto-link by email, or new user.
   */
  async finalizeOAuthLogin(
    provider: string,
    profile: OAuthProfilePayload,
    signupRole?: OAuthSignupRole,
  ): Promise<AuthResult> {
    const user = await this.usersService.resolveOAuthUserFromProviderProfile(
      provider,
      profile,
      signupRole,
    );
    return this.issueTokens(user, SuccessMessages.AUTH.LOGIN);
  }

  getFrontendOrigin(): string {
    return env.FRONTEND_URL;
  }

  buildFrontendRedirectUrl(user: AuthUser): string {
    return `${this.getFrontendOrigin()}${this.getPostLoginRedirectPath(user)}`;
  }

  async setup2faTotp(user: AuthenticatedUser) {
    const secret = generateSecret();

    const uri = generateURI({
      issuer: 'SkillBridge',
      label: user.email,
      secret,
    });

    await this.usersService.setup2faTotp({
      userId: user.sub,
      encryptedSecret: encrypt(secret),
    });

    return {
      data: {
        uri,
        secret,
      },
      message: SuccessMessages.AUTH.TOTP_2FA_SETUP_SUCCESS,
    };
  }

  async enableTotp2fa({ userId, code }: { userId: string; code: string }) {
    const user = await this.usersService.findOne(userId);
    if (!user.two_fa_totp_secret)
      throw new BadRequestError(ErrorMessages.AUTH.TWO_FA_NOT_SETUP);
    const decryptedSecret = decrypt(user.two_fa_totp_secret);
    const result = verifySync({
      secret: decryptedSecret,
      token: code,
    });
    if (!result.valid)
      throw new UnauthorizedError(ErrorMessages.AUTH.TWO_FA_INVALID_CODE);
    await this.usersService.set2faTotpActiveState(userId, true);
    await this.usersService.setRefreshTokenHash(userId, null);

    const recoveryCodes = this.generateRecoveryCodes(8);
    await this.saveRecoveryCodes(userId, recoveryCodes);

    return {
      message: SuccessMessages.AUTH.TOTP_2FA_ENABLE_SUCCESS,
      recoveryCodes,
    };
  }

  async disable2fa({
    userId,
    password,
  }: {
    userId: string;
    password: string;
  }) {
    const user = await this.usersService.findOne(userId);

    if (!user.password) {
      throw new UnauthorizedError(ErrorMessages.AUTH.INVALID_CREDENTIALS);
    }

    const validPassword = await argon2.verify(user.password, password);
    if (!validPassword) {
      throw new UnauthorizedError(ErrorMessages.AUTH.INVALID_CREDENTIALS);
    }

    await this.recoveryCodeRepository.delete({ user_id: userId });
    await this.usersService.set2faTotpActiveState(userId, false);
    await this.usersService.setRefreshTokenHash(userId, null);

    return {
      message: SuccessMessages.AUTH.TOTP_2FA_DISABLE_SUCCESS,
    };
  }

  async regenerateRecoveryCodes(userId: string, password: string) {
    const user = await this.usersService.findOne(userId);
    if (!user.two_fa_enabled) {
      throw new BadRequestError(ErrorMessages.AUTH.TWO_FA_NOT_SETUP);
    }

    if (!user.password) {
      throw new UnauthorizedError(ErrorMessages.AUTH.INVALID_CREDENTIALS);
    }

    const validPassword = await argon2.verify(user.password, password);
    if (!validPassword) {
      throw new UnauthorizedError(ErrorMessages.AUTH.INVALID_CREDENTIALS);
    }

    await this.recoveryCodeRepository.delete({ user_id: userId });
    const recoveryCodes = this.generateRecoveryCodes(8);
    await this.saveRecoveryCodes(userId, recoveryCodes);
    await this.usersService.setRefreshTokenHash(userId, null);

    return {
      message: 'Recovery codes regenerated',
      recoveryCodes,
    };
  }

  private async consumeStateToken(userId: string) {
    const redis = this.getRedis();
    if (redis) {
      const deleted = await redis.del(`state_token:${userId}`);
      if (deleted === 0) {
        throw new UnauthorizedError('state_token already used or expired');
      }
    }
  }

  async verifyMfa({ userId, code }: { userId: string; code: string }) {
    await this.consumeStateToken(userId);

    const user = await this.usersService.findOne(userId);

    if (!user.two_fa_enabled || !user.two_fa_method) {
      throw new BadRequestError(ErrorMessages.AUTH.TWO_FA_NOT_SETUP);
    }

    if (user.two_fa_method === 'totp') {
      if (!user.two_fa_totp_secret) {
        throw new BadRequestError(ErrorMessages.AUTH.TWO_FA_NOT_SETUP);
      }

      const decryptedSecret = decrypt(user.two_fa_totp_secret);

      const result = verifySync({
        secret: decryptedSecret,
        token: code,
      });

      if (!result.valid) {
        throw new UnauthorizedError(ErrorMessages.AUTH.TWO_FA_INVALID_CODE);
      }

      return this.issueTokens(user, SuccessMessages.AUTH.LOGIN);
    }

    throw new BadRequestError(ErrorMessages.AUTH.TWO_FA_NOT_SETUP);
  }

  async verifyRecoveryCode({
    userId,
    code,
  }: {
    userId: string;
    code: string;
  }) {
    await this.consumeStateToken(userId);

    const user = await this.usersService.findOne(userId);

    if (!user.two_fa_enabled || !user.two_fa_method) {
      throw new BadRequestError(ErrorMessages.AUTH.TWO_FA_NOT_SETUP);
    }

    const validCode = await this.verifyRecoveryCodeInternal(userId, code);
    if (!validCode) {
      throw new UnauthorizedError(
        ErrorMessages.AUTH.TWO_FA_INVALID_RECOVERY_CODE,
      );
    }

    return this.issueTokens(user, SuccessMessages.AUTH.LOGIN);
  }

  private async verifyRecoveryCodeInternal(
    userId: string,
    inputCode: string,
  ): Promise<boolean> {
    const codes = await this.recoveryCodeRepository.find({
      where: { user_id: userId, used_at: IsNull() },
    });

    for (const rc of codes) {
      const valid = await argon2.verify(rc.code_hash, inputCode);
      if (valid) {
        await this.recoveryCodeRepository.update(rc.id, {
          used_at: new Date(),
        });
        return true;
      }
    }
    return false;
  }

  /** Post-login redirect based on the user's persisted role. */
  private getPostLoginRedirectPath(user: AuthUser): string {
    if (!user.onboardingComplete) {
      switch (user.role) {
        case UserRole.TALENT:
          return '/talent/onboarding';
        case UserRole.EMPLOYER:
          return '/employer/onboarding';
        default:
          return '/dashboard';
      }
    }

    switch (user.role) {
      case UserRole.TALENT:
        return '/dashboard';
      case UserRole.EMPLOYER:
        return '/discovery';
      case UserRole.ADMIN:
        return '/admin';
      default:
        return '/dashboard';
    }
  }

  private async issueTokens(user: User, message: string): Promise<AuthResult> {
    const tokens = await this.signTokens(user);
    await this.persistRefreshToken(user.id, tokens.refreshToken);

    return {
      message,
      data: {
        user: this.toAuthUser(user),
      },
      tokens,
    };
  }

  private async signTokens(user: User): Promise<AuthTokens> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      onboardingComplete: user.onboarding_complete,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, jti: randomUUID() },
        {
          secret: env.JWT_ACCESS_SECRET,
          expiresIn: env.JWT_ACCESS_EXPIRES_IN as StringValue,
        },
      ),
      this.jwtService.signAsync(
        { ...payload, jti: randomUUID() },
        {
          secret: env.JWT_REFRESH_SECRET,
          expiresIn: env.JWT_REFRESH_EXPIRES_IN as StringValue,
        },
      ),
    ]);
    return {
      accessToken,
      refreshToken,
    };
  }

  private async persistRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hash = await argon2.hash(refreshToken);
    await this.usersService.setRefreshTokenHash(userId, hash);
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      fullname: user.fullname,
      avatar_url: user.avatar_url,
      country: user.country,
      role: user.role,
      is_verified: user.is_verified,
      onboardingComplete: user.onboarding_complete,
    };
  }
}
