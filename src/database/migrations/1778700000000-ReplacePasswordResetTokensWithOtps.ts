import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class ReplacePasswordResetTokensWithOtps1778700000000 implements MigrationInterface {
  name = 'ReplacePasswordResetTokensWithOtps1778700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const oldTable = await queryRunner.getTable('password_reset_tokens');
    if (oldTable) {
      const fk = oldTable.foreignKeys.find(
        (k) => k.columnNames[0] === 'user_id',
      );
      if (fk) {
        await queryRunner.dropForeignKey('password_reset_tokens', fk);
      }
      await queryRunner.dropTable('password_reset_tokens');
    }

    // --- Create new OTP-based table ---
    await queryRunner.createTable(
      new Table({
        name: 'password_reset_otps',
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
            isNullable: false,
            default: "'initial'",
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            isNullable: false,
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'password_reset_otps',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'password_reset_otps',
      new TableIndex({
        name: 'IDX_password_reset_otps_user_used_expires',
        columnNames: ['user_id', 'used_at', 'expires_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const otpTable = await queryRunner.getTable('password_reset_otps');
    if (otpTable) {
      const fk = otpTable.foreignKeys.find(
        (k) => k.columnNames[0] === 'user_id',
      );
      if (fk) {
        await queryRunner.dropForeignKey('password_reset_otps', fk);
      }
      await queryRunner.dropIndex(
        'password_reset_otps',
        'IDX_password_reset_otps_user_used_expires',
      );
      await queryRunner.dropTable('password_reset_otps');
    }

    // --- Restore old token-based table ---
    await queryRunner.createTable(
      new Table({
        name: 'password_reset_tokens',
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
            name: 'token_lookup_hash',
            type: 'varchar',
            length: '64',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'token_hash',
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
            name: 'created_at',
            type: 'timestamp with time zone',
            isNullable: false,
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'password_reset_tokens',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'password_reset_tokens',
      new TableIndex({
        name: 'IDX_password_reset_tokens_user_used_expires',
        columnNames: ['user_id', 'used_at', 'expires_at'],
      }),
    );
  }
}
