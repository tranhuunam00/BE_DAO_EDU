import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMonthlyBillWageItems1781310000000 implements MigrationInterface {
  name = 'AddMonthlyBillWageItems1781310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "student_monthly_bill_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "bill_id" uuid NOT NULL,
        "class_id" uuid,
        "class_name" varchar NOT NULL,
        "course_name" varchar NOT NULL,
        "level_name" varchar NOT NULL,
        "sessions_count" integer NOT NULL DEFAULT 0,
        "rate" decimal(12,2) NOT NULL DEFAULT 0,
        "total_amount" decimal(12,2) NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_student_monthly_bill_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_student_monthly_bill_items_bill" FOREIGN KEY ("bill_id") REFERENCES "student_monthly_bills"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_student_monthly_bill_items_class" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "teacher_monthly_wage_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "wage_id" uuid NOT NULL,
        "class_id" uuid,
        "class_name" varchar NOT NULL,
        "course_name" varchar NOT NULL,
        "level_name" varchar NOT NULL,
        "sessions_count" integer NOT NULL DEFAULT 0,
        "rate" decimal(12,2) NOT NULL DEFAULT 0,
        "total_amount" decimal(12,2) NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_teacher_monthly_wage_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_teacher_monthly_wage_items_wage" FOREIGN KEY ("wage_id") REFERENCES "teacher_monthly_wages"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_teacher_monthly_wage_items_class" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "teacher_monthly_wage_items"`);
    await queryRunner.query(`DROP TABLE "student_monthly_bill_items"`);
  }
}
