import { MigrationInterface, QueryRunner } from "typeorm";
import * as bcrypt from 'bcryptjs';

export class ClearAllDataExceptAdmin1781668000000 implements MigrationInterface {
    name = 'ClearAllDataExceptAdmin1781668000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Truncate all tables in the public schema except migrations and typeorm_metadata
        await queryRunner.query(`
            DO $$ 
            DECLARE 
              r RECORD;
            BEGIN
              FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('migrations', 'typeorm_metadata')) LOOP
                EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
              END LOOP;
            END $$;
        `);

    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No-op for down since we don't want to restore truncated data
    }
}
