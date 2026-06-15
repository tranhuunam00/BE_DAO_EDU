import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnforceFullBillingPayments1781440000000
  implements MigrationInterface
{
  name = 'EnforceFullBillingPayments1781440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "student_monthly_bills"
      SET
        "status" = CASE WHEN "status" = 'Paid' THEN 'Paid' ELSE 'Unpaid' END,
        "paid_amount" = CASE WHEN "status" = 'Paid' THEN "total_amount" ELSE 0 END,
        "payment_date" = CASE WHEN "status" = 'Paid' THEN "payment_date" ELSE NULL END
    `);
    await queryRunner.query(`
      UPDATE "teacher_monthly_wages"
      SET
        "status" = CASE WHEN "status" = 'Paid' THEN 'Paid' ELSE 'Unpaid' END,
        "paid_amount" = CASE WHEN "status" = 'Paid' THEN "total_amount" ELSE 0 END,
        "payment_date" = CASE WHEN "status" = 'Paid' THEN "payment_date" ELSE NULL END
    `);
    await queryRunner.query(`
      ALTER TABLE "student_monthly_bills"
      ADD CONSTRAINT "CHK_student_monthly_bills_full_payment"
      CHECK (
        ("status" = 'Paid' AND "paid_amount" = "total_amount")
        OR ("status" = 'Unpaid' AND "paid_amount" = 0)
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "teacher_monthly_wages"
      ADD CONSTRAINT "CHK_teacher_monthly_wages_full_payment"
      CHECK (
        ("status" = 'Paid' AND "paid_amount" = "total_amount")
        OR ("status" = 'Unpaid' AND "paid_amount" = 0)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teacher_monthly_wages"
      DROP CONSTRAINT "CHK_teacher_monthly_wages_full_payment"
    `);
    await queryRunner.query(`
      ALTER TABLE "student_monthly_bills"
      DROP CONSTRAINT "CHK_student_monthly_bills_full_payment"
    `);
  }
}
