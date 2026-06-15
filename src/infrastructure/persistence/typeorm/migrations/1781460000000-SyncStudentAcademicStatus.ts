import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncStudentAcademicStatus1781460000000
  implements MigrationInterface
{
  name = 'SyncStudentAcademicStatus1781460000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "students" AS student
      SET "status" = 'Studying', "updated_at" = now()
      WHERE student."status" NOT IN ('Suspended', 'Graduated')
        AND EXISTS (
          SELECT 1
          FROM "class_students" AS enrollment
          WHERE enrollment."student_id" = student."id"
            AND enrollment."status" = 'Active'
        )
    `);
    await queryRunner.query(`
      UPDATE "students" AS student
      SET "status" = 'Waiting for class', "updated_at" = now()
      WHERE student."status" IN ('Active', 'Studying')
        AND NOT EXISTS (
          SELECT 1
          FROM "class_students" AS enrollment
          WHERE enrollment."student_id" = student."id"
            AND enrollment."status" = 'Active'
        )
    `);
  }

  public async down(): Promise<void> {
    // Previous inconsistent status values cannot be reconstructed safely.
  }
}
