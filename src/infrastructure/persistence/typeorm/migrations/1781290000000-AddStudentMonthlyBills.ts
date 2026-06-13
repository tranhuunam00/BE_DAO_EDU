import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudentMonthlyBills1781290000000 implements MigrationInterface {
  name = 'AddStudentMonthlyBills1781290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "student_monthly_bills" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "student_id" uuid NOT NULL,
        "month" varchar NOT NULL,
        "total_amount" decimal(12,2) NOT NULL DEFAULT 0,
        "paid_amount" decimal(12,2) NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'Unpaid',
        "payment_date" TIMESTAMP,
        "note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_student_monthly_bills" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_student_month" UNIQUE ("student_id", "month"),
        CONSTRAINT "FK_student_monthly_bills_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "student_monthly_bills"`);
  }
}
