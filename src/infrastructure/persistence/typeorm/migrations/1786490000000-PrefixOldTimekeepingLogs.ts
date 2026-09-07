import { MigrationInterface, QueryRunner } from 'typeorm';

export class PrefixOldTimekeepingLogs1786490000000 implements MigrationInterface {
  name = 'PrefixOldTimekeepingLogs1786490000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- Thêm tiền tố 1111 cho học sinh nếu chưa có tiền tố 1111
      UPDATE "timekeeping_log"
      SET "employee_no" = '1111' || "employee_no"
      WHERE "student_id" IS NOT NULL
        AND "employee_no" NOT LIKE '1111%';

      -- Thêm tiền tố 222 cho giáo viên nếu chưa có tiền tố 222
      UPDATE "timekeeping_log"
      SET "employee_no" = '222' || "employee_no"
      WHERE "teacher_id" IS NOT NULL
        AND "employee_no" NOT LIKE '222%';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- Bỏ tiền tố 1111 cho học sinh
      UPDATE "timekeeping_log"
      SET "employee_no" = SUBSTRING("employee_no" FROM 5)
      WHERE "student_id" IS NOT NULL
        AND "employee_no" LIKE '1111%';

      -- Bỏ tiền tố 222 cho giáo viên
      UPDATE "timekeeping_log"
      SET "employee_no" = SUBSTRING("employee_no" FROM 4)
      WHERE "teacher_id" IS NOT NULL
        AND "employee_no" LIKE '222%';
    `);
  }
}
