import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTypeToCourseLevelPricingAndSplitRecords1787070000000
  implements MigrationInterface
{
  name = 'AddTypeToCourseLevelPricingAndSplitRecords1787070000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Thêm cột type với giá trị mặc định là 'student'
    await queryRunner.query(`
      ALTER TABLE "course_level_pricing"
      ADD COLUMN IF NOT EXISTS "type" varchar(20) DEFAULT 'student';
    `);

    // 2. Tách các bản ghi gộp trong lịch sử thành các bản ghi độc lập:
    // 2a. Nhân bản dòng có lương giáo viên > 0 VÀ đơn giá học viên > 0 thành bản ghi riêng cho giáo viên
    await queryRunner.query(`
      INSERT INTO "course_level_pricing" (
        "id", "course_level_id", "price_per_session", "teacher_wage_per_session", "ta_wage_per_session",
        "effective_from", "effective_to", "type", "created_at", "updated_at"
      )
      SELECT
        gen_random_uuid(), "course_level_id", 0, "teacher_wage_per_session", 0,
        "effective_from", "effective_to", 'teacher', "created_at", "updated_at"
      FROM "course_level_pricing"
      WHERE "teacher_wage_per_session" > 0 AND "price_per_session" > 0;
    `);

    // 2b. Nhân bản dòng có lương trợ giảng > 0 VÀ (đơn giá học viên > 0 HOẶC lương giáo viên > 0) thành bản ghi riêng cho trợ giảng
    await queryRunner.query(`
      INSERT INTO "course_level_pricing" (
        "id", "course_level_id", "price_per_session", "teacher_wage_per_session", "ta_wage_per_session",
        "effective_from", "effective_to", "type", "created_at", "updated_at"
      )
      SELECT
        gen_random_uuid(), "course_level_id", 0, 0, "ta_wage_per_session",
        "effective_from", "effective_to", 'ta', "created_at", "updated_at"
      FROM "course_level_pricing"
      WHERE "ta_wage_per_session" > 0 AND ("price_per_session" > 0 OR "teacher_wage_per_session" > 0);
    `);

    // 2c. Reset lương giáo viên và trợ giảng về 0 cho bản ghi học sinh (bản ghi gốc có price_per_session > 0)
    await queryRunner.query(`
      UPDATE "course_level_pricing"
      SET "teacher_wage_per_session" = 0, "ta_wage_per_session" = 0, "type" = 'student'
      WHERE "price_per_session" > 0;
    `);

    // 2d. Đánh dấu type = 'teacher' cho bản ghi đơn lẻ chỉ có lương giáo viên
    await queryRunner.query(`
      UPDATE "course_level_pricing"
      SET "type" = 'teacher'
      WHERE "teacher_wage_per_session" > 0 AND "price_per_session" = 0 AND "ta_wage_per_session" = 0;
    `);

    // 2e. Đánh dấu type = 'ta' cho bản ghi đơn lẻ chỉ có lương trợ giảng
    await queryRunner.query(`
      UPDATE "course_level_pricing"
      SET "type" = 'ta'
      WHERE "ta_wage_per_session" > 0 AND "price_per_session" = 0 AND "teacher_wage_per_session" = 0;
    `);

    // 3. Đặt cột type thành NOT NULL
    await queryRunner.query(`
      ALTER TABLE "course_level_pricing"
      ALTER COLUMN "type" SET NOT NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "course_level_pricing"
      DROP COLUMN IF EXISTS "type";
    `);
  }
}
