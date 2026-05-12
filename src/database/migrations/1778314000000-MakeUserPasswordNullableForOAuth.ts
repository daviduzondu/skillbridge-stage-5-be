import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeUserPasswordNullableForOAuth1778314000000 implements MigrationInterface {
  name = 'MakeUserPasswordNullableForOAuth1778314000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT COUNT(*)::text AS count FROM "users" WHERE "password" IS NULL`,
    )) as unknown as { count: string }[];
    const count = parseInt(rows[0]?.count ?? '0', 10);
    if (count > 0) {
      throw new Error(
        'Cannot revert MakeUserPasswordNullableForOAuth: OAuth-only users with NULL password exist',
      );
    }
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password" SET NOT NULL`,
    );
  }
}
