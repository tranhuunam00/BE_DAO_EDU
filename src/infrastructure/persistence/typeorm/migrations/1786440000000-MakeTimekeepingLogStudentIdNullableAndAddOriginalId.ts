import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeTimekeepingLogStudentIdNullableAndAddOriginalId1786440000000 implements MigrationInterface {
  name = 'MakeTimekeepingLogStudentIdNullableAndAddOriginalId1786440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop old unique constraint
    await queryRunner.query(`
      ALTER TABLE "timekeeping_log" DROP CONSTRAINT "UQ_timekeeping_log_student_time"
    `);

    // 2. Make student_id nullable
    await queryRunner.query(`
      ALTER TABLE "timekeeping_log" ALTER COLUMN "student_id" DROP NOT NULL
    `);

    // 3. Add original_id column
    await queryRunner.query(`
      ALTER TABLE "timekeeping_log" ADD "original_id" character varying(100)
    `);

    // 4. Add new unique constraint on employee_no and event_time
    await queryRunner.query(`
      ALTER TABLE "timekeeping_log" ADD CONSTRAINT "UQ_timekeeping_log_employee_time" UNIQUE ("employee_no", "event_time")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop the new unique constraint
    await queryRunner.query(`
      ALTER TABLE "timekeeping_log" DROP CONSTRAINT "UQ_timekeeping_log_employee_time"
    `);

    // 2. Drop original_id column
    await queryRunner.query(`
      ALTER TABLE "timekeeping_log" DROP COLUMN "original_id"
    `);

    // 3. Make student_id NOT NULL again
    await queryRunner.query(`
      ALTER TABLE "timekeeping_log" ALTER COLUMN "student_id" SET NOT NULL
    `);

    // 4. Add old unique constraint back
    await queryRunner.query(`
      ALTER TABLE "timekeeping_log" ADD CONSTRAINT "UQ_timekeeping_log_student_time" UNIQUE ("student_id", "event_time")
    `);
  }
}
