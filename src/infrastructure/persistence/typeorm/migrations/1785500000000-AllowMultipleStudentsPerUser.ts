import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowMultipleStudentsPerUser1785500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop the unique constraint on user_id in students table
    await queryRunner.query(
      `ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "UQ_fb3eff90b11bddf7285f9b4e281"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add it back in down migration
    await queryRunner.query(
      `ALTER TABLE "students" ADD CONSTRAINT "UQ_fb3eff90b11bddf7285f9b4e281" UNIQUE ("user_id")`
    );
  }
}
