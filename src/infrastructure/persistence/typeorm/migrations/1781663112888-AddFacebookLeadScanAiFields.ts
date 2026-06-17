import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFacebookLeadScanAiFields1781663112888 implements MigrationInterface {
    name = 'AddFacebookLeadScanAiFields1781663112888'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "facebook_lead_scans" ADD "ai_analysis_status" character varying(30) NOT NULL DEFAULT 'PENDING'`);
        await queryRunner.query(`ALTER TABLE "facebook_lead_scans" ADD "ai_analysis_retry_count" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "facebook_lead_scans" ADD "ai_analysis_error" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "facebook_lead_scans" DROP COLUMN "ai_analysis_error"`);
        await queryRunner.query(`ALTER TABLE "facebook_lead_scans" DROP COLUMN "ai_analysis_retry_count"`);
        await queryRunner.query(`ALTER TABLE "facebook_lead_scans" DROP COLUMN "ai_analysis_status"`);
    }
}
