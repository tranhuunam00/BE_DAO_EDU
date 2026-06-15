import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceNotificationsAndAddLogs1781410000000
  implements MigrationInterface
{
  name = 'EnhanceNotificationsAndAddLogs1781410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications"
      ADD COLUMN "priority" varchar NOT NULL DEFAULT 'normal',
      ADD COLUMN "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN "archived_at" TIMESTAMPTZ,
      ADD CONSTRAINT "CK_notifications_priority"
        CHECK ("priority" IN ('normal', 'important', 'urgent'))
    `);
    await queryRunner.query(`
      CREATE TABLE "notification_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "notification_id" uuid,
        "user_id" uuid NOT NULL,
        "event_type" varchar NOT NULL,
        "notification_type" varchar NOT NULL,
        "title" varchar NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notification_logs_notification"
          FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_notification_logs_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CK_notification_logs_event"
          CHECK ("event_type" IN ('CREATED', 'READ', 'UNREAD', 'ARCHIVED'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_logs_created" ON "notification_logs" ("created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_logs_user_event" ON "notification_logs" ("user_id", "event_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_archived_created" ON "notifications" ("user_id", "archived_at", "created_at" DESC)`,
    );
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION log_notification_event()
      RETURNS TRIGGER AS $$
      DECLARE
        event_name varchar;
      BEGIN
        IF TG_OP = 'INSERT' THEN
          event_name := 'CREATED';
        ELSIF OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN
          event_name := 'ARCHIVED';
        ELSIF OLD.read_at IS NULL AND NEW.read_at IS NOT NULL THEN
          event_name := 'READ';
        ELSIF OLD.read_at IS NOT NULL AND NEW.read_at IS NULL THEN
          event_name := 'UNREAD';
        ELSE
          RETURN NEW;
        END IF;

        INSERT INTO notification_logs (
          notification_id,
          user_id,
          event_type,
          notification_type,
          title,
          metadata
        ) VALUES (
          NEW.id,
          NEW.user_id,
          event_name,
          NEW.type,
          NEW.title,
          jsonb_build_object(
            'priority', NEW.priority,
            'linkPath', NEW.link_path,
            'sourceMetadata', NEW.metadata
          )
        );
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TR_notification_audit"
      AFTER INSERT OR UPDATE ON "notifications"
      FOR EACH ROW EXECUTE FUNCTION log_notification_event()
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_notification_log_mutation()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'notification_logs is append-only';
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TR_notification_logs_append_only"
      BEFORE UPDATE OR DELETE ON "notification_logs"
      FOR EACH ROW EXECUTE FUNCTION prevent_notification_log_mutation()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TR_notification_logs_append_only" ON "notification_logs"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS prevent_notification_log_mutation`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TR_notification_audit" ON "notifications"`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS log_notification_event`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_logs"`);
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "CK_notifications_priority"`,
    );
    await queryRunner.query(`
      ALTER TABLE "notifications"
      DROP COLUMN IF EXISTS "archived_at",
      DROP COLUMN IF EXISTS "metadata",
      DROP COLUMN IF EXISTS "priority"
    `);
  }
}
