import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateLeadCrmTables1781664000000 implements MigrationInterface {
    name = 'CreateLeadCrmTables1781664000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create leads table
        await queryRunner.query(`
            CREATE TABLE "leads" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "platform" character varying(50) NOT NULL DEFAULT 'facebook',
                "profile_key" character varying(255) NOT NULL,
                "author_name" character varying(255) NOT NULL,
                "author_url" text NOT NULL,
                "contact_status" character varying(50) NOT NULL DEFAULT 'NEW',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_leads" PRIMARY KEY ("id")
            )
        `);

        // Create lead_demands table
        await queryRunner.query(`
            CREATE TABLE "lead_demands" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "lead_id" uuid NOT NULL,
                "platform" character varying(50) NOT NULL,
                "scan_id" uuid,
                "post_id" character varying(255) NOT NULL,
                "post_url" text NOT NULL,
                "classification" character varying(100) NOT NULL,
                "lead_score" integer NOT NULL,
                "lead_level" character varying(50) NOT NULL,
                "reasons" jsonb NOT NULL DEFAULT '[]'::jsonb,
                "evidence" jsonb NOT NULL DEFAULT '[]'::jsonb,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_lead_demands" PRIMARY KEY ("id")
            )
        `);

        // Create lead_interactions table
        await queryRunner.query(`
            CREATE TABLE "lead_interactions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "lead_id" uuid NOT NULL,
                "actor_id" uuid,
                "action_type" character varying(50) NOT NULL DEFAULT 'NOTE',
                "status_from" character varying(50),
                "status_to" character varying(50),
                "notes" text NOT NULL DEFAULT '',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_lead_interactions" PRIMARY KEY ("id")
            )
        `);

        // Add foreign keys
        await queryRunner.query(`
            ALTER TABLE "lead_demands" 
            ADD CONSTRAINT "FK_lead_demands_leads" 
            FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE
        `);
        
        await queryRunner.query(`
            ALTER TABLE "lead_demands" 
            ADD CONSTRAINT "FK_lead_demands_scans" 
            FOREIGN KEY ("scan_id") REFERENCES "facebook_lead_scans"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "lead_interactions" 
            ADD CONSTRAINT "FK_lead_interactions_leads" 
            FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "lead_interactions" 
            ADD CONSTRAINT "FK_lead_interactions_users" 
            FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL
        `);

        // Create indexes
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_leads_platform_profile_key" ON "leads" ("platform", "profile_key")`);
        await queryRunner.query(`CREATE INDEX "IDX_leads_contact_status" ON "leads" ("contact_status")`);
        await queryRunner.query(`CREATE INDEX "IDX_leads_created_at" ON "leads" ("created_at")`);
        await queryRunner.query(`CREATE INDEX "IDX_lead_demands_lead_id" ON "lead_demands" ("lead_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_lead_demands_created_at" ON "lead_demands" ("created_at")`);
        await queryRunner.query(`CREATE INDEX "IDX_lead_interactions_lead_id" ON "lead_interactions" ("lead_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_lead_interactions_created_at" ON "lead_interactions" ("created_at")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX "IDX_lead_interactions_created_at"`);
        await queryRunner.query(`DROP INDEX "IDX_lead_interactions_lead_id"`);
        await queryRunner.query(`DROP INDEX "IDX_lead_demands_created_at"`);
        await queryRunner.query(`DROP INDEX "IDX_lead_demands_lead_id"`);
        await queryRunner.query(`DROP INDEX "IDX_leads_created_at"`);
        await queryRunner.query(`DROP INDEX "IDX_leads_contact_status"`);
        await queryRunner.query(`DROP INDEX "IDX_leads_platform_profile_key"`);

        // Drop foreign keys
        await queryRunner.query(`ALTER TABLE "lead_interactions" DROP CONSTRAINT "FK_lead_interactions_users"`);
        await queryRunner.query(`ALTER TABLE "lead_interactions" DROP CONSTRAINT "FK_lead_interactions_leads"`);
        await queryRunner.query(`ALTER TABLE "lead_demands" DROP CONSTRAINT "FK_lead_demands_scans"`);
        await queryRunner.query(`ALTER TABLE "lead_demands" DROP CONSTRAINT "FK_lead_demands_leads"`);

        // Drop tables
        await queryRunner.query(`DROP TABLE "lead_interactions"`);
        await queryRunner.query(`DROP TABLE "lead_demands"`);
        await queryRunner.query(`DROP TABLE "leads"`);
    }
}
