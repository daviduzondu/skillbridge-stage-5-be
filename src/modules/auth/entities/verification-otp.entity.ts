import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum VerificationOtpSource {
  INITIAL = 'initial',
  RESEND = 'resend',
}

@Entity('verification_otps')
export class VerificationOtp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 255, name: 'otp_hash' })
  otpHash: string;

  @Column({ type: 'timestamp with time zone', name: 'expires_at' })
  expiresAt: Date;

  @Column({
    type: 'timestamp with time zone',
    name: 'used_at',
    nullable: true,
  })
  usedAt: Date | null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'request_source',
    default: VerificationOtpSource.INITIAL,
  })
  requestSource: VerificationOtpSource;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt: Date;
}
