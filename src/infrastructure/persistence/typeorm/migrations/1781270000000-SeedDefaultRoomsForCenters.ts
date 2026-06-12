import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDefaultRoomsForCenters1781270000000 implements MigrationInterface {
  name = 'SeedDefaultRoomsForCenters1781270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Select all centers
    const centers = await queryRunner.query(`SELECT id, name FROM "centers"`);
    
    for (const center of centers) {
      // Check if this center has any rooms
      const roomsCount = await queryRunner.query(
        `SELECT COUNT(*) FROM "rooms" WHERE "center_id" = $1`,
        [center.id]
      );
      
      const count = parseInt(roomsCount[0].count, 10);
      if (count === 0) {
        // Seed some default rooms
        await queryRunner.query(`
          INSERT INTO "rooms" ("center_id", "name", "capacity", "status")
          VALUES 
            ('${center.id}', 'Phòng Lab 101', 30, 'Active'),
            ('${center.id}', 'Phòng Lý thuyết 201', 40, 'Active'),
            ('${center.id}', 'Phòng VIP 301', 15, 'Active')
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op
  }
}
