import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcryptjs';

export class CreateStudentUserAccounts1785206790273
  implements MigrationInterface
{
  name = 'CreateStudentUserAccounts1785206790273';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get STUDENT role ID
    const roles = await queryRunner.query(
      `SELECT id FROM roles WHERE name = 'STUDENT'`,
    );
    if (!roles || roles.length === 0) {
      throw new Error("Role 'STUDENT' not found in roles table.");
    }
    const studentRoleId = roles[0].id;

    // Get all students
    const students = await queryRunner.query(
      `SELECT id, first_name, last_name, mobile, user_id FROM students`,
    );

    const passwordHash = await bcrypt.hash('123456', 10);

    for (const student of students) {
      const mobile = (student.mobile || '').trim();
      if (!mobile) {
        continue;
      }
      const normalizedMobile = mobile.toLowerCase();

      // Check if user with this mobile already exists
      const existingUsers = await queryRunner.query(
        `SELECT id FROM users WHERE LOWER(email) = $1`,
        [normalizedMobile],
      );

      let userId: string;
      const fullName = `${student.last_name || ''} ${student.first_name || ''}`.trim();

      if (existingUsers && existingUsers.length > 0) {
        userId = existingUsers[0].id;
        // Update user role and details to make sure it matches
        await queryRunner.query(
          `UPDATE users SET password_hash = $1, name = $2, role_id = $3 WHERE id = $4`,
          [passwordHash, fullName, studentRoleId, userId],
        );
      } else {
        // Create new user account
        const insertResult = await queryRunner.query(
          `INSERT INTO users (email, password_hash, name, role_id, is_active) VALUES ($1, $2, $3, $4, true) RETURNING id`,
          [normalizedMobile, passwordHash, fullName, studentRoleId],
        );
        userId = insertResult[0].id;
      }

      // Link student to user account
      await queryRunner.query(
        `UPDATE students SET user_id = $1 WHERE id = $2`,
        [userId, student.id],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverting user account creation is not safe as users might have logged in and updated their profiles.
  }
}
