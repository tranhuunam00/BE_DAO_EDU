import { MigrationInterface, QueryRunner } from 'typeorm';

// Pre-computed bcrypt hash for 'educare123' (cost factor 10)
// Verified: node -e "require('bcryptjs').hash('educare123',10).then(console.log)"
// Hard-coded to avoid bcryptjs import issue under TypeORM CLI ts-node context
const DEFAULT_PASSWORD_HASH =
  '$2b$10$o2lBYhA0wjUKqhlanbEX9Olu0InW.SwR9onur4pexiTNkMd6Dh77W';

export class ResetPasswordsAndCreateTeacherAccounts1785300000000
  implements MigrationInterface
{
  name = 'ResetPasswordsAndCreateTeacherAccounts1785300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─────────────────────────────────────────────────────────────
    // 1. ĐỔI MẬT KHẨU TẤT CẢ HỌC SINH thành 'educare123'
    //    (chỉ update user có role STUDENT)
    // ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      UPDATE "users"
      SET "password_hash" = '${DEFAULT_PASSWORD_HASH}'
      WHERE "role_id" = (SELECT id FROM "roles" WHERE name = 'STUDENT')
    `);

    // ─────────────────────────────────────────────────────────────
    // 2. RÀ SOÁT GIÁO VIÊN & TA chưa có tài khoản đăng nhập
    //    Tạo tài khoản: ưu tiên email, fallback sang mobile
    //    Mật khẩu mặc định: 'educare123'
    // ─────────────────────────────────────────────────────────────
    const teacherRoleRow = await queryRunner.query(
      `SELECT id FROM "roles" WHERE name = 'TEACHER'`,
    );
    if (!teacherRoleRow || teacherRoleRow.length === 0) {
      throw new Error("Role 'TEACHER' not found in roles table.");
    }
    const teacherRoleId = teacherRoleRow[0].id;

    // Lấy tất cả giáo viên / TA chưa có user_id
    const unlinkedTeachers = await queryRunner.query(`
      SELECT id, first_name, last_name, mobile, email, type
      FROM "teachers"
      WHERE user_id IS NULL
    `);

    // Track assigned user_ids to avoid duplicates within this run
    const assignedUserIds = new Set<string>();

    for (const teacher of unlinkedTeachers) {
      const fullName =
        `${teacher.last_name || ''} ${teacher.first_name || ''}`.trim();

      // Ưu tiên email, nếu không có thì dùng mobile
      const emailRaw = (teacher.email || '').trim();
      const mobileRaw = (teacher.mobile || '').trim();
      const loginUsername = emailRaw || mobileRaw;

      if (!loginUsername) {
        console.warn(
          `[Migration] Giáo viên "${fullName}" (id=${teacher.id}) không có email lẫn SĐT. Bỏ qua.`,
        );
        continue;
      }

      const normalizedUsername = loginUsername.toLowerCase();

      // Kiểm tra user đã tồn tại với username này chưa
      const existingUsers = await queryRunner.query(
        `SELECT id FROM "users" WHERE LOWER(email) = $1`,
        [normalizedUsername],
      );

      let userId: string;

      if (existingUsers && existingUsers.length > 0) {
        userId = existingUsers[0].id;

        // Nếu user này đã được gán cho giáo viên / học sinh khác → bỏ qua
        if (assignedUserIds.has(userId)) {
          console.warn(
            `[Migration] Username "${normalizedUsername}" đã được gán trong run này. Bỏ qua "${fullName}" (id=${teacher.id}).`,
          );
          continue;
        }

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

        // Cập nhật password về educare123 và đảm bảo role đúng
        await queryRunner.query(
          `UPDATE "users" SET password_hash = $1, name = $2, role_id = $3 WHERE id = $4`,
          [DEFAULT_PASSWORD_HASH, fullName, teacherRoleId, userId],
        );
      } else {
        // Tạo user mới
        const insertResult = await queryRunner.query(
          `INSERT INTO "users" (email, password_hash, name, role_id, is_active)
           VALUES ($1, $2, $3, $4, true) RETURNING id`,
          [normalizedUsername, DEFAULT_PASSWORD_HASH, fullName, teacherRoleId],
        );
        userId = insertResult[0].id;
      }

      assignedUserIds.add(userId);

      // Liên kết giáo viên với tài khoản vừa tạo/tìm
      await queryRunner.query(
        `UPDATE "teachers" SET user_id = $1 WHERE id = $2`,
        [userId, teacher.id],
      );

      console.log(
        `[Migration] Đã tạo/liên kết tài khoản "${normalizedUsername}" cho ${teacher.type} "${fullName}" (id=${teacher.id}).`,
      );
    }

    // ─────────────────────────────────────────────────────────────
    // 3. ĐỔI MẬT KHẨU TẤT CẢ GIÁO VIÊN / TA đã có tài khoản
    //    thành 'educare123' (chỉ update user có role TEACHER)
    // ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      UPDATE "users"
      SET "password_hash" = '${DEFAULT_PASSWORD_HASH}'
      WHERE "role_id" = (SELECT id FROM "roles" WHERE name = 'TEACHER')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Không thể khôi phục mật khẩu an toàn vì hash 1 chiều.
    // Admin cần reset thủ công nếu cần revert.
  }
}
