import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLeadLevelAndScoreToLeads1781667000000 implements MigrationInterface {
    name = 'AddLeadLevelAndScoreToLeads1781667000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add columns with defaults
        await queryRunner.query(`ALTER TABLE "leads" ADD "lead_level" character varying(50) NOT NULL DEFAULT 'NONE'`);
        await queryRunner.query(`ALTER TABLE "leads" ADD "lead_score" integer NOT NULL DEFAULT 0`);

        // Create indexes for fast filtering
        await queryRunner.query(`CREATE INDEX "IDX_leads_lead_level" ON "leads" ("lead_level")`);
        await queryRunner.query(`CREATE INDEX "IDX_leads_lead_score" ON "leads" ("lead_score")`);

        // Backfill existing leads from their latest demand (in case there is data)
        await queryRunner.query(`
            UPDATE leads l
            SET 
              lead_level = d.lead_level,
              lead_score = d.lead_score
            FROM (
              SELECT DISTINCT ON (lead_id) lead_id, lead_level, lead_score
              FROM lead_demands
              ORDER BY lead_id, created_at DESC
            ) d
            WHERE l.id = d.lead_id
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX "IDX_leads_lead_score"`);
        await queryRunner.query(`DROP INDEX "IDX_leads_lead_level"`);

        // Drop columns
        await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "lead_score"`);
        await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "lead_level"`);
    }
}
