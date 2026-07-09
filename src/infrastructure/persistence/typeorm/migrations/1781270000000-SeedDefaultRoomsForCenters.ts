import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDefaultRoomsForCenters1781270000000 implements MigrationInterface {
  name = 'SeedDefaultRoomsForCenters1781270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Seeding has been moved to seeds/dev.js for security and separation of concerns
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op
  }
}
