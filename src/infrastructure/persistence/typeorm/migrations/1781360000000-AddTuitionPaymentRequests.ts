import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTuitionPaymentRequests1781360000000 implements MigrationInterface {
  name = 'AddTuitionPaymentRequests1781360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tuition_payment_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "bill_id" uuid NOT NULL,
        "amount" decimal(12,2) NOT NULL,
        "bank_code" varchar NOT NULL,
        "account_number" varchar NOT NULL,
        "account_name" varchar NOT NULL,
        "transfer_content" varchar NOT NULL,
        "qr_url" text NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "sent_at" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tuition_payment_requests" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tuition_payment_requests_bill" UNIQUE ("bill_id"),
        CONSTRAINT "UQ_tuition_payment_requests_content" UNIQUE ("transfer_content"),
        CONSTRAINT "FK_tuition_payment_requests_bill" FOREIGN KEY ("bill_id") REFERENCES "student_monthly_bills"("id") ON DELETE CASCADE,
        CONSTRAINT "CK_tuition_payment_requests_status" CHECK ("status" IN ('pending', 'cancelled')),
        CONSTRAINT "CK_tuition_payment_requests_amount" CHECK ("amount" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_tuition_payment_requests_status" ON "tuition_payment_requests" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "tuition_payment_requests" CASCADE`,
    );
  }
}
