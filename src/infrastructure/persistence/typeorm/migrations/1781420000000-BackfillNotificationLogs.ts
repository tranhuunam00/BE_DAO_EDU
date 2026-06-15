import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillNotificationLogs1781420000000
  implements MigrationInterface
{
  name = 'BackfillNotificationLogs1781420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "notification_logs" (
        "notification_id",
        "user_id",
        "event_type",
        "notification_type",
        "title",
        "metadata",
        "created_at"
      )
      SELECT
        notification.id,
        notification.user_id,
        'CREATED',
        notification.type,
        notification.title,
        jsonb_build_object(
          'priority', notification.priority,
          'linkPath', notification.link_path,
          'sourceMetadata', notification.metadata,
          'backfilled', true
        ),
        notification.created_at
      FROM "notifications" notification
      WHERE NOT EXISTS (
        SELECT 1
        FROM "notification_logs" log
        WHERE log.notification_id = notification.id
          AND log.event_type = 'CREATED'
      )
    `);
  }

  public async down(): Promise<void> {
    // Audit records are intentionally immutable and are not removed on rollback.
  }
}
