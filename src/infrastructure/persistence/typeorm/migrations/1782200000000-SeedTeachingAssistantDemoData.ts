import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcryptjs';

export class SeedTeachingAssistantDemoData1782200000000 implements MigrationInterface {
  name = 'SeedTeachingAssistantDemoData1782200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const passwordHash = await bcrypt.hash('123456', 10);

    // === 1. Create a TA user + teacher profile ===
    const taUserId = '20000000-0000-4000-8000-000000000105';
    const taTeacherId = '40000000-0000-4000-8000-000000000005';
    const teacherRoleId = '10000000-0000-4000-8000-000000000002';

    await queryRunner.query(
      `INSERT INTO "users" ("id", "email", "password_hash", "name", "role_id", "is_active")
       VALUES ($1, $2, $3, $4, $5, true)`,
      [taUserId, 'tam.tran@dao.edu.vn', passwordHash, 'Trần Thanh Tâm', teacherRoleId],
    );

    await queryRunner.query(
      `INSERT INTO "teachers"
        ("id", "teacher_id", "first_name", "last_name", "gender", "birthdate", "mobile", "email", "type",
         "country", "province", "district_ward", "primary_address", "status", "user_id")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        taTeacherId,
        'GV-DAOG-005',
        'Tâm',
        'Trần Thanh',
        'Female',
        '1999-08-15',
        '0905 667 088',
        'tam.tran@dao.edu.vn',
        'Teaching Assistant',
        'Việt Nam',
        'Hà Nội',
        'Đống Đa',
        '55 Thái Hà',
        'Active',
        taUserId,
      ],
    );

    // === 2. Set TA wage per session for all course level pricing records ===
    // Foundation A1: teacher=140k → TA=80k
    await queryRunner.query(
      `UPDATE "course_level_pricing" SET "ta_wage_per_session" = 80000
       WHERE "id" = '62000000-0000-4000-8000-000000000001'`,
    );
    // Confident Speaker A2: teacher=160k → TA=90k
    await queryRunner.query(
      `UPDATE "course_level_pricing" SET "ta_wage_per_session" = 90000
       WHERE "id" = '62000000-0000-4000-8000-000000000002'`,
    );
    // Python Starter: teacher=180k → TA=100k
    await queryRunner.query(
      `UPDATE "course_level_pricing" SET "ta_wage_per_session" = 100000
       WHERE "id" = '62000000-0000-4000-8000-000000000003'`,
    );
    // Python Project Builder: teacher=200k → TA=110k
    await queryRunner.query(
      `UPDATE "course_level_pricing" SET "ta_wage_per_session" = 110000
       WHERE "id" = '62000000-0000-4000-8000-000000000004'`,
    );
    // Robotics Lab 1: teacher=220k → TA=120k
    await queryRunner.query(
      `UPDATE "course_level_pricing" SET "ta_wage_per_session" = 120000
       WHERE "id" = '62000000-0000-4000-8000-000000000005'`,
    );
    // Olympiad Core: teacher=150k → TA=80k
    await queryRunner.query(
      `UPDATE "course_level_pricing" SET "ta_wage_per_session" = 80000
       WHERE "id" = '62000000-0000-4000-8000-000000000006'`,
    );

    // === 3. Assign TA to some existing sessions ===
    // English A1 class (class 1) - TA helps in sessions 1, 2, 3
    await queryRunner.query(
      `UPDATE "class_sessions" SET "assistant_id" = $1
       WHERE "id" IN (
         '90000000-0000-4000-8000-000000000001',
         '90000000-0000-4000-8000-000000000002',
         '90000000-0000-4000-8000-000000000003'
       )`,
      [taTeacherId],
    );

    // Python Starter class (class 2) - TA helps in session 4
    await queryRunner.query(
      `UPDATE "class_sessions" SET "assistant_id" = $1
       WHERE "id" = '90000000-0000-4000-8000-000000000004'`,
      [taTeacherId],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const taTeacherId = '40000000-0000-4000-8000-000000000005';
    const taUserId = '20000000-0000-4000-8000-000000000105';

    // Remove TA assignments from sessions
    await queryRunner.query(
      `UPDATE "class_sessions" SET "assistant_id" = NULL WHERE "assistant_id" = $1`,
      [taTeacherId],
    );

    // Reset TA wage pricing
    await queryRunner.query(
      `UPDATE "course_level_pricing" SET "ta_wage_per_session" = 0`,
    );

    // Delete teacher and user
    await queryRunner.query(`DELETE FROM "teachers" WHERE "id" = $1`, [taTeacherId]);
    await queryRunner.query(`DELETE FROM "users" WHERE "id" = $1`, [taUserId]);
  }
}
