import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTimekeepingTables1786330800000 implements MigrationInterface {
  name = 'AddTimekeepingTables1786330800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tạo bảng timekeeping_device
    await queryRunner.query(`
      CREATE TABLE "timekeeping_device" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(100) NOT NULL,
        "ip_address" character varying(50) NOT NULL,
        "port" integer NOT NULL DEFAULT 80,
        "username" character varying(50) NOT NULL DEFAULT 'admin',
        "password" character varying(100) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'offline',
        "last_sync_time" timestamp without time zone,
        CONSTRAINT "PK_timekeeping_device_id" PRIMARY KEY ("id")
      )
    `);

    // 2. Tạo bảng timekeeping_log
    await queryRunner.query(`
      CREATE TABLE "timekeeping_log" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "student_id" uuid NOT NULL,
        "employee_no" character varying(50) NOT NULL,
        "event_time" timestamp without time zone NOT NULL,
        "verify_method" character varying(50) NOT NULL,
        "raw_payload" jsonb,
        CONSTRAINT "PK_timekeeping_log_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_timekeeping_log_student_time" UNIQUE ("student_id", "event_time")
      )
    `);

    // Tạo Index cho student_id trong timekeeping_log
    await queryRunner.query(`
      CREATE INDEX "idx_timekeeping_log_student_id" ON "timekeeping_log" ("student_id")
    `);

    // 3. Cập nhật bảng students
    await queryRunner.query(`
      ALTER TABLE "students" ADD "is_synced_to_device" boolean NOT NULL DEFAULT false
    `);

    // 4. Cập nhật bảng student_attendance
    await queryRunner.query(`
      ALTER TABLE "student_attendance" ADD "attendance_type" character varying NOT NULL DEFAULT 'manual'
    `);
    await queryRunner.query(`
      ALTER TABLE "student_attendance" ADD "verify_method" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "student_attendance" ADD "is_late" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "student_attendance" ADD "late_minutes" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Rollback student_attendance
    await queryRunner.query(`ALTER TABLE "student_attendance" DROP COLUMN "late_minutes"`);
    await queryRunner.query(`ALTER TABLE "student_attendance" DROP COLUMN "is_late"`);
    await queryRunner.query(`ALTER TABLE "student_attendance" DROP COLUMN "verify_method"`);
    await queryRunner.query(`ALTER TABLE "student_attendance" DROP COLUMN "attendance_type"`);

    // 2. Rollback students
    await queryRunner.query(`ALTER TABLE "students" DROP COLUMN "is_synced_to_device"`);

    // 3. Rollback timekeeping_log
    await queryRunner.query(`DROP INDEX "idx_timekeeping_log_student_id"`);
    await queryRunner.query(`DROP TABLE "timekeeping_log"`);

    // 4. Rollback timekeeping_device
    await queryRunner.query(`DROP TABLE "timekeeping_device"`);
  }
}
