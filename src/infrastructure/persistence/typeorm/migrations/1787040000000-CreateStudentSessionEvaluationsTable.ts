import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStudentSessionEvaluationsTable1787040000000 implements MigrationInterface {
  name = 'CreateStudentSessionEvaluationsTable1787040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "student_session_evaluations" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "class_session_id" UUID NOT NULL,
        "student_id" UUID NOT NULL,
        "teacher_id" UUID,
        "homework_status" VARCHAR(20) NOT NULL DEFAULT 'completed',
        "participation" VARCHAR(20) NOT NULL DEFAULT 'active',
        "understanding" VARCHAR(20) NOT NULL DEFAULT 'understood',
        "behavior_tags" TEXT[] NOT NULL DEFAULT '{}',
        "score" VARCHAR(10),
        "comment" TEXT,
        "is_ai_generated" BOOLEAN NOT NULL DEFAULT FALSE,
        "is_approved" BOOLEAN NOT NULL DEFAULT FALSE,
        "approved_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "UQ_session_student_eval" UNIQUE ("class_session_id", "student_id"),
        CONSTRAINT "FK_eval_session" FOREIGN KEY ("class_session_id") REFERENCES "class_sessions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_eval_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_eval_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_eval_class_session_id" ON "student_session_evaluations" ("class_session_id");
      CREATE INDEX "IDX_eval_student_id" ON "student_session_evaluations" ("student_id");
      CREATE INDEX "IDX_eval_is_approved" ON "student_session_evaluations" ("is_approved");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "student_session_evaluations" CASCADE`);
  }
}
