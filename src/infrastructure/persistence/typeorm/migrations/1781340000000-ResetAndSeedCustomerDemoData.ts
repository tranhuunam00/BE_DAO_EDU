import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcryptjs';

export class ResetAndSeedCustomerDemoData1781340000000 implements MigrationInterface {
  name = 'ResetAndSeedCustomerDemoData1781340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      TRUNCATE TABLE
        "student_attendance",
        "teacher_monthly_wage_items",
        "student_monthly_bill_items",
        "class_sessions",
        "class_schedules",
        "class_students",
        "teacher_monthly_wages",
        "student_monthly_bills",
        "payment_periods",
        "classes",
        "course_level_pricing",
        "course_levels",
        "courses",
        "rooms",
        "students",
        "teachers",
        "users",
        "role_permissions",
        "permissions",
        "roles",
        "centers"
      RESTART IDENTITY CASCADE
    `);

    const passwordHash = await bcrypt.hash('123456', 10);

    const roleIds = {
      admin: '10000000-0000-4000-8000-000000000001',
      teacher: '10000000-0000-4000-8000-000000000002',
      student: '10000000-0000-4000-8000-000000000003',
    };

    await queryRunner.query(
      `
        INSERT INTO "roles" ("id", "name", "description")
        VALUES
          ($1, 'ADMIN', 'Quản trị hệ thống'),
          ($2, 'TEACHER', 'Giáo viên'),
          ($3, 'STUDENT', 'Học viên')
      `,
      [roleIds.admin, roleIds.teacher, roleIds.student],
    );

    const users = [
      ['20000000-0000-4000-8000-000000000001', 'admin@dao.edu.vn', 'Đào EDU Admin', roleIds.admin],
      ['20000000-0000-4000-8000-000000000101', 'linh.nguyen@dao.edu.vn', 'Nguyễn Hoàng Linh', roleIds.teacher],
      ['20000000-0000-4000-8000-000000000102', 'minh.tran@dao.edu.vn', 'Trần Quốc Minh', roleIds.teacher],
      ['20000000-0000-4000-8000-000000000103', 'anh.pham@dao.edu.vn', 'Phạm Ngọc Anh', roleIds.teacher],
      ['20000000-0000-4000-8000-000000000104', 'huy.le@dao.edu.vn', 'Lê Đức Huy', roleIds.teacher],
      ['20000000-0000-4000-8000-000000000201', 'an.nguyen@student.dao.edu.vn', 'Nguyễn Minh An', roleIds.student],
      ['20000000-0000-4000-8000-000000000202', 'bao.tran@student.dao.edu.vn', 'Trần Gia Bảo', roleIds.student],
      ['20000000-0000-4000-8000-000000000203', 'chi.pham@student.dao.edu.vn', 'Phạm Hà Chi', roleIds.student],
      ['20000000-0000-4000-8000-000000000204', 'duy.le@student.dao.edu.vn', 'Lê Anh Duy', roleIds.student],
      ['20000000-0000-4000-8000-000000000205', 'ha.vo@student.dao.edu.vn', 'Võ Thanh Hà', roleIds.student],
    ];

    for (const user of users) {
      await queryRunner.query(
        `
          INSERT INTO "users" ("id", "email", "password_hash", "name", "role_id", "is_active")
          VALUES ($1, $2, $3, $4, $5, true)
        `,
        [user[0], user[1], passwordHash, user[2], user[3]],
      );
    }

    const centers = [
      [
        '30000000-0000-4000-8000-000000000001',
        'HN-DAO',
        'DAO EDU Hà Nội - Láng Hạ',
        '024 7300 8899',
        'hanoi@dao.edu.vn',
        'Hà Nội',
        'Đống Đa',
        'Tầng 5, 97 Láng Hạ',
        'Nguyễn Thu Trang',
      ],
      [
        '30000000-0000-4000-8000-000000000002',
        'HCM-DAO',
        'DAO EDU Sài Gòn - Nguyễn Thị Minh Khai',
        '028 7300 6688',
        'saigon@dao.edu.vn',
        'TP. Hồ Chí Minh',
        'Quận 3',
        '214 Nguyễn Thị Minh Khai',
        'Đặng Minh Khoa',
      ],
    ];

    for (const center of centers) {
      await queryRunner.query(
        `
          INSERT INTO "centers"
            ("id", "center_id", "name", "phone", "email", "province", "district_ward", "primary_address", "manager_name", "status")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Active')
        `,
        center,
      );
    }

    const rooms = [
      ['31000000-0000-4000-8000-000000000001', centers[0][0], 'Orchid 501', 24],
      ['31000000-0000-4000-8000-000000000002', centers[0][0], 'Lotus Lab 502', 18],
      ['31000000-0000-4000-8000-000000000003', centers[1][0], 'Saigon Studio 301', 22],
      ['31000000-0000-4000-8000-000000000004', centers[1][0], 'Innovation Lab 302', 18],
    ];

    for (const room of rooms) {
      await queryRunner.query(
        `
          INSERT INTO "rooms" ("id", "center_id", "name", "capacity", "status")
          VALUES ($1, $2, $3, $4, 'Active')
        `,
        room,
      );
    }

    const teachers = [
      ['40000000-0000-4000-8000-000000000001', 'GV-DAOG-001', 'Linh', 'Nguyễn Hoàng', 'Female', '1991-04-12', '0901 226 688', 'linh.nguyen@dao.edu.vn', 'Academic Lead', 'Hà Nội', 'Đống Đa', 'Nguyễn Chí Thanh', users[1][0]],
      ['40000000-0000-4000-8000-000000000002', 'GV-DAOG-002', 'Minh', 'Trần Quốc', 'Male', '1988-09-21', '0902 336 799', 'minh.tran@dao.edu.vn', 'Teacher', 'Hà Nội', 'Cầu Giấy', 'Trần Thái Tông', users[2][0]],
      ['40000000-0000-4000-8000-000000000003', 'GV-DAOG-003', 'Anh', 'Phạm Ngọc', 'Female', '1993-01-18', '0903 446 899', 'anh.pham@dao.edu.vn', 'Teacher', 'TP. Hồ Chí Minh', 'Quận 3', 'Pasteur', users[3][0]],
      ['40000000-0000-4000-8000-000000000004', 'GV-DAOG-004', 'Huy', 'Lê Đức', 'Male', '1990-12-03', '0904 556 988', 'huy.le@dao.edu.vn', 'Teacher', 'TP. Hồ Chí Minh', 'Bình Thạnh', 'Điện Biên Phủ', users[4][0]],
    ];

    for (const teacher of teachers) {
      await queryRunner.query(
        `
          INSERT INTO "teachers"
            ("id", "teacher_id", "first_name", "last_name", "gender", "birthdate", "mobile", "email", "type", "country", "province", "district_ward", "primary_address", "status", "user_id")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Việt Nam', $10, $11, $12, 'Active', $13)
        `,
        teacher,
      );
    }

    const students = [
      ['50000000-0000-4000-8000-000000000001', 'HV-2026-001', 'An', 'Nguyễn Minh', 'An', 'Male', '0912 000 001', 'an.nguyen@student.dao.edu.vn', '2012-03-18', 'Nguyễn Thanh Bình', 'Father', 'Hà Nội', 'Đống Đa', '12 Huỳnh Thúc Kháng', 'Active', users[5][0]],
      ['50000000-0000-4000-8000-000000000002', 'HV-2026-002', 'Bảo', 'Trần Gia', 'Bảo', 'Male', '0912 000 002', 'bao.tran@student.dao.edu.vn', '2011-07-09', 'Trần Mỹ Hạnh', 'Mother', 'Hà Nội', 'Ba Đình', '45 Kim Mã', 'Active', users[6][0]],
      ['50000000-0000-4000-8000-000000000003', 'HV-2026-003', 'Chi', 'Phạm Hà', 'Chi', 'Female', '0912 000 003', 'chi.pham@student.dao.edu.vn', '2013-11-22', 'Phạm Minh Đức', 'Father', 'Hà Nội', 'Cầu Giấy', '88 Duy Tân', 'Active', users[7][0]],
      ['50000000-0000-4000-8000-000000000004', 'HV-2026-004', 'Duy', 'Lê Anh', 'Duy', 'Male', '0912 000 004', 'duy.le@student.dao.edu.vn', '2010-05-14', 'Lê Ngọc Mai', 'Mother', 'Hà Nội', 'Thanh Xuân', '19 Nguyễn Trãi', 'Active', users[8][0]],
      ['50000000-0000-4000-8000-000000000005', 'HV-2026-005', 'Hà', 'Võ Thanh', 'Hà', 'Female', '0912 000 005', 'ha.vo@student.dao.edu.vn', '2012-12-01', 'Võ Hoàng Nam', 'Father', 'TP. Hồ Chí Minh', 'Quận 3', '31 Võ Văn Tần', 'Active', users[9][0]],
      ['50000000-0000-4000-8000-000000000006', 'HV-2026-006', 'Khánh', 'Đặng Gia', 'Ken', 'Male', '0912 000 006', 'khanh.dang@student.dao.edu.vn', '2014-02-27', 'Đặng Thu Hà', 'Mother', 'TP. Hồ Chí Minh', 'Quận 1', '5 Lê Lợi', 'Active', null],
      ['50000000-0000-4000-8000-000000000007', 'HV-2026-007', 'Linh', 'Bùi Ngọc', 'Linh', 'Female', '0912 000 007', 'linh.bui@student.dao.edu.vn', '2011-10-30', 'Bùi Quốc Thái', 'Father', 'TP. Hồ Chí Minh', 'Bình Thạnh', '42 Xô Viết Nghệ Tĩnh', 'Active', null],
      ['50000000-0000-4000-8000-000000000008', 'HV-2026-008', 'Nam', 'Hoàng Phúc', 'Nam', 'Male', '0912 000 008', 'nam.hoang@student.dao.edu.vn', '2012-08-16', 'Hoàng Minh Phương', 'Mother', 'Hà Nội', 'Hoàn Kiếm', '23 Hàng Bài', 'Waiting for class', null],
    ];

    for (const student of students) {
      await queryRunner.query(
        `
          INSERT INTO "students"
            ("id", "student_id", "first_name", "last_name", "nick_name", "gender", "mobile", "email", "birthdate", "parent_guardian_1", "relationship_1", "country", "province", "district_ward", "primary_address", "status", "user_id")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Việt Nam', $12, $13, $14, $15, $16)
        `,
        student,
      );
    }

    const courses = [
      ['60000000-0000-4000-8000-000000000001', 'English', 'English Communication for Teens', 'ENG-TEEN', 'Session', '2026', 18, centers[0][0], 'Giao tiếp tiếng Anh theo tình huống, thuyết trình và phản xạ.'],
      ['60000000-0000-4000-8000-000000000002', 'Coding', 'Creative Coding with Python', 'PY-KIDS', 'Session', '2026', 16, centers[0][0], 'Tư duy lập trình qua dự án game, dữ liệu và tự động hóa nhỏ.'],
      ['60000000-0000-4000-8000-000000000003', 'STEM', 'Robotics & AI Explorer', 'ROBO-AI', 'Session', '2026', 14, centers[1][0], 'Lắp ráp robot, cảm biến và nhập môn AI ứng dụng.'],
      ['60000000-0000-4000-8000-000000000004', 'Math', 'Math Olympiad Foundation', 'MATH-OLY', 'Session', '2026', 20, centers[1][0], 'Nền tảng toán tư duy và bài toán nâng cao theo chủ đề.'],
    ];

    for (const course of courses) {
      await queryRunner.query(
        `
          INSERT INTO "courses"
            ("id", "category", "name", "short_name", "type_of_period", "year", "max_size", "status", "center_id", "description")
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', $8, $9)
        `,
        course,
      );
    }

    const levels = [
      ['61000000-0000-4000-8000-000000000001', courses[0][0], 'Foundation A1', 'A1', 36, true, true],
      ['61000000-0000-4000-8000-000000000002', courses[0][0], 'Confident Speaker A2', 'A2', 40, true, true],
      ['61000000-0000-4000-8000-000000000003', courses[1][0], 'Python Starter', 'PY-01', 32, true, true],
      ['61000000-0000-4000-8000-000000000004', courses[1][0], 'Python Project Builder', 'PY-02', 36, true, true],
      ['61000000-0000-4000-8000-000000000005', courses[2][0], 'Robotics Lab 1', 'RB-01', 30, true, true],
      ['61000000-0000-4000-8000-000000000006', courses[3][0], 'Olympiad Core', 'MO-01', 42, true, true],
    ];

    for (const level of levels) {
      await queryRunner.query(
        `
          INSERT INTO "course_levels"
            ("id", "course_id", "level_name", "level_code", "total_hours", "is_fixed_hour", "can_upgrade", "gradebook_setting")
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'Quiz 30%, Project 30%, Final 40%')
        `,
        level,
      );
    }

    const pricing = [
      ['62000000-0000-4000-8000-000000000001', levels[0][0], 280000, 140000],
      ['62000000-0000-4000-8000-000000000002', levels[1][0], 320000, 160000],
      ['62000000-0000-4000-8000-000000000003', levels[2][0], 350000, 180000],
      ['62000000-0000-4000-8000-000000000004', levels[3][0], 390000, 200000],
      ['62000000-0000-4000-8000-000000000005', levels[4][0], 420000, 220000],
      ['62000000-0000-4000-8000-000000000006', levels[5][0], 300000, 150000],
    ];

    for (const price of pricing) {
      await queryRunner.query(
        `
          INSERT INTO "course_level_pricing"
            ("id", "course_level_id", "price_per_session", "teacher_wage_per_session", "effective_from")
          VALUES ($1, $2, $3, $4, '2026-01-01')
        `,
        price,
      );
    }

    const classes = [
      ['70000000-0000-4000-8000-000000000001', courses[0][0], levels[0][0], 'ENG-A1-2606-HN', 'English A1 - Spark', 'Hybrid', 90, 'Active', '2026-06-01', '2026-08-31', 18, teachers[0][0], 'Mai Anh', centers[0][0]],
      ['70000000-0000-4000-8000-000000000002', courses[1][0], levels[2][0], 'PY-01-2606-HN', 'Python Starter - Orbit', 'Offline', 120, 'Active', '2026-06-03', '2026-08-28', 16, teachers[1][0], 'Hải Yến', centers[0][0]],
      ['70000000-0000-4000-8000-000000000003', courses[2][0], levels[4][0], 'RB-01-2606-HCM', 'Robotics Lab - Nova', 'Offline', 120, 'Active', '2026-06-04', '2026-08-30', 14, teachers[2][0], 'Minh Châu', centers[1][0]],
      ['70000000-0000-4000-8000-000000000004', courses[3][0], levels[5][0], 'MO-01-2606-HCM', 'Math Olympiad - Focus', 'Offline', 90, 'Planning', '2026-07-01', '2026-09-30', 20, teachers[3][0], 'Thanh Tâm', centers[1][0]],
    ];

    for (const classItem of classes) {
      await queryRunner.query(
        `
          INSERT INTO "classes"
            ("id", "course_id", "course_level_id", "class_code", "class_name", "type_of_class", "default_hours", "status", "start_date", "finish_date", "syllabus_by", "max_size", "skip_holidays", "description", "main_teacher_id", "cso_name", "center_id")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'DAO Academic Team', $11, true, 'Lớp demo có lịch học, học viên, điểm danh và công nợ mẫu.', $12, $13, $14)
        `,
        classItem,
      );
    }

    const schedules = [
      [classes[0][0], rooms[0][0], 'Monday', '18:00', '19:30', 90],
      [classes[0][0], rooms[0][0], 'Wednesday', '18:00', '19:30', 90],
      [classes[1][0], rooms[1][0], 'Tuesday', '18:15', '20:15', 120],
      [classes[1][0], rooms[1][0], 'Thursday', '18:15', '20:15', 120],
      [classes[2][0], rooms[3][0], 'Saturday', '09:00', '11:00', 120],
      [classes[3][0], rooms[2][0], 'Sunday', '09:00', '10:30', 90],
    ];

    for (const schedule of schedules) {
      await queryRunner.query(
        `
          INSERT INTO "class_schedules" ("class_id", "room_id", "weekday", "start_time", "end_time", "duration_mins")
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        schedule,
      );
    }

    const enrollments = [
      [classes[0][0], students[0][0]], [classes[0][0], students[1][0]], [classes[0][0], students[2][0]], [classes[0][0], students[3][0]],
      [classes[1][0], students[0][0]], [classes[1][0], students[2][0]], [classes[1][0], students[4][0]], [classes[1][0], students[6][0]],
      [classes[2][0], students[4][0]], [classes[2][0], students[5][0]], [classes[2][0], students[6][0]],
      [classes[3][0], students[1][0]], [classes[3][0], students[3][0]], [classes[3][0], students[7][0]],
    ];

    for (const enrollment of enrollments) {
      await queryRunner.query(
        `
          INSERT INTO "class_students" ("class_id", "student_id", "status", "joined_date")
          VALUES ($1, $2, 'Active', '2026-06-01')
        `,
        enrollment,
      );
    }

    const periods = [
      ['80000000-0000-4000-8000-000000000001', 'Học phí tháng 05/2026', 'tuition', '2026-05', '2026-05-01', '2026-05-31', 'Closed'],
      ['80000000-0000-4000-8000-000000000002', 'Học phí tháng 06/2026', 'tuition', '2026-06', '2026-06-01', '2026-06-30', 'Active'],
      ['80000000-0000-4000-8000-000000000003', 'Lương giáo viên tháng 05/2026', 'salary', '2026-05', '2026-05-01', '2026-05-31', 'Closed'],
      ['80000000-0000-4000-8000-000000000004', 'Lương giáo viên tháng 06/2026', 'salary', '2026-06', '2026-06-01', '2026-06-30', 'Active'],
    ];

    for (const period of periods) {
      await queryRunner.query(
        `
          INSERT INTO "payment_periods" ("id", "name", "type", "month", "start_date", "end_date", "status")
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        period,
      );
    }

    const sessions = [
      ['90000000-0000-4000-8000-000000000001', classes[0][0], rooms[0][0], teachers[0][0], '2026-06-01', '18:00', '19:30', 'Completed', true],
      ['90000000-0000-4000-8000-000000000002', classes[0][0], rooms[0][0], teachers[0][0], '2026-06-03', '18:00', '19:30', 'Completed', true],
      ['90000000-0000-4000-8000-000000000003', classes[0][0], rooms[0][0], teachers[0][0], '2026-06-15', '18:00', '19:30', 'Scheduled', false],
      ['90000000-0000-4000-8000-000000000004', classes[1][0], rooms[1][0], teachers[1][0], '2026-06-04', '18:15', '20:15', 'Completed', true],
      ['90000000-0000-4000-8000-000000000005', classes[1][0], rooms[1][0], teachers[1][0], '2026-06-16', '18:15', '20:15', 'Scheduled', false],
      ['90000000-0000-4000-8000-000000000006', classes[2][0], rooms[3][0], teachers[2][0], '2026-06-06', '09:00', '11:00', 'Completed', true],
      ['90000000-0000-4000-8000-000000000007', classes[2][0], rooms[3][0], teachers[2][0], '2026-06-20', '09:00', '11:00', 'Scheduled', false],
    ];

    for (const session of sessions) {
      await queryRunner.query(
        `
          INSERT INTO "class_sessions"
            ("id", "class_id", "room_id", "teacher_id", "date", "start_time", "end_time", "status", "attendance_locked")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        session,
      );
    }

    const bills = [
      ['81000000-0000-4000-8000-000000000001', students[0][0], periods[0][0], '2026-05', 1260000, 1260000, 'Paid', '2026-05-28', 'Đã thanh toán qua chuyển khoản.'],
      ['81000000-0000-4000-8000-000000000002', students[1][0], periods[0][0], '2026-05', 840000, 840000, 'Paid', '2026-05-27', 'Đã thanh toán tại quầy.'],
      ['81000000-0000-4000-8000-000000000003', students[0][0], periods[1][0], '2026-06', 1260000, 1260000, 'Paid', '2026-06-10', 'Ưu tiên hiển thị demo doanh thu đã thu.'],
      ['81000000-0000-4000-8000-000000000004', students[2][0], periods[1][0], '2026-06', 1260000, 700000, 'Partial', null, 'Phụ huynh hẹn thanh toán phần còn lại trong tuần.'],
      ['81000000-0000-4000-8000-000000000005', students[4][0], periods[1][0], '2026-06', 1540000, 0, 'Unpaid', null, 'Cần nhắc lịch thanh toán.'],
      ['81000000-0000-4000-8000-000000000006', students[6][0], periods[1][0], '2026-06', 1540000, 1540000, 'Paid', '2026-06-12', 'Đã thanh toán đủ.'],
    ];

    for (const bill of bills) {
      await queryRunner.query(
        `
          INSERT INTO "student_monthly_bills"
            ("id", "student_id", "period_id", "month", "total_amount", "paid_amount", "status", "payment_date", "billing_start_date", "billing_end_date", "note")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '2026-06-01', '2026-06-30', $9)
        `,
        bill,
      );
    }

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
      [bills[5][0], classes[2][0], classes[2][4], courses[2][2], levels[4][2], 2, 420000, 840000],
    ];

    for (const item of billItems) {
      await queryRunner.query(
        `
          INSERT INTO "student_monthly_bill_items"
            ("bill_id", "class_id", "class_name", "course_name", "level_name", "sessions_count", "rate", "total_amount")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        item,
      );
    }

    const wages = [
      ['82000000-0000-4000-8000-000000000001', teachers[0][0], periods[2][0], '2026-05', 1120000, 1120000, 'Paid', '2026-06-02', 'Đã chi lương tháng 05.'],
      ['82000000-0000-4000-8000-000000000002', teachers[1][0], periods[2][0], '2026-05', 900000, 900000, 'Paid', '2026-06-02', 'Đã chi lương tháng 05.'],
      ['82000000-0000-4000-8000-000000000003', teachers[0][0], periods[3][0], '2026-06', 560000, 0, 'Unpaid', null, 'Chờ khóa bảng công cuối tháng.'],
      ['82000000-0000-4000-8000-000000000004', teachers[1][0], periods[3][0], '2026-06', 720000, 0, 'Unpaid', null, 'Chờ khóa bảng công cuối tháng.'],
      ['82000000-0000-4000-8000-000000000005', teachers[2][0], periods[3][0], '2026-06', 440000, 0, 'Unpaid', null, 'Chờ khóa bảng công cuối tháng.'],
    ];

    for (const wage of wages) {
      await queryRunner.query(
        `
          INSERT INTO "teacher_monthly_wages"
            ("id", "teacher_id", "period_id", "month", "total_amount", "paid_amount", "status", "payment_date", "billing_start_date", "billing_end_date", "note")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '2026-06-01', '2026-06-30', $9)
        `,
        wage,
      );
    }

    const wageItems = [
      [wages[0][0], classes[0][0], classes[0][4], courses[0][2], levels[0][2], 8, 140000, 1120000],
      [wages[1][0], classes[1][0], classes[1][4], courses[1][2], levels[2][2], 5, 180000, 900000],
      [wages[2][0], classes[0][0], classes[0][4], courses[0][2], levels[0][2], 4, 140000, 560000],
      [wages[3][0], classes[1][0], classes[1][4], courses[1][2], levels[2][2], 4, 180000, 720000],
      [wages[4][0], classes[2][0], classes[2][4], courses[2][2], levels[4][2], 2, 220000, 440000],
    ];

    for (const item of wageItems) {
      await queryRunner.query(
        `
          INSERT INTO "teacher_monthly_wage_items"
            ("wage_id", "class_id", "class_name", "course_name", "level_name", "sessions_count", "rate", "total_amount")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        item,
      );
    }

    await queryRunner.query(`UPDATE "class_sessions" SET "wage_id" = $1 WHERE "id" IN ($2, $3)`, [
      wages[2][0],
      sessions[0][0],
      sessions[1][0],
    ]);
    await queryRunner.query(`UPDATE "class_sessions" SET "wage_id" = $1 WHERE "id" = $2`, [wages[3][0], sessions[3][0]]);
    await queryRunner.query(`UPDATE "class_sessions" SET "wage_id" = $1 WHERE "id" = $2`, [wages[4][0], sessions[5][0]]);

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
      [sessions[5][0], students[6][0], bills[5][0], false, 'Xin nghỉ phép'],
    ];

    for (const row of attendance) {
      await queryRunner.query(
        `
          INSERT INTO "student_attendance"
            ("class_session_id", "student_id", "bill_id", "is_present", "reason", "note")
          VALUES ($1, $2, $3, $4, $5, 'Dữ liệu điểm danh demo')
        `,
        row,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      TRUNCATE TABLE
        "student_attendance",
        "teacher_monthly_wage_items",
        "student_monthly_bill_items",
        "class_sessions",
        "class_schedules",
        "class_students",
        "teacher_monthly_wages",
        "student_monthly_bills",
        "payment_periods",
        "classes",
        "course_level_pricing",
        "course_levels",
        "courses",
        "rooms",
        "students",
        "teachers",
        "users",
        "role_permissions",
        "permissions",
        "roles",
        "centers"
      RESTART IDENTITY CASCADE
    `);
  }
}
