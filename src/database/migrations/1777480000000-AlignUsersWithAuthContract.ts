import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AlignUsersWithAuthContract1777480000000 implements MigrationInterface {
  name = 'AlignUsersWithAuthContract1777480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" TYPE varchar(20) USING "role"::text`,
    );
    await queryRunner.query(`DROP TYPE "users_role_enum"`);
    await queryRunner.query(
      `CREATE TYPE "users_role_enum" AS ENUM ('admin', 'candidate', 'employer')`,
    );
    await queryRunner.query(
      `UPDATE "users" SET "role" = 'candidate' WHERE "role" = 'user'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" TYPE "users_role_enum" USING "role"::"users_role_enum"`,
    );

    await queryRunner.addColumns('users', [
      new TableColumn({
        name: 'country',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
      new TableColumn({
        name: 'is_verified',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
      new TableColumn({
        name: 'onboarding_complete',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    ]);

    // Backfill existing rows so pre-migration users are not locked out by
    // verification/onboarding gates introduced after this migration.
    await queryRunner.query(
      `UPDATE "users" SET "is_verified" = true, "onboarding_complete" = true`,
    );
    await queryRunner.query(
      `UPDATE "users" SET "country" = 'Unknown' WHERE "country" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "country" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'candidate'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" TYPE varchar(20) USING "role"::text`,
    );
    await queryRunner.query(
      `UPDATE "users" SET "role" = 'user' WHERE "role" <> 'admin'`,
    );
    await queryRunner.query(`DROP TYPE "users_role_enum"`);
    await queryRunner.query(
      `CREATE TYPE "users_role_enum" AS ENUM ('admin', 'user')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" TYPE "users_role_enum" USING "role"::"users_role_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user'`,
    );

    await queryRunner.dropColumn('users', 'onboarding_complete');
    await queryRunner.dropColumn('users', 'is_verified');
    await queryRunner.dropColumn('users', 'country');
  }
}
