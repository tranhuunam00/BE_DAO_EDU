import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexesForReports1785600000000 implements MigrationInterface {
  name = 'AddPerformanceIndexesForReports1785600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_student_attendance_class_session_id" ON "student_attendance" ("class_session_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_student_attendance_student_id" ON "student_attendance" ("student_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_student_attendance_bill_id" ON "student_attendance" ("bill_id")`
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_class_sessions_class_id" ON "class_sessions" ("class_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_class_sessions_date" ON "class_sessions" ("date")`
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_class_students_class_id" ON "class_students" ("class_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_class_students_student_id" ON "class_students" ("student_id")`
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_student_monthly_bills_student_id" ON "student_monthly_bills" ("student_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_student_monthly_bills_month" ON "student_monthly_bills" ("month")`
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_student_monthly_bill_items_bill_id" ON "student_monthly_bill_items" ("bill_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_student_monthly_bill_items_class_id" ON "student_monthly_bill_items" ("class_id")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_student_monthly_bill_items_class_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_student_monthly_bill_items_bill_id"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_student_monthly_bills_month"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_student_monthly_bills_student_id"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_class_students_student_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_class_students_class_id"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_class_sessions_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_class_sessions_class_id"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_student_attendance_bill_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_student_attendance_student_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_student_attendance_class_session_id"`);
  }
}
