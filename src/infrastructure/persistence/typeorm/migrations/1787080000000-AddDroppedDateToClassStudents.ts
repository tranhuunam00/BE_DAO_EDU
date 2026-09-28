import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDroppedDateToClassStudents1787080000000 implements MigrationInterface {
  name = 'AddDroppedDateToClassStudents1787080000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "class_students"
      ADD COLUMN IF NOT EXISTS "dropped_date" date NULL;
    `);

    await queryRunner.query(`
      UPDATE "class_students"
      SET "dropped_date" = "updated_at"::date
      WHERE "status" = 'Dropped' AND "dropped_date" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "class_students"
      DROP COLUMN IF EXISTS "dropped_date";
    `);
  }
}
