const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Load environment variables manually
let envFile = '.env';
if (fs.existsSync(path.join(__dirname, '../.env.production'))) {
  envFile = '.env.production';
  console.log('Phát hiện file .env.production. Đang tải cấu hình từ .env.production...');
} else {
  console.log('Đang tải cấu hình từ .env...');
}
const envPath = path.join(__dirname, '../', envFile);
if (!fs.existsSync(envPath)) {
  console.error('Error: Environment file not found at ' + envPath + '. Please create it first.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const cleanLine = line.trim();
  if (cleanLine && !cleanLine.startsWith('#') && cleanLine.includes('=')) {
    const parts = cleanLine.split('=');
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const email = process.argv[2];
const password = process.argv[3];
const name = process.argv[4] || 'DAO EDU Admin';

if (!email || !password) {
  console.log('\n--- KHỞI TẠO TÀI KHOẢN ADMIN PRODUCTION ---');
  console.log('Cách dùng: npm run db:seed:prod -- <email> <password> [name]');
  console.log('Ví dụ  : npm run db:seed:prod -- admin@daogroup.com MyPassword2026 "DAO Admin"');
  process.exit(1);
}

const client = new Client({
  host: env.DATABASE_HOST || '127.0.0.1',
  port: parseInt(env.DATABASE_PORT || '5435', 10),
  user: env.DATABASE_USER || 'dao_edu_admin',
  password: env.DATABASE_PASSWORD,
  database: env.DATABASE_NAME || 'dao_edu_db',
});

async function main() {
  console.log('Đang kết nối tới cơ sở dữ liệu để khởi tạo Admin Production...');
  try {
    await client.connect();
    console.log('Đã kết nối thành công.');
  } catch (err) {
    console.error('Không thể kết nối cơ sở dữ liệu:', err.message);
    process.exit(1);
  }

  try {
    // 1. Clear all demo/other tables to ensure empty DB
    console.log('Đang xóa sạch dữ liệu mẫu (demo data) trong các bảng...');
    const tablesToTruncate = [
      'student_attendance', 'student_monthly_bill_items', 'student_monthly_bills', 
      'teacher_monthly_wage_items', 'teacher_monthly_wages', 'tuition_payment_logs', 
      'tuition_payment_requests', 'class_students', 'class_schedules', 'class_sessions', 'classes', 
      'course_level_pricing', 'course_levels', 'courses', 'rooms', 'centers', 
      'teachers', 'students', 'audit_logs', 'billing_audit_logs', 'notifications', 
      'vietqr_callback_logs', 'leave_requests', 'holidays', 'contact_requests', 
      'facebook_lead_scans', 'leads', 'study_materials'
    ];

    for (const table of tablesToTruncate) {
      await client.query(`TRUNCATE TABLE "${table}" CASCADE;`).catch(e => {
        // Table might not exist yet
      });
    }

    // Delete all users except the seed admin slot
    await client.query(`DELETE FROM "users" WHERE "id" != '20000000-0000-4000-8000-000000000001';`);

    // 2. Encrypt the password
    console.log('Đang băm mật khẩu bảo mật (Bcrypt)...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. Upsert default ADMIN role
    const adminRoleId = '10000000-0000-4000-8000-000000000001';
    await client.query(`
      INSERT INTO "roles" ("id", "name", "description")
      VALUES ($1, 'ADMIN', 'Quản trị hệ thống')
      ON CONFLICT ("id") DO UPDATE SET "name" = 'ADMIN';
    `, [adminRoleId]);

    // Upsert other roles just in case
    await client.query(`
      INSERT INTO "roles" ("id", "name", "description")
      VALUES 
        ('10000000-0000-4000-8000-000000000002', 'TEACHER', 'Giáo viên'),
        ('10000000-0000-4000-8000-000000000003', 'STUDENT', 'Học viên')
      ON CONFLICT DO NOTHING;
    `);

    // 4. Upsert the production admin user
    console.log('Đang khởi tạo tài khoản quản trị duy nhất...');
    await client.query(`
      INSERT INTO "users" ("id", "email", "password_hash", "name", "role_id", "is_active")
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT ("id") DO UPDATE SET 
        "email" = EXCLUDED.email, 
        "password_hash" = EXCLUDED.password_hash,
        "name" = EXCLUDED.name,
        "role_id" = EXCLUDED.role_id;
    `, ['20000000-0000-4000-8000-000000000001', email, passwordHash, name, adminRoleId]);

    console.log('\n=============================================');
    console.log('KHỞI TẠO PRODUCTION DATABASE THÀNH CÔNG!');
    console.log(`- Tài khoản admin duy nhất: ${email}`);
    console.log('- Đã xóa sạch toàn bộ dữ liệu mẫu (demo).');
    console.log('=============================================\n');
  } catch (error) {
    console.error('Lỗi khi thực hiện cấu hình database:', error);
  } finally {
    await client.end();
  }
}

main();
