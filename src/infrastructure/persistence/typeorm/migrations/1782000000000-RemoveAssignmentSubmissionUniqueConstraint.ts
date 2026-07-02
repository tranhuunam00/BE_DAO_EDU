import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveAssignmentSubmissionUniqueConstraint1782000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assignment_submissions" DROP CONSTRAINT IF EXISTS "UQ_assignment_submissions_student"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assignment_submissions" ADD CONSTRAINT "UQ_assignment_submissions_student" UNIQUE ("assignment_id", "student_id")`,
    );
  }
}
