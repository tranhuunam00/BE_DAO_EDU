import { MigrationInterface, QueryRunner } from 'typeorm';

// Pre-computed bcrypt hash for 'educare123' (cost factor 10)
// Verified: node -e "require('bcryptjs').hash('educare123',10).then(console.log)"
const DEFAULT_PASSWORD_HASH =
  '$2b$10$o2lBYhA0wjUKqhlanbEX9Olu0InW.SwR9onur4pexiTNkMd6Dh77W';

export class FixTeacherAndTaAccounts1785400000000
  implements MigrationInterface
{
  name = 'FixTeacherAndTaAccounts1785400000000';

  private normalizeUsername(username: string): string {
    const trimmed = username.trim().toLowerCase();
    if (trimmed.includes('@')) {
      return trimmed;
    }
    // Strip all non-digit characters for phone numbers
    return trimmed.replace(/\D/g, '');
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Get TEACHER role ID
    const roles = await queryRunner.query(
      `SELECT id FROM "roles" WHERE name = 'TEACHER'`,
    );
    if (!roles || roles.length === 0) {
      throw new Error("Role 'TEACHER' not found in roles table.");
    }
    const teacherRoleId = roles[0].id;

    // 2. Get all teachers/TAs
    const teachers = await queryRunner.query(
      `SELECT id, first_name, last_name, mobile, email, type, user_id FROM "teachers"`,
    );

    const assignedUserIds = new Set<string>();

    for (const teacher of teachers) {
      const fullName =
        `${teacher.last_name || ''} ${teacher.first_name || ''}`.trim();

      const emailRaw = (teacher.email || '').trim();
      const mobileRaw = (teacher.mobile || '').trim();
      const loginUsername = emailRaw || mobileRaw;

      if (!loginUsername) {
        console.warn(
          `[Migration] Giáo viên/TA "${fullName}" (id=${teacher.id}) không có email lẫn SĐT. Bỏ qua.`,
        );
        continue;
      }

      const normalizedUsername = this.normalizeUsername(loginUsername);
      let userId = teacher.user_id;
      let userExists = false;

      if (userId) {
        const checkUser = await queryRunner.query(
          `SELECT id FROM "users" WHERE id = $1`,
          [userId],
        );
        if (checkUser && checkUser.length > 0) {
          userExists = true;
        }
      }

      if (!userExists) {
        // Find if user with this normalized email/phone already exists in users table
        const existingUsers = await queryRunner.query(
          `SELECT id FROM "users" WHERE LOWER(email) = $1`,
          [normalizedUsername],
        );

        if (existingUsers && existingUsers.length > 0) {
          userId = existingUsers[0].id;

          // If this user is already linked to another teacher/student, skip linking it
          const linkedTeachers = await queryRunner.query(
            `SELECT id FROM "teachers" WHERE user_id = $1 AND id != $2`,
            [userId, teacher.id],
          );
          if (linkedTeachers && linkedTeachers.length > 0) {
            console.warn(
              `[Migration] User "${normalizedUsername}" đã được gán cho giáo viên khác. Bỏ qua "${fullName}" (id=${teacher.id}).`,
            );
            continue;
          }
          
          // Update password and details
          await queryRunner.query(
            `UPDATE "users" SET password_hash = $1, name = $2, role_id = $3 WHERE id = $4`,
            [DEFAULT_PASSWORD_HASH, fullName, teacherRoleId, userId],
          );
        } else {
          // Create a new user account
          const insertResult = await queryRunner.query(
            `INSERT INTO "users" (email, password_hash, name, role_id, is_active)
             VALUES ($1, $2, $3, $4, true) RETURNING id`,
            [
              normalizedUsername,
              DEFAULT_PASSWORD_HASH,
              fullName,
              teacherRoleId,
            ],
          );
          userId = insertResult[0].id;
        }

        // Link teacher to user account
        await queryRunner.query(
          `UPDATE "teachers" SET user_id = $1 WHERE id = $2`,
          [userId, teacher.id],
        );
      } else {
        // User exists and is linked, update their password and name/role
        await queryRunner.query(
          `UPDATE "users" SET password_hash = $1, name = $2, role_id = $3 WHERE id = $4`,
          [DEFAULT_PASSWORD_HASH, fullName, teacherRoleId, userId],
        );
      }

      assignedUserIds.add(userId);
    }

    // 3. Set password for all users linked to students
    await queryRunner.query(`
      UPDATE "users"
      SET "password_hash" = '${DEFAULT_PASSWORD_HASH}'
      WHERE "id" IN (SELECT "user_id" FROM "students" WHERE "user_id" IS NOT NULL)
    `);

    // 4. Set password for all users linked to teachers
    await queryRunner.query(`
      UPDATE "users"
      SET "password_hash" = '${DEFAULT_PASSWORD_HASH}'
      WHERE "id" IN (SELECT "user_id" FROM "teachers" WHERE "user_id" IS NOT NULL)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverting is not safe as passwords are one-way hashed.
  }
}
