import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillCodeToStudentMonthlyBills1782400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add bill_code column
    await queryRunner.query(`
      ALTER TABLE "student_monthly_bills"
      ADD COLUMN "bill_code" varchar,
      ADD CONSTRAINT "UQ_student_monthly_bills_bill_code" UNIQUE ("bill_code")
    `);

    // 2. Backfill existing bills with a bill_code
    await queryRunner.query(`
      UPDATE "student_monthly_bills"
      SET "bill_code" = 'INV-' || TO_CHAR("created_at", 'YYYYMMDD') || '-' || UPPER(REPLACE(id::text, '-', '')::text)::varchar(8)
      WHERE "bill_code" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "student_monthly_bills"
      DROP CONSTRAINT "UQ_student_monthly_bills_bill_code",
      DROP COLUMN "bill_code"
    `);
  }
}
