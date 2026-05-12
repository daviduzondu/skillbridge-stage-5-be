import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameCandidateProfilesToTalentProfiles1778600000000 implements MigrationInterface {
  name = 'RenameCandidateProfilesToTalentProfiles1778600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" RENAME TO "talent_profiles"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" RENAME TO "candidate_profiles"`,
    );
  }
}
