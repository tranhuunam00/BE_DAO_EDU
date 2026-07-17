import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEvaluationToStudentAttendance1782600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "student_attendance"
      ADD COLUMN "evaluation_score" numeric(3,1),
      ADD COLUMN "evaluation_comment" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "student_attendance"
      DROP COLUMN "evaluation_score",
      DROP COLUMN "evaluation_comment"
    `);
  }
}
