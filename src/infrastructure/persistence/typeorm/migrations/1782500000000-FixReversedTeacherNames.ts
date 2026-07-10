import { MigrationInterface, QueryRunner } from "typeorm";

export class FixReversedTeacherNames1782500000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Swap first_name and last_name for TCH- teachers in the database
        await queryRunner.query(`
            UPDATE "teachers"
            SET "first_name" = "last_name", "last_name" = "first_name"
            WHERE "teacher_id" LIKE 'TCH-%';
        `);

        // 2. Update associated users' names to match the corrected format (last_name first_name)
        await queryRunner.query(`
            UPDATE "users" u
            SET "name" = t.last_name || ' ' || t.first_name
            FROM "teachers" t
            WHERE t.user_id = u.id AND t.teacher_id LIKE 'TCH-%';
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "teachers"
            SET "first_name" = "last_name", "last_name" = "first_name"
            WHERE "teacher_id" LIKE 'TCH-%';
        `);

        await queryRunner.query(`
            UPDATE "users" u
            SET "name" = t.last_name || ' ' || t.first_name
            FROM "teachers" t
            WHERE t.user_id = u.id AND t.teacher_id LIKE 'TCH-%';
        `);
    }
}
