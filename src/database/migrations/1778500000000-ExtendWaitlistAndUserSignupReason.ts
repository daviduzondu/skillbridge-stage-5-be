import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ExtendWaitlistAndUserSignupReason1778500000000 implements MigrationInterface {
  name = 'ExtendWaitlistAndUserSignupReason1778500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'signup_reason',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'waitlist_entries',
      new TableColumn({
        name: 'joining_as',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'waitlist_entries',
      new TableColumn({
        name: 'full_name',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'waitlist_entries',
      new TableColumn({
        name: 'preferred_role',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'waitlist_entries',
      new TableColumn({
        name: 'referral_source',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('waitlist_entries', 'referral_source');
    await queryRunner.dropColumn('waitlist_entries', 'preferred_role');
    await queryRunner.dropColumn('waitlist_entries', 'full_name');
    await queryRunner.dropColumn('waitlist_entries', 'joining_as');
    await queryRunner.dropColumn('users', 'signup_reason');
  }
}
