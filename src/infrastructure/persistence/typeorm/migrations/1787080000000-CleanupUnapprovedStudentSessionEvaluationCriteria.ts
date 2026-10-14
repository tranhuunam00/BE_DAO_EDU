import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanupUnapprovedStudentSessionEvaluationCriteria1787080000000 implements MigrationInterface {
  name = 'CleanupUnapprovedStudentSessionEvaluationCriteria1787080000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Làm sạch dữ liệu ảo: Chuyển các bản ghi chưa được giáo viên thực sự duyệt về NULL
    // Giữ nguyên 100% lời nhận xét (comment) và điểm số (score) của giáo viên
    await queryRunner.query(`
      UPDATE "student_session_evaluations"
      SET "homework_status" = NULL,
          "participation" = NULL,
          "understanding" = NULL
      WHERE "is_approved" = FALSE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Không thể khôi phục các giá trị ngầm bị xóa vì đó là dữ liệu mặc định ảo
  }
}
