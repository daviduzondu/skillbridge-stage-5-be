import * as argon2 from 'argon2';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt } from 'crypto';
import { Repository } from 'typeorm';
import { env } from '../../config/env';
import { parseDurationToMs } from '../../config/duration';
import {
  VerificationOtp,
  VerificationOtpSource,
} from './entities/verification-otp.entity';

export interface IssuedVerificationOtp {
  code: string;
  expiresAt: Date;
}

@Injectable()
export class VerificationOtpService {
  constructor(
    @InjectRepository(VerificationOtp)
    private readonly repository: Repository<VerificationOtp>,
  ) {}

  async issue(
    userId: string,
    requestSource: VerificationOtpSource,
  ): Promise<IssuedVerificationOtp> {
    await this.invalidateActiveOtps(userId);

    const code = this.generateCode();
    const expiresAt = new Date(
      Date.now() + parseDurationToMs(env.VERIFICATION_OTP_EXPIRES_IN),
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
      .createQueryBuilder('verification_otp')
      .where('verification_otp.user_id = :userId', { userId })
      .andWhere('verification_otp.used_at IS NULL')
      .andWhere('verification_otp.expires_at > NOW()')
      .orderBy('verification_otp.created_at', 'DESC')
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
      .update(VerificationOtp)
      .set({ usedAt: () => 'CURRENT_TIMESTAMP' })
      .where('id = :id', { id: latestOtp.id })
      .andWhere('used_at IS NULL')
      .execute();

    return (result.affected ?? 0) > 0;
  }

  async countRecentResends(userId: string, since: Date): Promise<number> {
    return this.repository
      .createQueryBuilder('verification_otp')
      .where('verification_otp.user_id = :userId', { userId })
      .andWhere('verification_otp.request_source = :requestSource', {
        requestSource: VerificationOtpSource.RESEND,
      })
      .andWhere('verification_otp.created_at >= :since', { since })
      .getCount();
  }

  private async invalidateActiveOtps(userId: string): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(VerificationOtp)
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
