import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHolidays1781470000000 implements MigrationInterface {
  name = 'AddHolidays1781470000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "holidays" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "date" date NOT NULL,
        "name" varchar NOT NULL,
        "description" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_holidays_date" UNIQUE ("date"),
        CONSTRAINT "PK_holidays" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "holidays"`);
  }
}
