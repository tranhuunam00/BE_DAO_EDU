import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentPeriodsAndRelations1781330000000 implements MigrationInterface {
  name = 'AddPaymentPeriodsAndRelations1781330000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create payment_periods table
    await queryRunner.query(`
      CREATE TABLE "payment_periods" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "type" varchar NOT NULL,
        "month" varchar NOT NULL,
        "start_date" TIMESTAMP NOT NULL,
        "end_date" TIMESTAMP NOT NULL,
        "status" varchar NOT NULL DEFAULT 'Active',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_periods" PRIMARY KEY ("id")
      )
    `);

    // 2. Add columns to bills and wages tables
    await queryRunner.query(`
      ALTER TABLE "student_monthly_bills" 
      ADD COLUMN "period_id" uuid NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "teacher_monthly_wages" 
      ADD COLUMN "period_id" uuid NULL
    `);

    // 3. Add columns to attendance and sessions tables
    await queryRunner.query(`
      ALTER TABLE "student_attendance" 
      ADD COLUMN "bill_id" uuid NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "class_sessions" 
      ADD COLUMN "wage_id" uuid NULL
    `);

    // 4. Drop old unique constraints
    await queryRunner.query(`
      ALTER TABLE "student_monthly_bills" 
      DROP CONSTRAINT "UQ_student_month"
    `);

    await queryRunner.query(`
      ALTER TABLE "teacher_monthly_wages" 
      DROP CONSTRAINT "UQ_teacher_month"
    `);

    // 5. Add new unique constraints
    await queryRunner.query(`
      ALTER TABLE "student_monthly_bills" 
      ADD CONSTRAINT "UQ_student_period" UNIQUE ("student_id", "period_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "teacher_monthly_wages" 
      ADD CONSTRAINT "UQ_teacher_period" UNIQUE ("teacher_id", "period_id")
    `);

    // 6. Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "student_monthly_bills" 
      ADD CONSTRAINT "FK_student_monthly_bills_period" 
      FOREIGN KEY ("period_id") REFERENCES "payment_periods"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "teacher_monthly_wages" 
      ADD CONSTRAINT "FK_teacher_monthly_wages_period" 
      FOREIGN KEY ("period_id") REFERENCES "payment_periods"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "student_attendance" 
      ADD CONSTRAINT "FK_student_attendance_bill" 
      FOREIGN KEY ("bill_id") REFERENCES "student_monthly_bills"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "class_sessions" 
      ADD CONSTRAINT "FK_class_sessions_wage" 
      FOREIGN KEY ("wage_id") REFERENCES "teacher_monthly_wages"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Remove foreign key constraints
    await queryRunner.query(`ALTER TABLE "class_sessions" DROP CONSTRAINT "FK_class_sessions_wage"`);
    await queryRunner.query(`ALTER TABLE "student_attendance" DROP CONSTRAINT "FK_student_attendance_bill"`);
    await queryRunner.query(`ALTER TABLE "teacher_monthly_wages" DROP CONSTRAINT "FK_teacher_monthly_wages_period"`);
    await queryRunner.query(`ALTER TABLE "student_monthly_bills" DROP CONSTRAINT "FK_student_monthly_bills_period"`);

    // 2. Remove unique constraints
    await queryRunner.query(`ALTER TABLE "teacher_monthly_wages" DROP CONSTRAINT "UQ_teacher_period"`);
    await queryRunner.query(`ALTER TABLE "student_monthly_bills" DROP CONSTRAINT "UQ_student_period"`);

    // 3. Re-add old unique constraints
    await queryRunner.query(`
      ALTER TABLE "teacher_monthly_wages" 
      ADD CONSTRAINT "UQ_teacher_month" UNIQUE ("teacher_id", "month")
    `);

    await queryRunner.query(`
      ALTER TABLE "student_monthly_bills" 
      ADD CONSTRAINT "UQ_student_month" UNIQUE ("student_id", "month")
    `);

    // 4. Remove columns
    await queryRunner.query(`ALTER TABLE "class_sessions" DROP COLUMN "wage_id"`);
    await queryRunner.query(`ALTER TABLE "student_attendance" DROP COLUMN "bill_id"`);
    await queryRunner.query(`ALTER TABLE "teacher_monthly_wages" DROP COLUMN "period_id"`);
    await queryRunner.query(`ALTER TABLE "student_monthly_bills" DROP COLUMN "period_id"`);

    // 5. Drop payment_periods table
    await queryRunner.query(`DROP TABLE "payment_periods"`);
  }
}
