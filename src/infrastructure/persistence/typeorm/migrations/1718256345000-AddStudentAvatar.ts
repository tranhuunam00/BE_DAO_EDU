import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudentAvatar1718256345000 implements MigrationInterface {
  name = 'AddStudentAvatar1718256345000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "students" ADD COLUMN "avatar" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "students" DROP COLUMN "avatar"
    `);
  }
}
