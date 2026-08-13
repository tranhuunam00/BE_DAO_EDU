import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixTimekeepingLogTimezone1786331000000 implements MigrationInterface {
  name = 'FixTimekeepingLogTimezone1786331000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Dịch chuyển lùi 7 tiếng cho toàn bộ các log cũ trong database để chuyển chúng về múi giờ UTC thực tế
    await queryRunner.query(`
      UPDATE "timekeeping_log" 
      SET "event_time" = "event_time" - INTERVAL '7 hours'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Khôi phục lại cộng thêm 7 tiếng
    await queryRunner.query(`
      UPDATE "timekeeping_log" 
      SET "event_time" = "event_time" + INTERVAL '7 hours'
    `);
  }
}
