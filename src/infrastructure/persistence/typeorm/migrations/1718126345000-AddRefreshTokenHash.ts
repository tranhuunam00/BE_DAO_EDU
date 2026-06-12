import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshTokenHash1718126345000 implements MigrationInterface {
  name = 'AddRefreshTokenHash1718126345000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN "refresh_token_hash" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "refresh_token_hash"
    `);
  }
}
