import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixNotificationLogsEventTypeConstraint1782800000000
  implements MigrationInterface
{
  name = 'FixNotificationLogsEventTypeConstraint1782800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notification_logs"
      DROP CONSTRAINT IF EXISTS "CK_notification_logs_event"
    `);

    await queryRunner.query(`
      ALTER TABLE "notification_logs"
      ALTER COLUMN "user_id" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notification_logs"
      ADD CONSTRAINT "CK_notification_logs_event"
      CHECK ("event_type" IN ('CREATED', 'READ', 'UNREAD', 'ARCHIVED'))
    `);
  }
}
