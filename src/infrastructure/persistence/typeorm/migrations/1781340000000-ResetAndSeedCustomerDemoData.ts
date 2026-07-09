import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcryptjs';

export class ResetAndSeedCustomerDemoData1781340000000 implements MigrationInterface {
  name = 'ResetAndSeedCustomerDemoData1781340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Seeding has been moved to seeds/dev.js for security and separation of concerns
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op
  }
}
