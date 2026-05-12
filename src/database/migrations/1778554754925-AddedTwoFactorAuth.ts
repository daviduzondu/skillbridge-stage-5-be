import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddedTwoFactorAuth1778554754925 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('users', [
      new TableColumn({
        name: 'two_fa_enabled',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
      new TableColumn({
        name: 'two_fa_method',
        type: 'enum',
        enum: ['totp'],
        isNullable: true,
      }),
      new TableColumn({
        name: 'two_fa_totp_secret',
        type: 'text',
        isNullable: true,
      }),
    ]);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('users', [
      'two_fa_enabled',
      'two_fa_method',
      'two_fa_totp_secret',
    ]);
  }
}
