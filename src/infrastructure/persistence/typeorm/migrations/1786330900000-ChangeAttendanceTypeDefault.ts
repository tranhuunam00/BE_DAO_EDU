import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeAttendanceTypeDefault1786330900000 implements MigrationInterface {
  name = 'ChangeAttendanceTypeDefault1786330900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Sửa default value của cột attendance_type thành 'machine'
    await queryRunner.query(`
      ALTER TABLE "student_attendance" ALTER COLUMN "attendance_type" SET DEFAULT 'machine'
    `);

    // 2. Cập nhật các bản ghi cũ chưa điểm danh thực tế sang 'machine'
    await queryRunner.query(`
      UPDATE "student_attendance" 
      SET "attendance_type" = 'machine' 
      WHERE "attendance_type" = 'manual' 
        AND "is_present" = false 
        AND "reason" IS NULL 
        AND "note" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Khôi phục default value thành 'manual'
    await queryRunner.query(`
      ALTER TABLE "student_attendance" ALTER COLUMN "attendance_type" SET DEFAULT 'manual'
    `);

    // 2. Khôi phục các bản ghi 'machine' thành 'manual'
    await queryRunner.query(`
      UPDATE "student_attendance" 
      SET "attendance_type" = 'manual' 
      WHERE "attendance_type" = 'machine'
    `);
  }
}
