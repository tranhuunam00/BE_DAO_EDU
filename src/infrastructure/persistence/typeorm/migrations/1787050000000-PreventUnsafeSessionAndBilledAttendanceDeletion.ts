import { MigrationInterface, QueryRunner } from 'typeorm';

export class PreventUnsafeSessionAndBilledAttendanceDeletion1787050000000
  implements MigrationInterface
{
  name = 'PreventUnsafeSessionAndBilledAttendanceDeletion1787050000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Trigger function trên bảng class_sessions: Chặn xóa buổi học không an toàn
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION fn_prevent_unsafe_class_session_delete()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Chặn xóa nếu buổi học không ở trạng thái Scheduled (ví dụ: In-Progress, Completed, Cancelled...)
        IF OLD.status != 'Scheduled' THEN
          RAISE EXCEPTION 'CANNOT_DELETE_SESSION: Khong the xoa buoi hoc o trang thai "%". Chi cho phep xoa buoi hoc chua dien ra (Scheduled).', OLD.status;
        END IF;

        -- Chặn xóa nếu buổi học đã bị khóa điểm danh
        IF OLD.attendance_locked = TRUE THEN
          RAISE EXCEPTION 'CANNOT_DELETE_SESSION: Buoi hoc da bi khoa diem danh.';
        END IF;

        -- Chặn xóa nếu buổi học đã được chốt thù lao giáo viên
        IF OLD.wage_id IS NOT NULL OR OLD.assistant_wage_id IS NOT NULL THEN
          RAISE EXCEPTION 'CANNOT_DELETE_SESSION: Buoi hoc da duoc chot thu lao giao vien.';
        END IF;

        -- Chặn xóa nếu có học sinh trong buổi học đã xuất hóa đơn hoặc có mặt thực tế
        IF EXISTS (
          SELECT 1 FROM student_attendance
          WHERE class_session_id = OLD.id
            AND (bill_id IS NOT NULL OR is_present = TRUE OR verify_method IS NOT NULL)
        ) THEN
          RAISE EXCEPTION 'CANNOT_DELETE_SESSION: Khong the xoa buoi hoc vi da co diem danh duoc chot hoa don hoac ghi nhan co mat.';
        END IF;

        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_prevent_unsafe_class_session_delete ON "class_sessions";
      CREATE TRIGGER trg_prevent_unsafe_class_session_delete
      BEFORE DELETE ON "class_sessions"
      FOR EACH ROW
      EXECUTE FUNCTION fn_prevent_unsafe_class_session_delete();
    `);

    // 2. Trigger function trên bảng student_attendance: Chặn xóa điểm danh đã có billId hoặc chấm công
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION fn_prevent_billed_student_attendance_delete()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.bill_id IS NOT NULL THEN
          RAISE EXCEPTION 'CANNOT_DELETE_ATTENDANCE: Khong the xoa ban ghi diem danh da chot hoa don (bill_id: %).', OLD.bill_id;
        END IF;

        IF OLD.is_present = TRUE THEN
          RAISE EXCEPTION 'CANNOT_DELETE_ATTENDANCE: Khong the xoa ban ghi diem danh cua hoc sinh da co mat.';
        END IF;

        IF OLD.verify_method IS NOT NULL THEN
          RAISE EXCEPTION 'CANNOT_DELETE_ATTENDANCE: Khong the xoa ban ghi diem danh da co du lieu cham cong may.';
        END IF;

        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_prevent_billed_student_attendance_delete ON "student_attendance";
      CREATE TRIGGER trg_prevent_billed_student_attendance_delete
      BEFORE DELETE ON "student_attendance"
      FOR EACH ROW
      EXECUTE FUNCTION fn_prevent_billed_student_attendance_delete();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_prevent_billed_student_attendance_delete ON "student_attendance";
      DROP FUNCTION IF EXISTS fn_prevent_billed_student_attendance_delete();
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_prevent_unsafe_class_session_delete ON "class_sessions";
      DROP FUNCTION IF EXISTS fn_prevent_unsafe_class_session_delete();
    `);
  }
}
