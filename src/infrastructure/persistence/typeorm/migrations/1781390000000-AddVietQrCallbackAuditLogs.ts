import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVietQrCallbackAuditLogs1781390000000
  implements MigrationInterface
{
  name = 'AddVietQrCallbackAuditLogs1781390000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "vietqr_callback_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "transaction_id" varchar,
        "reference_number" varchar,
        "order_id" varchar,
        "payment_request_id" uuid,
        "bill_id" uuid,
        "result" varchar NOT NULL,
        "error_reason" varchar,
        "message" text,
        "payload" jsonb NOT NULL,
        "processed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vietqr_callback_logs" PRIMARY KEY ("id"),
        CONSTRAINT "CK_vietqr_callback_logs_result"
          CHECK ("result" IN ('received', 'success', 'duplicate', 'rejected')),
        CONSTRAINT "FK_vietqr_callback_logs_request"
          FOREIGN KEY ("payment_request_id") REFERENCES "tuition_payment_requests"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_vietqr_callback_logs_bill"
          FOREIGN KEY ("bill_id") REFERENCES "student_monthly_bills"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_vietqr_callback_logs_transaction" ON "vietqr_callback_logs" ("transaction_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vietqr_callback_logs_created" ON "vietqr_callback_logs" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vietqr_callback_logs_result" ON "vietqr_callback_logs" ("result")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "vietqr_callback_logs" CASCADE`);
  }
}
