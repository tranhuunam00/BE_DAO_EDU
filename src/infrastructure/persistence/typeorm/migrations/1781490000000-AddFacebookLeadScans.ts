import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFacebookLeadScans1781490000000
  implements MigrationInterface
{
  name = 'AddFacebookLeadScans1781490000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "facebook_lead_scans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "scan_session_id" varchar(120) NOT NULL,
        "source" varchar(80) NOT NULL,
        "group_url" text NOT NULL DEFAULT '',
        "post_url" text NOT NULL DEFAULT '',
        "post_id" varchar(80) NOT NULL DEFAULT '',
        "scanned_at" TIMESTAMP WITH TIME ZONE,
        "exported_at" TIMESTAMP WITH TIME ZONE,
        "item_count" integer NOT NULL DEFAULT 0,
        "accepted_items" integer NOT NULL DEFAULT 0,
        "duplicate_items" integer NOT NULL DEFAULT 0,
        "meta" jsonb,
        "local_analysis" jsonb,
        "detection" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_facebook_lead_scans" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_facebook_lead_scans_session" UNIQUE ("scan_session_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_facebook_lead_scans_created_at"
      ON "facebook_lead_scans" ("created_at")
    `);

    await queryRunner.query(`
      CREATE TABLE "facebook_lead_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "scan_id" uuid NOT NULL,
        "fingerprint" varchar(120) NOT NULL,
        "parser_version" integer,
        "kind" varchar(20) NOT NULL,
        "source" varchar(80) NOT NULL DEFAULT '',
        "group_url" text NOT NULL DEFAULT '',
        "page_url" text NOT NULL DEFAULT '',
        "source_url" text NOT NULL DEFAULT '',
        "parent_fingerprint" varchar(120),
        "post_id" varchar(80) NOT NULL DEFAULT '',
        "comment_id" varchar(120),
        "parent_comment_id" varchar(120),
        "depth" integer NOT NULL DEFAULT 0,
        "tree_path" text NOT NULL DEFAULT '',
        "context_texts" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "reply_to_author" varchar(160) NOT NULL DEFAULT '',
        "author_name" varchar(160) NOT NULL DEFAULT '',
        "author_url" text NOT NULL DEFAULT '',
        "text" text NOT NULL DEFAULT '',
        "captured_at" TIMESTAMP WITH TIME ZONE,
        "last_seen_at" TIMESTAMP WITH TIME ZONE,
        "raw" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_facebook_lead_items" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_facebook_lead_items_fingerprint" UNIQUE ("fingerprint"),
        CONSTRAINT "FK_facebook_lead_items_scan"
          FOREIGN KEY ("scan_id") REFERENCES "facebook_lead_scans"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_facebook_lead_items_scan_id"
      ON "facebook_lead_items" ("scan_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_facebook_lead_items_post_id"
      ON "facebook_lead_items" ("post_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_facebook_lead_items_post_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_facebook_lead_items_scan_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "facebook_lead_items"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_facebook_lead_scans_created_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "facebook_lead_scans"`);
  }
}
