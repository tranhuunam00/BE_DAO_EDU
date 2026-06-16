import { MigrationInterface, QueryRunner } from "typeorm";

export class ClearFacebookLeadScans1781598112253 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`TRUNCATE TABLE "facebook_lead_scans" CASCADE;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No down migration
    }

}
