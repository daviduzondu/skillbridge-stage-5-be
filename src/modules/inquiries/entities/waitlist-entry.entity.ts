import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('waitlist_entries')
export class WaitlistEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'joining_as' })
  joiningAs: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'full_name' })
  fullName: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'preferred_role',
  })
  preferredRole: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'referral_source',
  })
  referralSource: string | null;

  @CreateDateColumn({
    type: 'timestamp with time zone',
    name: 'created_at',
  })
  createdAt: Date;
}
