import { MigrationInterface, QueryRunner } from 'typeorm';

export class RestoreTimekeepingLogTimezone1786331100000 implements MigrationInterface {
  name = 'RestoreTimekeepingLogTimezone1786331100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Cộng lại 7 tiếng cho toàn bộ các log trong database để đưa chúng về múi giờ địa phương chuẩn
    await queryRunner.query(`
      UPDATE "timekeeping_log" 
      SET "event_time" = "event_time" + INTERVAL '7 hours'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Lùi lại 7 tiếng
    await queryRunner.query(`
      UPDATE "timekeeping_log" 
      SET "event_time" = "event_time" - INTERVAL '7 hours'
    `);
  }
}
