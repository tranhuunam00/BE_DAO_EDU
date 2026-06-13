import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeacherWageToPricing1781280000000 implements MigrationInterface {
  name = 'AddTeacherWageToPricing1781280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "course_level_pricing"
      ADD COLUMN "teacher_wage_per_session" decimal(12,2) NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "course_level_pricing"
      DROP COLUMN "teacher_wage_per_session"
    `);
  }
}
