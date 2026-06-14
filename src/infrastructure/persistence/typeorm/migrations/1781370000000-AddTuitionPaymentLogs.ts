import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTuitionPaymentLogs1781370000000 implements MigrationInterface {
  name = 'AddTuitionPaymentLogs1781370000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tuition_payment_requests" DROP CONSTRAINT "CK_tuition_payment_requests_status"`,
    );
    await queryRunner.query(`
      ALTER TABLE "tuition_payment_requests"
      ADD COLUMN "claimed_at" TIMESTAMPTZ,
      ADD COLUMN "reconciled_at" TIMESTAMPTZ,
      ADD CONSTRAINT "CK_tuition_payment_requests_status"
        CHECK ("status" IN ('pending', 'processing', 'reconciled', 'cancelled'))
    `);
    await queryRunner.query(`
      CREATE TABLE "tuition_payment_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "payment_request_id" uuid NOT NULL,
        "bill_id" uuid NOT NULL,
        "event" varchar NOT NULL,
        "status" varchar NOT NULL,
        "amount" decimal(12,2) NOT NULL,
        "source" varchar NOT NULL DEFAULT 'simulation',
        "message" text,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tuition_payment_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tuition_payment_logs_request" FOREIGN KEY ("payment_request_id") REFERENCES "tuition_payment_requests"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tuition_payment_logs_bill" FOREIGN KEY ("bill_id") REFERENCES "student_monthly_bills"("id") ON DELETE CASCADE,
        CONSTRAINT "CK_tuition_payment_logs_event" CHECK ("event" IN ('transfer_claimed', 'auto_reconciled')),
        CONSTRAINT "CK_tuition_payment_logs_status" CHECK ("status" IN ('processing', 'success', 'failed')),
        CONSTRAINT "CK_tuition_payment_logs_source" CHECK ("source" IN ('simulation', 'vietqr_callback')),
        CONSTRAINT "CK_tuition_payment_logs_amount" CHECK ("amount" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_tuition_payment_logs_request_created" ON "tuition_payment_logs" ("payment_request_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tuition_payment_logs_bill" ON "tuition_payment_logs" ("bill_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tuition_payment_logs" CASCADE`);
    await queryRunner.query(
      `ALTER TABLE "tuition_payment_requests" DROP CONSTRAINT "CK_tuition_payment_requests_status"`,
    );
    await queryRunner.query(`
      ALTER TABLE "tuition_payment_requests"
      DROP COLUMN "reconciled_at",
      DROP COLUMN "claimed_at",
      ADD CONSTRAINT "CK_tuition_payment_requests_status"
        CHECK ("status" IN ('pending', 'cancelled'))
    `);
  }
}
