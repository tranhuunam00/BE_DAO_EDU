import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContactRequests1781480000000 implements MigrationInterface {
  name = 'AddContactRequests1781480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "contact_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "full_name" varchar(120) NOT NULL,
        "phone" varchar(20) NOT NULL,
        "type" varchar(40) NOT NULL DEFAULT 'ENROLLMENT',
        "status" varchar(20) NOT NULL DEFAULT 'NEW',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_contact_requests_type"
          CHECK ("type" IN ('ENROLLMENT', 'COURSE_CONSULTATION', 'TECHNICAL_SUPPORT', 'PARTNERSHIP', 'OTHER')),
        CONSTRAINT "CHK_contact_requests_status"
          CHECK ("status" IN ('NEW', 'CONTACTED', 'RESOLVED')),
        CONSTRAINT "PK_contact_requests" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_contact_requests_status_created_at"
      ON "contact_requests" ("status", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_contact_requests_status_created_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "contact_requests"`);
  }
}
