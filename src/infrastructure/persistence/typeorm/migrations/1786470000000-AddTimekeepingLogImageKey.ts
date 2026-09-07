import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTimekeepingLogImageKey1786470000000 implements MigrationInterface {
  name = 'AddTimekeepingLogImageKey1786470000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "timekeeping_log" ADD "image_key" character varying(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "timekeeping_log" DROP COLUMN "image_key"
    `);
  }
}
