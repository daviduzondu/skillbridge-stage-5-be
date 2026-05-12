import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameCandidateRoleToTalent1778401000000 implements MigrationInterface {
  name = 'RenameCandidateRoleToTalent1778401000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TYPE "users_role_enum" RENAME VALUE 'candidate' TO 'talent'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'talent'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TYPE "users_role_enum" RENAME VALUE 'talent' TO 'candidate'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'candidate'`,
    );
  }
}
