import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillingPeriodToBillsAndWages1781320000000 implements MigrationInterface {
  name = 'AddBillingPeriodToBillsAndWages1781320000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "student_monthly_bills" 
      ADD COLUMN "billing_start_date" TIMESTAMP,
      ADD COLUMN "billing_end_date" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "teacher_monthly_wages" 
      ADD COLUMN "billing_start_date" TIMESTAMP,
      ADD COLUMN "billing_end_date" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teacher_monthly_wages" 
      DROP COLUMN "billing_end_date",
      DROP COLUMN "billing_start_date"
    `);

    await queryRunner.query(`
      ALTER TABLE "student_monthly_bills" 
      DROP COLUMN "billing_end_date",
      DROP COLUMN "billing_start_date"
    `);
  }
}
