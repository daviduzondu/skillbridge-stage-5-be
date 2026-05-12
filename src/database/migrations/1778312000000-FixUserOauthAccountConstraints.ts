import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixUserOauthAccountConstraints1778312000000 implements MigrationInterface {
  name = 'FixUserOauthAccountConstraints1778312000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_oauth_accounts" DROP CONSTRAINT IF EXISTS "UQ_e378ee51a78adea4509c0e906d8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_oauth_accounts" DROP CONSTRAINT IF EXISTS "UQ_7eb25183e951b6ca44f292df21a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_oauth_accounts" DROP CONSTRAINT IF EXISTS "REL_a093a39110ecd3602d87f0e814"`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_oauth_provider" ON "user_oauth_accounts" ("user_id", "provider")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_oauth_provider_external_id" ON "user_oauth_accounts" ("provider", "provider_id")`,
    );
  }

  public down(_queryRunner: QueryRunner): Promise<void> {
    // This migration is irreversible. Rolling back would restore broken UNIQUE
    // constraints (UQ_e378ee51a78adea4509c0e906d8, UQ_7eb25183e951b6ca44f292df21a,
    // REL_a093a39110ecd3602d87f0e814) that prevent proper OAuth functionality.
    throw new Error(
      'Migration FixUserOauthAccountConstraints1778312000000 is irreversible. ' +
        'Rollback would restore a broken schema that prevents users from linking ' +
        'multiple OAuth providers.',
    );
  }
}
