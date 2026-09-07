import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeacherCommissionSalaryFlag1786430000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teachers"
      ADD COLUMN "has_commission_salary" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teachers"
      DROP COLUMN "has_commission_salary"
    `);
  }
}
