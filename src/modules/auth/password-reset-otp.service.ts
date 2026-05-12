import * as argon2 from 'argon2';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt } from 'crypto';
import { Repository } from 'typeorm';
import { parseDurationToMs } from '../../config/duration';
import { env } from '../../config/env';
import {
  PasswordResetOtp,
  PasswordResetOtpSource,
} from './entities/password-reset-otp.entity';

export interface IssuedPasswordResetOtp {
  code: string;
  expiresAt: Date;
}

@Injectable()
export class PasswordResetOtpService {
  constructor(
    @InjectRepository(PasswordResetOtp)
    private readonly repository: Repository<PasswordResetOtp>,
  ) {}

  async issue(
    userId: string,
    requestSource: PasswordResetOtpSource,
  ): Promise<IssuedPasswordResetOtp> {
    await this.invalidateActiveOtps(userId);

    const code = this.generateCode();
    const expiresAt = new Date(
      Date.now() + parseDurationToMs(env.PASSWORD_RESET_OTP_EXPIRES_IN),
    );
    const otp = this.repository.create({
      userId,
      otpHash: await argon2.hash(code),
      expiresAt,
      usedAt: null,
      requestSource,
    });
    await this.repository.save(otp);

    return { code, expiresAt };
  }

  async consume(userId: string, code: string): Promise<boolean> {
    const latestOtp = await this.repository
      .createQueryBuilder('password_reset_otp')
      .where('password_reset_otp.user_id = :userId', { userId })
      .andWhere('password_reset_otp.used_at IS NULL')
      .andWhere('password_reset_otp.expires_at > NOW()')
      .orderBy('password_reset_otp.created_at', 'DESC')
      .getOne();

    if (!latestOtp) {
      return false;
    }

    const matches = await argon2.verify(latestOtp.otpHash, code);
    if (!matches) {
      return false;
    }

    const result = await this.repository
      .createQueryBuilder()
      .update(PasswordResetOtp)
      .set({ usedAt: () => 'CURRENT_TIMESTAMP' })
      .where('id = :id', { id: latestOtp.id })
      .andWhere('used_at IS NULL')
      .execute();

    return (result.affected ?? 0) > 0;
  }

  async countRecentResends(userId: string, since: Date): Promise<number> {
    return this.repository
      .createQueryBuilder('password_reset_otp')
      .where('password_reset_otp.user_id = :userId', { userId })
      .andWhere('password_reset_otp.request_source = :requestSource', {
        requestSource: PasswordResetOtpSource.RESEND,
      })
      .andWhere('password_reset_otp.created_at >= :since', { since })
      .getCount();
  }

  private async invalidateActiveOtps(userId: string): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(PasswordResetOtp)
      .set({ usedAt: () => 'CURRENT_TIMESTAMP' })
      .where('user_id = :userId', { userId })
      .andWhere('used_at IS NULL')
      .andWhere('expires_at > NOW()')
      .execute();
  }

  private generateCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }
}
