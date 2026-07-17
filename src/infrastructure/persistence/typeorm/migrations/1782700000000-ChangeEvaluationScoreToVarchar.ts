import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeEvaluationScoreToVarchar1782700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "student_attendance"
      ALTER COLUMN "evaluation_score" TYPE varchar(50)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "student_attendance"
      ALTER COLUMN "evaluation_score" TYPE numeric(3,1) USING (NULLIF(evaluation_score, '')::numeric(3,1))
    `);
  }
}
