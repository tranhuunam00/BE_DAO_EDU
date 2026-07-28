import { MigrationInterface, QueryRunner } from 'typeorm';

// Pre-computed bcrypt hash for the default password '123456' (cost factor 10)
// Generated with: bcrypt.hashSync('123456', 10)
// Avoids importing bcryptjs at migration time which can fail under TypeORM CLI module resolution
const DEFAULT_PASSWORD_HASH =
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

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

    // Get all students that do NOT already have a user_id (skip already linked ones)
    const students = await queryRunner.query(
      `SELECT id, first_name, last_name, mobile, user_id FROM students WHERE user_id IS NULL`,
    );

    const passwordHash = DEFAULT_PASSWORD_HASH;

    // Track which user_ids have already been assigned in this migration run
    // to avoid assigning the same user to multiple students (duplicate phone case)
    const assignedUserIds = new Set<string>();

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

        // If this user is already linked to another student, skip this student
        if (assignedUserIds.has(userId)) {
          console.warn(
            `[Migration] Học sinh "${fullName}" (id=${student.id}) có SĐT "${normalizedMobile}" trùng với học sinh khác. Bỏ qua.`,
          );
          continue;
        }

        // Check if this user is already linked to a different student in DB
        const linkedStudents = await queryRunner.query(
          `SELECT id FROM students WHERE user_id = $1 AND id != $2`,
          [userId, student.id],
        );
        if (linkedStudents && linkedStudents.length > 0) {
          console.warn(
            `[Migration] User "${normalizedMobile}" (id=${userId}) đã được gán cho học sinh khác. Bỏ qua học sinh "${fullName}" (id=${student.id}).`,
          );
          continue;
        }

        // Update user password to 123456 and ensure correct role
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

      // Mark this userId as assigned in this migration run
      assignedUserIds.add(userId);

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
