import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillingReceiptsAndAudit1781450000000
  implements MigrationInterface
{
  name = 'AddBillingReceiptsAndAudit1781450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['student_monthly_bills', 'teacher_monthly_wages']) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
        ADD COLUMN "payment_method" varchar,
        ADD COLUMN "processed_by_user_id" uuid,
        ADD CONSTRAINT "FK_${table}_processed_by"
          FOREIGN KEY ("processed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      `);
    }
    await queryRunner.query(`
      ALTER TABLE "student_monthly_bills"
      ADD COLUMN "receipt_code" varchar,
      ADD CONSTRAINT "UQ_student_monthly_bills_receipt_code" UNIQUE ("receipt_code")
    `);
    await queryRunner.query(`
      CREATE TABLE "billing_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event" varchar NOT NULL,
        "order_type" varchar,
        "order_id" uuid,
        "period_id" uuid,
        "actor_id" uuid,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_billing_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_billing_audit_logs_actor"
          FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_billing_audit_logs_order" ON "billing_audit_logs" ("order_type", "order_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_billing_audit_logs_period" ON "billing_audit_logs" ("period_id", "created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_audit_logs"`);
    await queryRunner.query(`
      ALTER TABLE "student_monthly_bills"
      DROP CONSTRAINT "UQ_student_monthly_bills_receipt_code",
      DROP COLUMN "receipt_code"
    `);
    for (const table of ['teacher_monthly_wages', 'student_monthly_bills']) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
        DROP CONSTRAINT "FK_${table}_processed_by",
        DROP COLUMN "processed_by_user_id",
        DROP COLUMN "payment_method"
      `);
    }
  }
}
