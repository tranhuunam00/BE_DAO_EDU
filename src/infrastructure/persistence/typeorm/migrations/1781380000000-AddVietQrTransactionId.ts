import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVietQrTransactionId1781380000000 implements MigrationInterface {
  name = 'AddVietQrTransactionId1781380000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tuition_payment_logs"
      ADD COLUMN "external_transaction_id" varchar,
      ADD CONSTRAINT "UQ_tuition_payment_logs_external_transaction_id"
        UNIQUE ("external_transaction_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tuition_payment_logs"
      DROP CONSTRAINT "UQ_tuition_payment_logs_external_transaction_id",
      DROP COLUMN "external_transaction_id"
    `);
  }
}
