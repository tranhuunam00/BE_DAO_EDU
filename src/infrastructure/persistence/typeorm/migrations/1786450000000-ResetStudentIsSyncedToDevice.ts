import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResetStudentIsSyncedToDevice1786450000000 implements MigrationInterface {
  name = 'ResetStudentIsSyncedToDevice1786450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "students" SET "is_synced_to_device" = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert is not required as it only resets synchronization state
  }
}
