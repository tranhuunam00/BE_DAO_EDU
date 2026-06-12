import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTeacherAndCenter1781251488313 implements MigrationInterface {
    name = 'AddTeacherAndCenter1781251488313'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_role"`);
        await queryRunner.query(`ALTER TABLE "students" DROP CONSTRAINT "FK_students_user"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP CONSTRAINT "FK_teachers_user"`);
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_role_permissions_role"`);
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_role_permissions_permission"`);
        await queryRunner.query(`CREATE TABLE "centers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "center_id" character varying NOT NULL, "name" character varying NOT NULL, "phone" character varying, "email" character varying, "province" character varying, "district_ward" character varying, "primary_address" character varying, "manager_name" character varying, "status" character varying NOT NULL DEFAULT 'Active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_73663e819e3879604cb74d00cdd" UNIQUE ("center_id"), CONSTRAINT "PK_692e2318139b8148445f33c2880" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "students" DROP COLUMN "role_id"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP CONSTRAINT "UQ_teachers_employee_id"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "employee_id"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "subject"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "phone"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "address"`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "teacher_id" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD CONSTRAINT "UQ_8554ca4826231daa07720e5e0d5" UNIQUE ("teacher_id")`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "first_name" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "last_name" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "mobile" character varying`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "email" character varying`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "citizen_id" character varying`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "type" character varying NOT NULL DEFAULT 'Teacher'`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "country" character varying`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "province" character varying`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "district_ward" character varying`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "primary_address" character varying`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "status" character varying NOT NULL DEFAULT 'Active'`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "avatar" text`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "user_id" uuid`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD CONSTRAINT "UQ_4668d4752e6766682d1be0b346f" UNIQUE ("user_id")`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "students" ADD CONSTRAINT "UQ_fb3eff90b11bddf7285f9b4e281" UNIQUE ("user_id")`);
        await queryRunner.query(`ALTER TABLE "teachers" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "teachers" ALTER COLUMN "gender" SET NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_178199805b901ccd220ab7740e" ON "role_permissions"  ("role_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_17022daf3f885f7d35423e9971" ON "role_permissions"  ("permission_id") `);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "students" ADD CONSTRAINT "FK_fb3eff90b11bddf7285f9b4e281" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD CONSTRAINT "FK_4668d4752e6766682d1be0b346f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_178199805b901ccd220ab7740ec" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_17022daf3f885f7d35423e9971e" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_17022daf3f885f7d35423e9971e"`);
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_178199805b901ccd220ab7740ec"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP CONSTRAINT "FK_4668d4752e6766682d1be0b346f"`);
        await queryRunner.query(`ALTER TABLE "students" DROP CONSTRAINT "FK_fb3eff90b11bddf7285f9b4e281"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_17022daf3f885f7d35423e9971"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_178199805b901ccd220ab7740e"`);
        await queryRunner.query(`ALTER TABLE "teachers" ALTER COLUMN "gender" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "teachers" ALTER COLUMN "id" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "students" DROP CONSTRAINT "UQ_fb3eff90b11bddf7285f9b4e281"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP CONSTRAINT "UQ_4668d4752e6766682d1be0b346f"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "user_id"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "avatar"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "status"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "primary_address"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "district_ward"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "province"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "country"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "type"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "citizen_id"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "email"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "mobile"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "last_name"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "first_name"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP CONSTRAINT "UQ_8554ca4826231daa07720e5e0d5"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "teacher_id"`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "address" character varying`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "phone" character varying`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "subject" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "employee_id" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD CONSTRAINT "UQ_teachers_employee_id" UNIQUE ("employee_id")`);
        await queryRunner.query(`ALTER TABLE "students" ADD "role_id" uuid`);
        await queryRunner.query(`DROP TABLE "centers"`);
        await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_role_permissions_permission" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_role_permissions_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD CONSTRAINT "FK_teachers_user" FOREIGN KEY ("id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "students" ADD CONSTRAINT "FK_students_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_users_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
