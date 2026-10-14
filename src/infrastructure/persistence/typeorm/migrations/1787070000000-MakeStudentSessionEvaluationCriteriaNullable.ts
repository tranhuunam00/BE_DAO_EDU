import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeStudentSessionEvaluationCriteriaNullable1787070000000 implements MigrationInterface {
  name = 'MakeStudentSessionEvaluationCriteriaNullable1787070000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Gỡ bỏ ràng buộc NOT NULL và giá trị DEFAULT 'completed' cho homework_status
    await queryRunner.query(`
      ALTER TABLE "student_session_evaluations"
      ALTER COLUMN "homework_status" DROP NOT NULL,
      ALTER COLUMN "homework_status" DROP DEFAULT;
    `);

    // 2. Gỡ bỏ ràng buộc NOT NULL và giá trị DEFAULT 'active' cho participation
    await queryRunner.query(`
      ALTER TABLE "student_session_evaluations"
      ALTER COLUMN "participation" DROP NOT NULL,
      ALTER COLUMN "participation" DROP DEFAULT;
    `);

    // 3. Gỡ bỏ ràng buộc NOT NULL và giá trị DEFAULT 'understood' cho understanding
    await queryRunner.query(`
      ALTER TABLE "student_session_evaluations"
      ALTER COLUMN "understanding" DROP NOT NULL,
      ALTER COLUMN "understanding" DROP DEFAULT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "student_session_evaluations"
      ALTER COLUMN "homework_status" SET DEFAULT 'completed',
      ALTER COLUMN "homework_status" SET NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "student_session_evaluations"
      ALTER COLUMN "participation" SET DEFAULT 'active',
      ALTER COLUMN "participation" SET NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "student_session_evaluations"
      ALTER COLUMN "understanding" SET DEFAULT 'understood',
      ALTER COLUMN "understanding" SET NOT NULL;
    `);
  }
}
