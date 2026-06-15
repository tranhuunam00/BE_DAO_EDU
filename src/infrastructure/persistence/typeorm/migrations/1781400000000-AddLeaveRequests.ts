import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLeaveRequests1781400000000 implements MigrationInterface {
  name = 'AddLeaveRequests1781400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "leave_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "student_id" uuid NOT NULL,
        "class_session_id" uuid NOT NULL,
        "reason" text NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "submitted_at" TIMESTAMPTZ NOT NULL,
        "reviewed_at" TIMESTAMPTZ,
        "reviewed_by_user_id" uuid,
        "review_note" text,
        "cancelled_at" TIMESTAMPTZ,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_leave_requests" PRIMARY KEY ("id"),
        CONSTRAINT "CK_leave_requests_status"
          CHECK ("status" IN ('pending', 'approved', 'rejected', 'cancelled')),
        CONSTRAINT "FK_leave_requests_student"
          FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_leave_requests_session"
          FOREIGN KEY ("class_session_id") REFERENCES "class_sessions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_leave_requests_reviewer"
          FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_leave_requests_student" ON "leave_requests" ("student_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_leave_requests_session" ON "leave_requests" ("class_session_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_leave_requests_status" ON "leave_requests" ("status")`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_leave_requests_active"
      ON "leave_requests" ("student_id", "class_session_id")
      WHERE "status" IN ('pending', 'approved')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_requests" CASCADE`);
  }
}
