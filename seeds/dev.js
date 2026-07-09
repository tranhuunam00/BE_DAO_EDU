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

const client = new Client({
  host: env.DATABASE_HOST || '127.0.0.1',
  port: parseInt(env.DATABASE_PORT || '5435', 10),
  user: env.DATABASE_USER || 'dao_edu_admin',
  password: env.DATABASE_PASSWORD,
  database: env.DATABASE_NAME || 'dao_edu_db',
});

async function main() {
  console.log('Đang kết nối tới cơ sở dữ liệu để nạp dữ liệu mẫu DEV...');
  try {
    await client.connect();
    console.log('Đã kết nối thành công.');
  } catch (err) {
    console.error('Không thể kết nối cơ sở dữ liệu:', err.message);
    process.exit(1);
  }

  try {
    // 1. Truncate all tables in cascade
    console.log('Đang xóa sạch dữ liệu cũ trong cơ sở dữ liệu...');
    const tablesToTruncate = [
      'student_attendance', 'student_monthly_bill_items', 'student_monthly_bills', 
      'teacher_monthly_wage_items', 'teacher_monthly_wages', 'tuition_payment_logs', 
      'tuition_payment_requests', 'class_students', 'class_schedules', 'class_sessions', 'classes', 
      'course_level_pricing', 'course_levels', 'courses', 'rooms', 'centers', 
      'teachers', 'students', 'audit_logs', 'billing_audit_logs', 'notifications', 
      'vietqr_callback_logs', 'leave_requests', 'holidays', 'contact_requests', 
      'facebook_lead_scans', 'leads', 'study_materials', 'users', 'roles', 'payment_periods'
    ];

    for (const table of tablesToTruncate) {
      await client.query(`TRUNCATE TABLE "${table}" CASCADE;`).catch(e => {
        // Table might not exist yet
      });
    }

    console.log('Đang băm mật khẩu cho tài khoản mẫu (123456)...');
    const passwordHash = await bcrypt.hash('123456', 10);

    // 2. Roles
    const roleIds = {
      admin: '10000000-0000-4000-8000-000000000001',
      teacher: '10000000-0000-4000-8000-000000000002',
      student: '10000000-0000-4000-8000-000000000003',
    };
    await client.query(`
      INSERT INTO "roles" ("id", "name", "description")
      VALUES
        ('${roleIds.admin}', 'ADMIN', 'Quản trị hệ thống'),
        ('${roleIds.teacher}', 'TEACHER', 'Giáo viên'),
        ('${roleIds.student}', 'STUDENT', 'Học viên');
    `);

    // 3. Users
    const users = [
      ['20000000-0000-4000-8000-000000000001', 'admin@dao.edu.vn', 'Đào EDU Admin', roleIds.admin],
      ['20000000-0000-4000-8000-000000000101', 'linh.nguyen@dao.edu.vn', 'Nguyễn Hoàng Linh', roleIds.teacher],
      ['20000000-0000-4000-8000-000000000102', 'minh.tran@dao.edu.vn', 'Trần Quốc Minh', roleIds.teacher],
      ['20000000-0000-4000-8000-000000000103', 'anh.pham@dao.edu.vn', 'Phạm Ngọc Anh', roleIds.teacher],
      ['20000000-0000-4000-8000-000000000104', 'huy.le@dao.edu.vn', 'Lê Đức Huy', roleIds.teacher],
      ['20000000-0000-4000-8000-000000000105', 'tam.tran@dao.edu.vn', 'Trần Thanh Tâm', roleIds.teacher], // TA
      ['20000000-0000-4000-8000-000000000201', 'an.nguyen@student.dao.edu.vn', 'Nguyễn Minh An', roleIds.student],
      ['20000000-0000-4000-8000-000000000202', 'bao.tran@student.dao.edu.vn', 'Trần Gia Bảo', roleIds.student],
      ['20000000-0000-4000-8000-000000000203', 'chi.pham@student.dao.edu.vn', 'Phạm Hà Chi', roleIds.student],
      ['20000000-0000-4000-8000-000000000204', 'duy.le@student.dao.edu.vn', 'Lê Anh Duy', roleIds.student],
      ['20000000-0000-4000-8000-000000000205', 'ha.vo@student.dao.edu.vn', 'Võ Thanh Hà', roleIds.student]
    ];
    for (const u of users) {
      await client.query(`
        INSERT INTO "users" ("id", "email", "password_hash", "name", "role_id", "is_active")
        VALUES ($1, $2, $3, $4, $5, true);
      `, [u[0], u[1], passwordHash, u[2], u[3]]);
    }

    // 4. Centers
    const centers = [
      ['30000000-0000-4000-8000-000000000001', 'HN-DAO', 'DAO EDU Hà Nội - Láng Hạ', '024 7300 8899', 'hanoi@dao.edu.vn', 'Hà Nội', 'Đống Đa', 'Tầng 5, 97 Láng Hạ', 'Nguyễn Thu Trang'],
      ['30000000-0000-4000-8000-000000000002', 'HCM-DAO', 'DAO EDU Sài Gòn - Nguyễn Thị Minh Khai', '028 7300 6688', 'saigon@dao.edu.vn', 'TP. Hồ Chí Minh', 'Quận 3', '214 Nguyễn Thị Minh Khai', 'Đặng Minh Khoa']
    ];
    for (const c of centers) {
      await client.query(`
        INSERT INTO "centers" ("id", "center_id", "name", "phone", "email", "province", "district_ward", "primary_address", "manager_name", "status")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Active');
      `, c);
    }

    // 5. Rooms
    const rooms = [
      ['31000000-0000-4000-8000-000000000001', centers[0][0], 'Orchid 501', 24],
      ['31000000-0000-4000-8000-000000000002', centers[0][0], 'Lotus Lab 502', 18],
      ['31000000-0000-4000-8000-000000000003', centers[1][0], 'Saigon Studio 301', 22],
      ['31000000-0000-4000-8000-000000000004', centers[1][0], 'Innovation Lab 302', 18]
    ];
    for (const r of rooms) {
      await client.query(`
        INSERT INTO "rooms" ("id", "center_id", "name", "capacity", "status")
        VALUES ($1, $2, $3, $4, 'Active');
      `, r);
    }

    // 6. Teachers
    const teachers = [
      ['40000000-0000-4000-8000-000000000001', 'GV-DAOG-001', 'Linh', 'Nguyễn Hoàng', 'Female', '1991-04-12', '0901 226 688', 'linh.nguyen@dao.edu.vn', 'Academic Lead', 'Việt Nam', 'Hà Nội', 'Đống Đa', 'Nguyễn Chí Thanh', 'Active', users[1][0]],
      ['40000000-0000-4000-8000-000000000002', 'GV-DAOG-002', 'Minh', 'Trần Quốc', 'Male', '1988-09-21', '0902 336 799', 'minh.tran@dao.edu.vn', 'Teacher', 'Việt Nam', 'Hà Nội', 'Cầu Giấy', 'Trần Thái Tông', 'Active', users[2][0]],
      ['40000000-0000-4000-8000-000000000003', 'GV-DAOG-003', 'Anh', 'Phạm Ngọc', 'Female', '1993-01-18', '0903 446 899', 'anh.pham@dao.edu.vn', 'Teacher', 'Việt Nam', 'TP. Hồ Chí Minh', 'Quận 3', 'Pasteur', 'Active', users[3][0]],
      ['40000000-0000-4000-8000-000000000004', 'GV-DAOG-004', 'Huy', 'Lê Đức', 'Male', '1990-12-03', '0904 556 988', 'huy.le@dao.edu.vn', 'Teacher', 'Việt Nam', 'TP. Hồ Chí Minh', 'Bình Thạnh', 'Điện Biên Phủ', 'Active', users[4][0]],
      ['40000000-0000-4000-8000-000000000005', 'GV-DAOG-005', 'Tâm', 'Trần Thanh', 'Female', '1999-08-15', '0905 667 088', 'tam.tran@dao.edu.vn', 'Teaching Assistant', 'Việt Nam', 'Hà Nội', 'Đống Đa', '55 Thái Hà', 'Active', users[5][0]]
    ];
    for (const t of teachers) {
      await client.query(`
        INSERT INTO "teachers" ("id", "teacher_id", "first_name", "last_name", "gender", "birthdate", "mobile", "email", "type", "country", "province", "district_ward", "primary_address", "status", "user_id")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);
      `, t);
    }

    // 7. Students
    const students = [
      ['50000000-0000-4000-8000-000000000001', 'HV-2026-001', 'An', 'Nguyễn Minh', 'An', 'Male', '0912 000 001', 'an.nguyen@student.dao.edu.vn', '2012-03-18', 'Nguyễn Thanh Bình', 'Father', 'Hà Nội', 'Đống Đa', '12 Huỳnh Thúc Kháng', 'Active', users[6][0]],
      ['50000000-0000-4000-8000-000000000002', 'HV-2026-002', 'Bảo', 'Trần Gia', 'Bảo', 'Male', '0912 000 002', 'bao.tran@student.dao.edu.vn', '2011-07-09', 'Trần Mỹ Hạnh', 'Mother', 'Hà Nội', 'Ba Đình', '45 Kim Mã', 'Active', users[7][0]],
      ['50000000-0000-4000-8000-000000000003', 'HV-2026-003', 'Chi', 'Phạm Hà', 'Chi', 'Female', '0912 000 003', 'chi.pham@student.dao.edu.vn', '2013-11-22', 'Phạm Minh Đức', 'Father', 'Hà Nội', 'Cầu Giấy', '88 Duy Tân', 'Active', users[8][0]],
      ['50000000-0000-4000-8000-000000000004', 'HV-2026-004', 'Duy', 'Lê Anh', 'Duy', 'Male', '0912 000 004', 'duy.le@student.dao.edu.vn', '2010-05-14', 'Lê Ngọc Mai', 'Mother', 'Hà Nội', 'Thanh Xuân', '19 Nguyễn Trãi', 'Active', users[9][0]],
      ['50000000-0000-4000-8000-000000000005', 'HV-2026-005', 'Hà', 'Võ Thanh', 'Hà', 'Female', '0912 000 005', 'ha.vo@student.dao.edu.vn', '2012-12-01', 'Võ Hoàng Nam', 'Father', 'TP. Hồ Chí Minh', 'Quận 3', '31 Võ Văn Tần', 'Active', users[10][0]],
      ['50000000-0000-4000-8000-000000000006', 'HV-2026-006', 'Khánh', 'Đặng Gia', 'Ken', 'Male', '0912 000 006', 'khanh.dang@student.dao.edu.vn', '2014-02-27', 'Đặng Thu Hà', 'Mother', 'TP. Hồ Chí Minh', 'Quận 1', '5 Lê Lợi', 'Active', null],
      ['50000000-0000-4000-8000-000000000007', 'HV-2026-007', 'Linh', 'Bùi Ngọc', 'Linh', 'Female', '0912 000 007', 'linh.bui@student.dao.edu.vn', '2011-10-30', 'Bùi Quốc Thái', 'Father', 'TP. Hồ Chí Minh', 'Bình Thạnh', '42 Xô Viết Nghệ Tĩnh', 'Active', null],
      ['50000000-0000-4000-8000-000000000008', 'HV-2026-008', 'Nam', 'Hoàng Phúc', 'Nam', 'Male', '0912 000 008', 'nam.hoang@student.dao.edu.vn', '2012-08-16', 'Hoàng Minh Phương', 'Mother', 'Hà Nội', 'Hoàn Kiếm', '23 Hàng Bài', 'Waiting for class', null]
    ];
    for (const s of students) {
      await client.query(`
        INSERT INTO "students" ("id", "student_id", "first_name", "last_name", "nick_name", "gender", "mobile", "email", "birthdate", "parent_guardian_1", "relationship_1", "country", "province", "district_ward", "primary_address", "status", "user_id")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Việt Nam', $12, $13, $14, $15, $16);
      `, s);
    }

    // 8. Courses
    const courses = [
      ['60000000-0000-4000-8000-000000000001', 'English', 'English Communication for Teens', 'ENG-TEEN', 'Session', '2026', 18, centers[0][0], 'Giao tiếp tiếng Anh theo tình huống, thuyết trình và phản xạ.'],
      ['60000000-0000-4000-8000-000000000002', 'Coding', 'Creative Coding with Python', 'PY-KIDS', 'Session', '2026', 16, centers[0][0], 'Tư duy lập trình qua dự án game, dữ liệu và tự động hóa nhỏ.'],
      ['60000000-0000-4000-8000-000000000003', 'STEM', 'Robotics & AI Explorer', 'ROBO-AI', 'Session', '2026', 14, centers[1][0], 'Lắp ráp robot, cảm biến và nhập môn AI ứng dụng.'],
      ['60000000-0000-4000-8000-000000000004', 'Math', 'Math Olympiad Foundation', 'MATH-OLY', 'Session', '2026', 20, centers[1][0], 'Nền tảng toán tư duy và bài toán nâng cao theo chủ đề.']
    ];
    for (const co of courses) {
      await client.query(`
        INSERT INTO "courses" ("id", "category", "name", "short_name", "type_of_period", "year", "max_size", "status", "center_id", "description")
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', $8, $9);
      `, co);
    }

    // 9. Levels
    const levels = [
      ['61000000-0000-4000-8000-000000000001', courses[0][0], 'Foundation A1', 'A1', 36, true, true],
      ['61000000-0000-4000-8000-000000000002', courses[0][0], 'Confident Speaker A2', 'A2', 40, true, true],
      ['61000000-0000-4000-8000-000000000003', courses[1][0], 'Python Starter', 'PY-01', 32, true, true],
      ['61000000-0000-4000-8000-000000000004', courses[1][0], 'Python Project Builder', 'PY-02', 36, true, true],
      ['61000000-0000-4000-8000-000000000005', courses[2][0], 'Robotics Lab 1', 'RB-01', 30, true, true],
      ['61000000-0000-4000-8000-000000000006', courses[3][0], 'Olympiad Core', 'MO-01', 42, true, true]
    ];
    for (const l of levels) {
      await client.query(`
        INSERT INTO "course_levels" ("id", "course_id", "level_name", "level_code", "total_hours", "is_fixed_hour", "can_upgrade", "gradebook_setting")
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'Quiz 30%, Project 30%, Final 40%');
      `, l);
    }

    // 10. Pricing (including TA wage)
    const pricing = [
      ['62000000-0000-4000-8000-000000000001', levels[0][0], 280000, 140000, 80000],
      ['62000000-0000-4000-8000-000000000002', levels[1][0], 320000, 160000, 90000],
      ['62000000-0000-4000-8000-000000000003', levels[2][0], 350000, 180000, 100000],
      ['62000000-0000-4000-8000-000000000004', levels[3][0], 390000, 200000, 110000],
      ['62000000-0000-4000-8000-000000000005', levels[4][0], 420000, 220000, 120000],
      ['62000000-0000-4000-8000-000000000006', levels[5][0], 300000, 150000, 80000]
    ];
    for (const p of pricing) {
      await client.query(`
        INSERT INTO "course_level_pricing" ("id", "course_level_id", "price_per_session", "teacher_wage_per_session", "ta_wage_per_session", "effective_from")
        VALUES ($1, $2, $3, $4, $5, '2026-01-01');
      `, p);
    }

    // 11. Classes
    const classes = [
      ['70000000-0000-4000-8000-000000000001', courses[0][0], levels[0][0], 'ENG-A1-2606-HN', 'English A1 - Spark', 'Hybrid', 90, 'Active', '2026-06-01', '2026-08-31', 18, teachers[0][0], 'Mai Anh', centers[0][0]],
      ['70000000-0000-4000-8000-000000000002', courses[1][0], levels[2][0], 'PY-01-2606-HN', 'Python Starter - Orbit', 'Offline', 120, 'Active', '2026-06-03', '2026-08-28', 16, teachers[1][0], 'Hải Yến', centers[0][0]],
      ['70000000-0000-4000-8000-000000000003', courses[2][0], levels[4][0], 'RB-01-2606-HCM', 'Robotics Lab - Nova', 'Offline', 120, 'Active', '2026-06-04', '2026-08-30', 14, teachers[2][0], 'Minh Châu', centers[1][0]],
      ['70000000-0000-4000-8000-000000000004', courses[3][0], levels[5][0], 'MO-01-2606-HCM', 'Math Olympiad - Focus', 'Offline', 90, 'Planning', '2026-07-01', '2026-09-30', 20, teachers[3][0], 'Thanh Tâm', centers[1][0]]
    ];
    for (const cl of classes) {
      await client.query(`
        INSERT INTO "classes" ("id", "course_id", "course_level_id", "class_code", "class_name", "type_of_class", "default_hours", "status", "start_date", "finish_date", "syllabus_by", "max_size", "skip_holidays", "description", "main_teacher_id", "cso_name", "center_id")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'DAO Academic Team', $11, true, 'Lớp demo có lịch học, học viên, điểm danh và công nợ mẫu.', $12, $13, $14);
      `, cl);
    }

    // 12. Schedules
    const schedules = [
      [classes[0][0], rooms[0][0], 'Monday', '18:00', '19:30', 90],
      [classes[0][0], rooms[0][0], 'Wednesday', '18:00', '19:30', 90],
      [classes[1][0], rooms[1][0], 'Tuesday', '18:15', '20:15', 120],
      [classes[1][0], rooms[1][0], 'Thursday', '18:15', '20:15', 120],
      [classes[2][0], rooms[3][0], 'Saturday', '09:00', '11:00', 120],
      [classes[3][0], rooms[2][0], 'Sunday', '09:00', '10:30', 90]
    ];
    for (const sc of schedules) {
      await client.query(`
        INSERT INTO "class_schedules" ("class_id", "room_id", "weekday", "start_time", "end_time", "duration_mins")
        VALUES ($1, $2, $3, $4, $5, $6);
      `, sc);
    }

    // 13. Enrollments
    const enrollments = [
      [classes[0][0], students[0][0]], [classes[0][0], students[1][0]], [classes[0][0], students[2][0]], [classes[0][0], students[3][0]],
      [classes[1][0], students[0][0]], [classes[1][0], students[2][0]], [classes[1][0], students[4][0]], [classes[1][0], students[6][0]],
      [classes[2][0], students[4][0]], [classes[2][0], students[5][0]], [classes[2][0], students[6][0]],
      [classes[3][0], students[1][0]], [classes[3][0], students[3][0]], [classes[3][0], students[7][0]]
    ];
    for (const en of enrollments) {
      await client.query(`
        INSERT INTO "class_students" ("class_id", "student_id", "status", "joined_date")
        VALUES ($1, $2, 'Active', '2026-06-01');
      `, en);
    }

    // 14. Periods
    const periods = [
      ['80000000-0000-4000-8000-000000000001', 'Học phí tháng 05/2026', 'tuition', '2026-05', '2026-05-01', '2026-05-31', 'Closed'],
      ['80000000-0000-4000-8000-000000000002', 'Học phí tháng 06/2026', 'tuition', '2026-06', '2026-06-01', '2026-06-30', 'Active'],
      ['80000000-0000-4000-8000-000000000003', 'Lương giáo viên tháng 05/2026', 'salary', '2026-05', '2026-05-01', '2026-05-31', 'Closed'],
      ['80000000-0000-4000-8000-000000000004', 'Lương giáo viên tháng 06/2026', 'salary', '2026-06', '2026-06-01', '2026-06-30', 'Active']
    ];
    for (const pe of periods) {
      await client.query(`
        INSERT INTO "payment_periods" ("id", "name", "type", "month", "start_date", "end_date", "status")
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `, pe);
    }

    // 15. Sessions (with TA assigned)
    const sessions = [
      ['90000000-0000-4000-8000-000000000001', classes[0][0], rooms[0][0], teachers[0][0], teachers[4][0], '2026-06-01', '18:00', '19:30', 'Completed', true],
      ['90000000-0000-4000-8000-000000000002', classes[0][0], rooms[0][0], teachers[0][0], teachers[4][0], '2026-06-03', '18:00', '19:30', 'Completed', true],
      ['90000000-0000-4000-8000-000000000003', classes[0][0], rooms[0][0], teachers[0][0], teachers[4][0], '2026-06-15', '18:00', '19:30', 'Scheduled', false],
      ['90000000-0000-4000-8000-000000000004', classes[1][0], rooms[1][0], teachers[1][0], teachers[4][0], '2026-06-04', '18:15', '20:15', 'Completed', true],
      ['90000000-0000-4000-8000-000000000005', classes[1][0], rooms[1][0], teachers[1][0], null, '2026-06-16', '18:15', '20:15', 'Scheduled', false],
      ['90000000-0000-4000-8000-000000000006', classes[2][0], rooms[3][0], teachers[2][0], null, '2026-06-06', '09:00', '11:00', 'Completed', true],
      ['90000000-0000-4000-8000-000000000007', classes[2][0], rooms[3][0], teachers[2][0], null, '2026-06-20', '09:00', '11:00', 'Scheduled', false]
    ];
    for (const se of sessions) {
      await client.query(`
        INSERT INTO "class_sessions" ("id", "class_id", "room_id", "teacher_id", "assistant_id", "date", "start_time", "end_time", "status", "attendance_locked")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
      `, se);
    }

    // 16. Bills
    const bills = [
      ['81000000-0000-4000-8000-000000000001', students[0][0], periods[0][0], '2026-05', 1260000, 1260000, 'Paid', '2026-05-28', 'Đã thanh toán qua chuyển khoản.'],
      ['81000000-0000-4000-8000-000000000002', students[1][0], periods[0][0], '2026-05', 840000, 840000, 'Paid', '2026-05-27', 'Đã thanh toán tại quầy.'],
      ['81000000-0000-4000-8000-000000000003', students[0][0], periods[1][0], '2026-06', 1260000, 1260000, 'Paid', '2026-06-10', 'Ưu tiên hiển thị demo doanh thu đã thu.'],
      ['81000000-0000-4000-8000-000000000004', students[2][0], periods[1][0], '2026-06', 1260000, 0, 'Unpaid', null, 'Phụ huynh hẹn thanh toán phần còn lại trong tuần.'],
      ['81000000-0000-4000-8000-000000000005', students[4][0], periods[1][0], '2026-06', 1540000, 0, 'Unpaid', null, 'Cần nhắc lịch thanh toán.'],
      ['81000000-0000-4000-8000-000000000006', students[6][0], periods[1][0], '2026-06', 1540000, 1540000, 'Paid', '2026-06-12', 'Đã thanh toán đủ.']
    ];
    for (const b of bills) {
      await client.query(`
        INSERT INTO "student_monthly_bills" ("id", "student_id", "period_id", "month", "total_amount", "paid_amount", "status", "payment_date", "billing_start_date", "billing_end_date", "note")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '2026-06-01', '2026-06-30', $9);
      `, b);
    }

    // 17. Bill Items
    const billItems = [
      [bills[0][0], classes[0][0], classes[0][4], courses[0][2], levels[0][2], 3, 280000, 840000],
      [bills[0][0], classes[1][0], classes[1][4], courses[1][2], levels[2][2], 1, 420000, 420000],
      [bills[1][0], classes[0][0], classes[0][4], courses[0][2], levels[0][2], 3, 280000, 840000],
      [bills[2][0], classes[0][0], classes[0][4], courses[0][2], levels[0][2], 3, 280000, 840000],
      [bills[2][0], classes[1][0], classes[1][4], courses[1][2], levels[2][2], 1, 420000, 420000],
      [bills[3][0], classes[0][0], classes[0][4], courses[0][2], levels[0][2], 3, 280000, 840000],
      [bills[3][0], classes[1][0], classes[1][4], courses[1][2], levels[2][2], 1, 420000, 420000],
      [bills[4][0], classes[1][0], classes[1][4], courses[1][2], levels[2][2], 2, 350000, 700000],
      [bills[4][0], classes[2][0], classes[2][4], courses[2][2], levels[4][2], 2, 420000, 840000],
      [bills[5][0], classes[1][0], classes[1][4], courses[1][2], levels[2][2], 2, 350000, 700000],
      [bills[5][0], classes[2][0], classes[2][4], courses[2][2], levels[4][2], 2, 420000, 840000]
    ];
    for (const bi of billItems) {
      await client.query(`
        INSERT INTO "student_monthly_bill_items" ("bill_id", "class_id", "class_name", "course_name", "level_name", "sessions_count", "rate", "total_amount")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
      `, bi);
    }

    // 18. Wages
    const wages = [
      ['82000000-0000-4000-8000-000000000001', teachers[0][0], periods[2][0], '2026-05', 1120000, 1120000, 'Paid', '2026-06-02', 'Đã chi lương tháng 05.'],
      ['82000000-0000-4000-8000-000000000002', teachers[1][0], periods[2][0], '2026-05', 900000, 900000, 'Paid', '2026-06-02', 'Đã chi lương tháng 05.'],
      ['82000000-0000-4000-8000-000000000003', teachers[0][0], periods[3][0], '2026-06', 560000, 0, 'Unpaid', null, 'Chờ khóa bảng công cuối tháng.'],
      ['82000000-0000-4000-8000-000000000004', teachers[1][0], periods[3][0], '2026-06', 720000, 0, 'Unpaid', null, 'Chờ khóa bảng công cuối tháng.'],
      ['82000000-0000-4000-8000-000000000005', teachers[2][0], periods[3][0], '2026-06', 440000, 0, 'Unpaid', null, 'Chờ khóa bảng công cuối tháng.']
    ];
    for (const w of wages) {
      await client.query(`
        INSERT INTO "teacher_monthly_wages" ("id", "teacher_id", "period_id", "month", "total_amount", "paid_amount", "status", "payment_date", "billing_start_date", "billing_end_date", "note")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '2026-06-01', '2026-06-30', $9);
      `, w);
    }

    // 19. Wage Items
    const wageItems = [
      [wages[0][0], classes[0][0], classes[0][4], courses[0][2], levels[0][2], 8, 140000, 1120000],
      [wages[1][0], classes[1][0], classes[1][4], courses[1][2], levels[2][2], 5, 180000, 900000],
      [wages[2][0], classes[0][0], classes[0][4], courses[0][2], levels[0][2], 4, 140000, 560000],
      [wages[3][0], classes[1][0], classes[1][4], courses[1][2], levels[2][2], 4, 180000, 720000],
      [wages[4][0], classes[2][0], classes[2][4], courses[2][2], levels[4][2], 2, 220000, 440000]
    ];
    for (const wi of wageItems) {
      await client.query(`
        INSERT INTO "teacher_monthly_wage_items" ("wage_id", "class_id", "class_name", "course_name", "level_name", "sessions_count", "rate", "total_amount")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
      `, wi);
    }

    await client.query(`UPDATE "class_sessions" SET "wage_id" = $1 WHERE "id" IN ($2, $3)`, [wages[2][0], sessions[0][0], sessions[1][0]]);
    await client.query(`UPDATE "class_sessions" SET "wage_id" = $1 WHERE "id" = $2`, [wages[3][0], sessions[3][0]]);
    await client.query(`UPDATE "class_sessions" SET "wage_id" = $1 WHERE "id" = $2`, [wages[4][0], sessions[5][0]]);

    // 20. Attendance
    const attendance = [
      [sessions[0][0], students[0][0], bills[2][0], true, null],
      [sessions[0][0], students[1][0], null, true, null],
      [sessions[0][0], students[2][0], bills[3][0], true, null],
      [sessions[0][0], students[3][0], null, false, 'Gia đình báo bận'],
      [sessions[1][0], students[0][0], bills[2][0], true, null],
      [sessions[1][0], students[1][0], null, true, null],
      [sessions[1][0], students[2][0], bills[3][0], false, 'Ốm'],
      [sessions[1][0], students[3][0], null, true, null],
      [sessions[3][0], students[0][0], bills[2][0], true, null],
      [sessions[3][0], students[2][0], bills[3][0], true, null],
      [sessions[3][0], students[4][0], bills[4][0], true, null],
      [sessions[3][0], students[6][0], bills[5][0], true, null],
      [sessions[5][0], students[4][0], bills[4][0], true, null],
      [sessions[5][0], students[5][0], null, true, null],
      [sessions[5][0], students[6][0], bills[5][0], false, 'Xin nghỉ phép']
    ];
    for (const row of attendance) {
      await client.query(`
        INSERT INTO "student_attendance" ("class_session_id", "student_id", "bill_id", "is_present", "reason", "note")
        VALUES ($1, $2, $3, $4, $5, 'Dữ liệu điểm danh demo');
      `, row);
    }

    console.log('\n=============================================');
    console.log('NẠP DỮ LIỆU THỬ NGHIỆM (DEV SEED) THÀNH CÔNG!');
    console.log('Các tài khoản mẫu có mật khẩu là "123456":');
    console.log('- Quản trị: admin@dao.edu.vn');
    console.log('- Giáo viên: linh.nguyen@dao.edu.vn, minh.tran@dao.edu.vn');
    console.log('- Trợ giảng: tam.tran@dao.edu.vn');
    console.log('- Học viên: an.nguyen@student.dao.edu.vn, bao.tran@student.dao.edu.vn');
    console.log('=============================================\n');
  } catch (error) {
    console.error('Lỗi khi nạp dữ liệu mẫu:', error);
  } finally {
    await client.end();
  }
}

main();
