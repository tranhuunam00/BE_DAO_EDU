import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTimekeepingLogMatchedSessions1786460000000 implements MigrationInterface {
  name = 'AddTimekeepingLogMatchedSessions1786460000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "timekeeping_log" ADD "matched_sessions" jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "timekeeping_log" DROP COLUMN "matched_sessions"
    `);
  }
}
