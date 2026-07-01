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

        // 2. Re-seed default roles
        const roleIds = {
            admin: '10000000-0000-4000-8000-000000000001',
            teacher: '10000000-0000-4000-8000-000000000002',
            student: '10000000-0000-4000-8000-000000000003',
        };

        await queryRunner.query(
            `
            INSERT INTO "roles" ("id", "name", "description")
            VALUES
              ($1, 'ADMIN', 'Quản trị hệ thống'),
              ($2, 'TEACHER', 'Giáo viên'),
              ($3, 'STUDENT', 'Học viên')
            `,
            [roleIds.admin, roleIds.teacher, roleIds.student]
        );

        // 3. Re-seed the single admin user
        const passwordHash = await bcrypt.hash('123456', 10);
        await queryRunner.query(
            `
            INSERT INTO "users" ("id", "email", "password_hash", "name", "role_id", "is_active")
            VALUES ($1, $2, $3, $4, $5, true)
            `,
            ['20000000-0000-4000-8000-000000000001', 'admin@dao.edu.vn', passwordHash, 'Đào EDU Admin', roleIds.admin]
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No-op for down since we don't want to restore truncated data
    }
}
