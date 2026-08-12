import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTimekeepingLogTeacherId1786480000000 implements MigrationInterface {
  name = 'AddTimekeepingLogTeacherId1786480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "timekeeping_log" ADD "teacher_id" uuid NULL;
      ALTER TABLE "timekeeping_log" ADD CONSTRAINT "FK_timekeeping_log_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL;
      ALTER TABLE "teachers" ADD "is_synced_to_device" boolean NOT NULL DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teachers" DROP COLUMN "is_synced_to_device";
      ALTER TABLE "timekeeping_log" DROP CONSTRAINT "FK_timekeeping_log_teacher";
      ALTER TABLE "timekeeping_log" DROP COLUMN "teacher_id";
    `);
  }
}
