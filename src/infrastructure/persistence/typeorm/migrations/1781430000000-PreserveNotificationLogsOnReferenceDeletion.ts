import { MigrationInterface, QueryRunner } from 'typeorm';

export class PreserveNotificationLogsOnReferenceDeletion1781430000000
  implements MigrationInterface
{
  name = 'PreserveNotificationLogsOnReferenceDeletion1781430000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notification_logs"
      DROP CONSTRAINT "FK_notification_logs_user"
    `);
    await queryRunner.query(`
      ALTER TABLE "notification_logs"
      ALTER COLUMN "user_id" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "notification_logs"
      ADD CONSTRAINT "FK_notification_logs_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_notification_log_mutation()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'UPDATE'
          AND NEW.event_type = OLD.event_type
          AND NEW.notification_type = OLD.notification_type
          AND NEW.title = OLD.title
          AND NEW.metadata = OLD.metadata
          AND NEW.created_at = OLD.created_at
          AND (NEW.notification_id = OLD.notification_id OR NEW.notification_id IS NULL)
          AND (NEW.user_id = OLD.user_id OR NEW.user_id IS NULL)
        THEN
          RETURN NEW;
        END IF;

        RAISE EXCEPTION 'notification_logs is append-only';
      END;
      $$ LANGUAGE plpgsql
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "TR_notification_logs_append_only"
      ON "notification_logs"
    `);
    await queryRunner.query(`
      DELETE FROM "notification_logs" WHERE "user_id" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "notification_logs"
      DROP CONSTRAINT "FK_notification_logs_user"
    `);
    await queryRunner.query(`
      ALTER TABLE "notification_logs"
      ALTER COLUMN "user_id" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "notification_logs"
      ADD CONSTRAINT "FK_notification_logs_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
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
}
