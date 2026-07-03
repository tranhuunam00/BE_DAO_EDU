import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssistantIdToClasses1782300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "classes" ADD COLUMN "assistant_id" UUID NULL;
      ALTER TABLE "classes" ADD CONSTRAINT "FK_classes_assistant" FOREIGN KEY ("assistant_id") REFERENCES "teachers"("id") ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "classes" DROP CONSTRAINT "FK_classes_assistant";
      ALTER TABLE "classes" DROP COLUMN "assistant_id";
    `);
  }
}
