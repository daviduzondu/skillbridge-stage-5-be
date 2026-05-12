import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * This migration restores indexes that were incorrectly dropped by
 * MakeUserPasswordNullable1778335465924. Those indexes were unrelated
 * to the password nullability change and should not have been removed.
 */
export class RestoreIncorrectlyDroppedIndexes1778336000000 implements MigrationInterface {
  name = 'RestoreIncorrectlyDroppedIndexes1778336000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Restore indexes that were incorrectly dropped by MakeUserPasswordNullable
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_waitlist_entries_created_at" ON "waitlist_entries" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_contact_messages_created_at" ON "contact_messages" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_verification_otps_user_created_at" ON "verification_otps" ("user_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // If rolling back, remove the restored indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_verification_otps_user_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_contact_messages_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_waitlist_entries_created_at"`,
    );
  }
}
