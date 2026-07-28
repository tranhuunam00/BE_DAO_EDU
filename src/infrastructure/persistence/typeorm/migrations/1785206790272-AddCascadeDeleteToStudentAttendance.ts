import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCascadeDeleteToStudentAttendance1785206790272 implements MigrationInterface {
    name = 'AddCascadeDeleteToStudentAttendance1785206790272'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the existing foreign key constraint if it exists (checking both potential names)
        await queryRunner.query(`ALTER TABLE "student_attendance" DROP CONSTRAINT IF EXISTS "FK_student_attendance_session"`);
        await queryRunner.query(`ALTER TABLE "student_attendance" DROP CONSTRAINT IF EXISTS "FK_63e04eecf9e09f077deaae3a5d5"`);
        
        // Add the constraint with ON DELETE CASCADE
        await queryRunner.query(`ALTER TABLE "student_attendance" ADD CONSTRAINT "FK_63e04eecf9e09f077deaae3a5d5" FOREIGN KEY ("class_session_id") REFERENCES "class_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert constraint back to standard NO ACTION
        await queryRunner.query(`ALTER TABLE "student_attendance" DROP CONSTRAINT IF EXISTS "FK_63e04eecf9e09f077deaae3a5d5"`);
        await queryRunner.query(`ALTER TABLE "student_attendance" ADD CONSTRAINT "FK_student_attendance_session" FOREIGN KEY ("class_session_id") REFERENCES "class_sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }
}
