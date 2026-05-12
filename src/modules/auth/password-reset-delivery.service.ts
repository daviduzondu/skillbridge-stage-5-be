import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { PasswordResetOtpService } from './password-reset-otp.service';
import { PasswordResetOtpSource } from './entities/password-reset-otp.entity';

@Injectable()
export class PasswordResetDeliveryService {
  private readonly logger = new Logger(PasswordResetDeliveryService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordResetOtpService: PasswordResetOtpService,
    private readonly mailService: MailService,
  ) {}

  async deliverForUser(userId: string): Promise<void> {
    const user = await this.usersService.findOneOrNull(userId);
    if (!user) return;

    const issued = await this.passwordResetOtpService.issue(
      user.id,
      PasswordResetOtpSource.INITIAL,
    );

    try {
      await this.mailService.sendPasswordReset({
        to: user.email,
        otp: issued.code,
        expiresAt: issued.expiresAt,
        recipientFirstName: user.first_name,
      });
    } catch (err) {
      this.logger.error(
        `Forgot-password side effects failed for ${this.redactEmailForLog(user.email)}`,
        err instanceof Error ? err.stack : err,
      );
      throw err;
    }
  }

  private redactEmailForLog(email: string): string {
    const at = email.indexOf('@');
    if (at <= 0) {
      return '[redacted]';
    }
    return `***${email.slice(at)}`;
  }
}
