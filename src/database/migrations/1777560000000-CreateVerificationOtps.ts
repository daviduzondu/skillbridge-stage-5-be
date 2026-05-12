import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateVerificationOtps1777560000000 implements MigrationInterface {
  name = 'CreateVerificationOtps1777560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'verification_otps',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'otp_hash',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'expires_at',
            type: 'timestamp with time zone',
            isNullable: false,
          },
          {
            name: 'used_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'request_source',
            type: 'varchar',
            length: '20',
            default: `'initial'`,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'verification_otps',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'verification_otps',
      new TableIndex({
        name: 'IDX_verification_otps_user_created_at',
        columnNames: ['user_id', 'created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'verification_otps',
      'IDX_verification_otps_user_created_at',
    );

    const table = await queryRunner.getTable('verification_otps');
    const userForeignKey = table?.foreignKeys.find(
      (foreignKey) => foreignKey.columnNames[0] === 'user_id',
    );
    if (userForeignKey) {
      await queryRunner.dropForeignKey('verification_otps', userForeignKey);
    }

    await queryRunner.dropTable('verification_otps');
  }
}
