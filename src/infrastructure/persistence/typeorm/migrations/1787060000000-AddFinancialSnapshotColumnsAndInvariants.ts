import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFinancialSnapshotColumnsAndInvariants1787060000000
  implements MigrationInterface
{
  name = 'AddFinancialSnapshotColumnsAndInvariants1787060000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Thêm các cột snapshot tài chính mới
    await queryRunner.query(`
      ALTER TABLE "student_attendance"
      ADD COLUMN IF NOT EXISTS "billed_amount" numeric(12,2) DEFAULT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "class_sessions"
      ADD COLUMN IF NOT EXISTS "billed_teacher_wage" numeric(12,2) DEFAULT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "class_sessions"
      ADD COLUMN IF NOT EXISTS "billed_assistant_wage" numeric(12,2) DEFAULT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "teacher_monthly_wage_items"
      ADD COLUMN IF NOT EXISTS "role" varchar(20) DEFAULT 'teacher';
    `);

    // 2. Backfill dữ liệu role cho teacher_monthly_wage_items (CH-05)
    await queryRunner.query(`
      UPDATE teacher_monthly_wage_items wi
      SET "role" = 'assistant'
      WHERE EXISTS (
        SELECT 1 FROM class_sessions cs
        WHERE cs.assistant_wage_id = wi.wage_id
          AND (wi.class_id IS NULL OR cs.class_id = wi.class_id)
      );
    `);

    // 3. Backfill dữ liệu lịch sử cho student_attendance.billed_amount
    // Ưu tiên giá theo đúng ngày học từ course_level_pricing, fallback sang bi.rate
    await queryRunner.query(`
      UPDATE student_attendance sa
      SET billed_amount = COALESCE(
        (
          SELECT p.price_per_session
          FROM classes cl
          JOIN course_level_pricing p ON p.course_level_id = cl.course_level_id
          WHERE cl.id = cs.class_id
            AND p.effective_from <= cs.date
            AND (p.effective_to IS NULL OR p.effective_to >= cs.date)
          ORDER BY p.effective_from DESC, p.created_at DESC
          LIMIT 1
        ),
        bi.rate
      )
      FROM class_sessions cs, student_monthly_bill_items bi
      WHERE cs.id = sa.class_session_id
        AND sa.bill_id IS NOT NULL
        AND bi.bill_id = sa.bill_id
        AND (bi.class_id IS NULL OR bi.class_id = cs.class_id);
    `);

    // Fallback an toàn cho các điểm danh có bill_id nhưng không khớp item (ví dụ demo/seed data)
    await queryRunner.query(`
      UPDATE student_attendance
      SET billed_amount = 0
      WHERE bill_id IS NOT NULL AND billed_amount IS NULL;
    `);

    // Dọn dẹp orphan: bill_id IS NULL thì billed_amount bắt buộc phải là NULL
    await queryRunner.query(`
      UPDATE student_attendance
      SET billed_amount = NULL
      WHERE bill_id IS NULL AND billed_amount IS NOT NULL;
    `);

    // 4. Backfill dữ liệu lịch sử cho class_sessions.billed_teacher_wage
    await queryRunner.query(`
      UPDATE class_sessions cs
      SET billed_teacher_wage = COALESCE(
        (
          SELECT p.teacher_wage_per_session
          FROM classes cl
          JOIN course_level_pricing p ON p.course_level_id = cl.course_level_id
          WHERE cl.id = cs.class_id
            AND p.effective_from <= cs.date
            AND (p.effective_to IS NULL OR p.effective_to >= cs.date)
          ORDER BY p.effective_from DESC, p.created_at DESC
          LIMIT 1
        ),
        wi.rate
      )
      FROM teacher_monthly_wage_items wi
      WHERE cs.wage_id IS NOT NULL
        AND wi.wage_id = cs.wage_id
        AND (wi.role = 'teacher' OR wi.role IS NULL)
        AND (wi.class_id IS NULL OR wi.class_id = cs.class_id);
    `);

    await queryRunner.query(`
      UPDATE class_sessions
      SET billed_teacher_wage = 0
      WHERE wage_id IS NOT NULL AND billed_teacher_wage IS NULL;
    `);

    await queryRunner.query(`
      UPDATE class_sessions
      SET billed_teacher_wage = NULL
      WHERE wage_id IS NULL AND billed_teacher_wage IS NOT NULL;
    `);

    // 5. Backfill dữ liệu lịch sử cho class_sessions.billed_assistant_wage
    await queryRunner.query(`
      UPDATE class_sessions cs
      SET billed_assistant_wage = COALESCE(
        (
          SELECT p.ta_wage_per_session
          FROM classes cl
          JOIN course_level_pricing p ON p.course_level_id = cl.course_level_id
          WHERE cl.id = cs.class_id
            AND p.effective_from <= cs.date
            AND (p.effective_to IS NULL OR p.effective_to >= cs.date)
          ORDER BY p.effective_from DESC, p.created_at DESC
          LIMIT 1
        ),
        wi.rate
      )
      FROM teacher_monthly_wage_items wi
      WHERE cs.assistant_wage_id IS NOT NULL
        AND wi.wage_id = cs.assistant_wage_id
        AND wi.role = 'assistant'
        AND (wi.class_id IS NULL OR wi.class_id = cs.class_id);
    `);

    await queryRunner.query(`
      UPDATE class_sessions
      SET billed_assistant_wage = 0
      WHERE assistant_wage_id IS NOT NULL AND billed_assistant_wage IS NULL;
    `);

    await queryRunner.query(`
      UPDATE class_sessions
      SET billed_assistant_wage = NULL
      WHERE assistant_wage_id IS NULL AND billed_assistant_wage IS NOT NULL;
    `);

    // 6. Thêm các CHECK Constraints bảo vệ toàn vẹn dữ liệu
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_attendance_billed_amount'
        ) THEN
          ALTER TABLE "student_attendance"
          ADD CONSTRAINT "chk_student_attendance_billed_amount"
          CHECK (
            (bill_id IS NULL AND billed_amount IS NULL) OR
            (bill_id IS NOT NULL AND billed_amount IS NOT NULL AND billed_amount >= 0)
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_class_session_teacher_wage'
        ) THEN
          ALTER TABLE "class_sessions"
          ADD CONSTRAINT "chk_class_session_teacher_wage"
          CHECK (
            (wage_id IS NULL AND billed_teacher_wage IS NULL) OR
            (wage_id IS NOT NULL AND billed_teacher_wage IS NOT NULL AND billed_teacher_wage >= 0)
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_class_session_assistant_wage'
        ) THEN
          ALTER TABLE "class_sessions"
          ADD CONSTRAINT "chk_class_session_assistant_wage"
          CHECK (
            (assistant_wage_id IS NULL AND billed_assistant_wage IS NULL) OR
            (assistant_wage_id IS NOT NULL AND billed_assistant_wage IS NOT NULL AND billed_assistant_wage >= 0)
          );
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "student_attendance"
      DROP CONSTRAINT IF EXISTS "chk_student_attendance_billed_amount";
    `);

    await queryRunner.query(`
      ALTER TABLE "class_sessions"
      DROP CONSTRAINT IF EXISTS "chk_class_session_teacher_wage";
    `);

    await queryRunner.query(`
      ALTER TABLE "class_sessions"
      DROP CONSTRAINT IF EXISTS "chk_class_session_assistant_wage";
    `);

    await queryRunner.query(`
      ALTER TABLE "teacher_monthly_wage_items"
      DROP COLUMN IF EXISTS "role";
    `);

    await queryRunner.query(`
      ALTER TABLE "class_sessions"
      DROP COLUMN IF EXISTS "billed_assistant_wage";
    `);

    await queryRunner.query(`
      ALTER TABLE "class_sessions"
      DROP COLUMN IF EXISTS "billed_teacher_wage";
    `);

    await queryRunner.query(`
      ALTER TABLE "student_attendance"
      DROP COLUMN IF EXISTS "billed_amount";
    `);
  }
}
