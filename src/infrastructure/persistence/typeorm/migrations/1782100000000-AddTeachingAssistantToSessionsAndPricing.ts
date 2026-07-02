import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeachingAssistantToSessionsAndPricing1782100000000 implements MigrationInterface {
  name = 'AddTeachingAssistantToSessionsAndPricing1782100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "class_sessions"
      ADD COLUMN "assistant_id" uuid,
      ADD COLUMN "assistant_wage_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "class_sessions"
      ADD CONSTRAINT "FK_class_sessions_assistant" FOREIGN KEY ("assistant_id") REFERENCES "teachers"("id") ON DELETE SET NULL,
      ADD CONSTRAINT "FK_class_sessions_assistant_wage" FOREIGN KEY ("assistant_wage_id") REFERENCES "teacher_monthly_wages"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "course_level_pricing"
      ADD COLUMN "ta_wage_per_session" decimal(12,2) NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "course_level_pricing"
      DROP COLUMN "ta_wage_per_session"
    `);

    await queryRunner.query(`
      ALTER TABLE "class_sessions"
      DROP CONSTRAINT "FK_class_sessions_assistant_wage",
      DROP CONSTRAINT "FK_class_sessions_assistant"
    `);

    await queryRunner.query(`
      ALTER TABLE "class_sessions"
      DROP COLUMN "assistant_wage_id",
      DROP COLUMN "assistant_id"
    `);
  }
}
