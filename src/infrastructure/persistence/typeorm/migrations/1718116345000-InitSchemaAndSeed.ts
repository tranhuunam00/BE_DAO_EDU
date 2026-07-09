import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcryptjs';

export class InitSchemaAndSeed1718116345000 implements MigrationInterface {
  name = 'InitSchemaAndSeed1718116345000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create permissions table
    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "description" character varying,
        CONSTRAINT "UQ_permissions_name" UNIQUE ("name"),
        CONSTRAINT "PK_permissions_id" PRIMARY KEY ("id")
      )
    `);

    // 2. Create roles table
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "description" character varying,
        CONSTRAINT "UQ_roles_name" UNIQUE ("name"),
        CONSTRAINT "PK_roles_id" PRIMARY KEY ("id")
      )
    `);

    // 3. Create role_permissions table
    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "role_id" uuid NOT NULL,
        "permission_id" uuid NOT NULL,
        CONSTRAINT "PK_role_permissions" PRIMARY KEY ("role_id", "permission_id"),
        CONSTRAINT "FK_role_permissions_role" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_role_permissions_permission" FOREIGN KEY ("permission_id") REFERENCES "permissions" ("id") ON DELETE CASCADE
      )
    `);

    // 4. Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "name" character varying NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "role_id" uuid,
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_users_role" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE SET NULL
      )
    `);

    // 5. Create teachers table
    await queryRunner.query(`
      CREATE TABLE "teachers" (
        "id" uuid NOT NULL,
        "employee_id" character varying NOT NULL,
        "subject" character varying NOT NULL,
        "phone" character varying,
        "gender" character varying,
        "birthdate" date,
        "address" character varying,
        CONSTRAINT "UQ_teachers_employee_id" UNIQUE ("employee_id"),
        CONSTRAINT "PK_teachers_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_teachers_user" FOREIGN KEY ("id") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);

    // 6. Create students table
    await queryRunner.query(`
      CREATE TABLE "students" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "student_id" character varying NOT NULL,
        "first_name" character varying NOT NULL,
        "last_name" character varying NOT NULL,
        "nick_name" character varying,
        "gender" character varying NOT NULL,
        "mobile" character varying NOT NULL,
        "email" character varying,
        "birthdate" date NOT NULL,
        "parent_guardian_1" character varying,
        "parent_guardian_2" character varying,
        "parent_1_citizen_id" character varying,
        "parent_2_citizen_id" character varying,
        "student_citizen_id" character varying,
        "relationship_1" character varying,
        "relationship_2" character varying,
        "other_phone_1" character varying,
        "other_phone_2" character varying,
        "description" text,
        "country" character varying,
        "province" character varying,
        "district_ward" character varying,
        "primary_address" character varying NOT NULL,
        "old_address" character varying,
        "status" character varying NOT NULL DEFAULT 'Waiting for class',
        "user_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "role_id" uuid,
        CONSTRAINT "UQ_students_student_id" UNIQUE ("student_id"),
        CONSTRAINT "PK_students_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_students_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);

    // 7. Seed Initial Roles
    const [adminRole] = await queryRunner.query(`
      INSERT INTO "roles" ("name", "description") 
      VALUES ('ADMIN', 'Default role for ADMIN') 
      RETURNING "id"
    `);
    const [teacherRole] = await queryRunner.query(`
      INSERT INTO "roles" ("name", "description") 
      VALUES ('TEACHER', 'Default role for TEACHER') 
      RETURNING "id"
    `);
    const [studentRole] = await queryRunner.query(`
      INSERT INTO "roles" ("name", "description") 
      VALUES ('STUDENT', 'Default role for STUDENT') 
      RETURNING "id"
    `);

  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "students"`);
    await queryRunner.query(`DROP TABLE "teachers"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "role_permissions"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP TABLE "permissions"`);
  }
}
