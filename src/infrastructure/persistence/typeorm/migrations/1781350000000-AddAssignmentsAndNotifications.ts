import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssignmentsAndNotifications1781350000000 implements MigrationInterface {
  name = 'AddAssignmentsAndNotifications1781350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "assignments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "class_id" uuid NOT NULL,
        "created_by_teacher_id" uuid,
        "title" varchar NOT NULL,
        "description" text,
        "due_at" TIMESTAMPTZ,
        "max_score" decimal(8,2) NOT NULL DEFAULT 10,
        "status" varchar NOT NULL DEFAULT 'draft',
        "published_at" TIMESTAMPTZ,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assignments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_assignments_class" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_assignments_teacher" FOREIGN KEY ("created_by_teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL,
        CONSTRAINT "CK_assignments_status" CHECK ("status" IN ('draft', 'published', 'closed')),
        CONSTRAINT "CK_assignments_max_score" CHECK ("max_score" > 0)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "assignment_attachments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "assignment_id" uuid NOT NULL,
        "file_name" varchar NOT NULL,
        "object_key" varchar NOT NULL,
        "mime_type" varchar NOT NULL,
        "file_size" bigint NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assignment_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_assignment_attachments_key" UNIQUE ("object_key"),
        CONSTRAINT "FK_assignment_attachments_assignment" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "assignment_submissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "assignment_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "answer_text" text,
        "status" varchar NOT NULL DEFAULT 'submitted',
        "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "score" decimal(8,2),
        "feedback" text,
        "graded_by_teacher_id" uuid,
        "graded_at" TIMESTAMPTZ,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assignment_submissions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_assignment_submissions_student" UNIQUE ("assignment_id", "student_id"),
        CONSTRAINT "FK_assignment_submissions_assignment" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_assignment_submissions_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_assignment_submissions_teacher" FOREIGN KEY ("graded_by_teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL,
        CONSTRAINT "CK_assignment_submissions_status" CHECK ("status" IN ('submitted', 'late', 'graded')),
        CONSTRAINT "CK_assignment_submissions_score" CHECK ("score" IS NULL OR "score" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "submission_attachments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "submission_id" uuid NOT NULL,
        "file_name" varchar NOT NULL,
        "object_key" varchar NOT NULL,
        "mime_type" varchar NOT NULL,
        "file_size" bigint NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_submission_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_submission_attachments_key" UNIQUE ("object_key"),
        CONSTRAINT "FK_submission_attachments_submission" FOREIGN KEY ("submission_id") REFERENCES "assignment_submissions"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" varchar NOT NULL,
        "title" varchar NOT NULL,
        "message" text NOT NULL,
        "link_path" varchar,
        "read_at" TIMESTAMPTZ,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_assignments_class_status" ON "assignments" ("class_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_assignments_due_at" ON "assignments" ("due_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_submissions_assignment" ON "assignment_submissions" ("assignment_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_read" ON "notifications" ("user_id", "read_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications" CASCADE`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "submission_attachments" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "assignment_submissions" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "assignment_attachments" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "assignments" CASCADE`);
  }
}
