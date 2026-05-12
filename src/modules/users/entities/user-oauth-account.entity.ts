import { ApiProperty } from '@nestjs/swagger';
import { User } from './user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('user_oauth_accounts')
@Index('IDX_user_oauth_provider', ['user_id', 'provider'], { unique: true })
@Index('IDX_oauth_provider_external_id', ['provider', 'provider_id'], {
  unique: true,
})
export class OAuthUser {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column()
  user_id: string;

  @ManyToOne(() => User, (user: User) => user.oauthAccounts)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 20 })
  provider: string;

  @Column({ type: 'varchar', length: 255 })
  provider_id: string;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
