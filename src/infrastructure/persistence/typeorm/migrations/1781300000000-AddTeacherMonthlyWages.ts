import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeacherMonthlyWages1781300000000 implements MigrationInterface {
  name = 'AddTeacherMonthlyWages1781300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "teacher_monthly_wages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "teacher_id" uuid NOT NULL,
        "month" varchar NOT NULL,
        "total_amount" decimal(12,2) NOT NULL DEFAULT 0,
        "paid_amount" decimal(12,2) NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'Unpaid',
        "payment_date" TIMESTAMP,
        "note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_teacher_monthly_wages" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_teacher_month" UNIQUE ("teacher_id", "month"),
        CONSTRAINT "FK_teacher_monthly_wages_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "teacher_monthly_wages"`);
  }
}
