import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourseAndClassTables1781260000000 implements MigrationInterface {
  name = 'AddCourseAndClassTables1781260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. rooms
    await queryRunner.query(`
      CREATE TABLE "rooms" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "center_id" uuid NOT NULL,
        "name" varchar NOT NULL,
        "capacity" int NOT NULL DEFAULT 30,
        "status" varchar NOT NULL DEFAULT 'Active',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rooms" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rooms_center" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE
      )
    `);

    // 2. courses
    await queryRunner.query(`
      CREATE TABLE "courses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "category" varchar NOT NULL,
        "name" varchar NOT NULL,
        "short_name" varchar NOT NULL,
        "type_of_period" varchar,
        "year" varchar,
        "max_size" int,
        "status" varchar NOT NULL DEFAULT 'Active',
        "description" text,
        "assigned_to" uuid,
        "center_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_courses" PRIMARY KEY ("id")
      )
    `);

    // 3. course_levels
    await queryRunner.query(`
      CREATE TABLE "course_levels" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "course_id" uuid NOT NULL,
        "level_name" varchar NOT NULL,
        "level_code" varchar NOT NULL,
        "total_hours" decimal(10,4) NOT NULL DEFAULT 0,
        "is_fixed_hour" boolean NOT NULL DEFAULT false,
        "can_upgrade" boolean NOT NULL DEFAULT false,
        "gradebook_setting" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_course_levels" PRIMARY KEY ("id"),
        CONSTRAINT "FK_course_levels_course" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
      )
    `);

    // 4. course_level_pricing
    await queryRunner.query(`
      CREATE TABLE "course_level_pricing" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "course_level_id" uuid NOT NULL,
        "price_per_session" decimal(12,2) NOT NULL DEFAULT 0,
        "effective_from" date NOT NULL,
        "effective_to" date,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_course_level_pricing" PRIMARY KEY ("id"),
        CONSTRAINT "FK_course_level_pricing_level" FOREIGN KEY ("course_level_id") REFERENCES "course_levels"("id") ON DELETE CASCADE
      )
    `);

    // 5. classes
    await queryRunner.query(`
      CREATE TABLE "classes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "course_id" uuid NOT NULL,
        "course_level_id" uuid NOT NULL,
        "class_code" varchar NOT NULL,
        "class_name" varchar NOT NULL,
        "upgrade_from_class_id" uuid,
        "type_of_class" varchar,
        "default_hours" decimal(10,4),
        "status" varchar NOT NULL DEFAULT 'Planning',
        "start_date" date,
        "finish_date" date,
        "syllabus_by" varchar,
        "max_size" int,
        "skip_holidays" boolean NOT NULL DEFAULT false,
        "description" text,
        "main_teacher_id" uuid,
        "assigned_to" uuid,
        "cso_name" varchar,
        "center_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_classes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_classes_code" UNIQUE ("class_code"),
        CONSTRAINT "FK_classes_course" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_classes_level" FOREIGN KEY ("course_level_id") REFERENCES "course_levels"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_classes_teacher" FOREIGN KEY ("main_teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_classes_center" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE SET NULL
      )
    `);

    // 6. class_schedules
    await queryRunner.query(`
      CREATE TABLE "class_schedules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "class_id" uuid NOT NULL,
        "room_id" uuid,
        "weekday" varchar NOT NULL,
        "start_time" time NOT NULL,
        "end_time" time NOT NULL,
        "duration_mins" int,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_class_schedules" PRIMARY KEY ("id"),
        CONSTRAINT "FK_class_schedules_class" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_class_schedules_room" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL
      )
    `);

    // 7. class_sessions
    await queryRunner.query(`
      CREATE TABLE "class_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "class_id" uuid NOT NULL,
        "room_id" uuid,
        "teacher_id" uuid,
        "date" date NOT NULL,
        "start_time" time NOT NULL,
        "end_time" time NOT NULL,
        "status" varchar NOT NULL DEFAULT 'Scheduled',
        "attendance_locked" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_class_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_class_sessions_class" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_class_sessions_room" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_class_sessions_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL
      )
    `);

    // 8. class_students
    await queryRunner.query(`
      CREATE TABLE "class_students" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "class_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'Active',
        "joined_date" date NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_class_students" PRIMARY KEY ("id"),
        CONSTRAINT "FK_class_students_class" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_class_students_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_class_students" UNIQUE ("class_id", "student_id")
      )
    `);

    // 9. student_attendance
    await queryRunner.query(`
      CREATE TABLE "student_attendance" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "class_session_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "is_present" boolean NOT NULL DEFAULT false,
        "reason" varchar,
        "note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_student_attendance" PRIMARY KEY ("id"),
        CONSTRAINT "FK_student_attendance_session" FOREIGN KEY ("class_session_id") REFERENCES "class_sessions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_student_attendance_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_student_attendance" UNIQUE ("class_session_id", "student_id")
      )
    `);

    // Indexes for performance
    await queryRunner.query(`CREATE INDEX "IDX_class_sessions_date" ON "class_sessions" ("date")`);
    await queryRunner.query(`CREATE INDEX "IDX_class_sessions_class_id" ON "class_sessions" ("class_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_class_sessions_teacher_id" ON "class_sessions" ("teacher_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_student_attendance_session" ON "student_attendance" ("class_session_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_student_attendance_student" ON "student_attendance" ("student_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_class_students_class" ON "class_students" ("class_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_course_levels_course" ON "course_levels" ("course_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "student_attendance" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "class_students" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "class_sessions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "class_schedules" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "classes" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "course_level_pricing" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "course_levels" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "courses" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rooms" CASCADE`);
  }
}
