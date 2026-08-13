const fs = require('fs');
const path = require('path');

// 1. Đọc cấu hình từ file .env để lấy tài khoản kết nối Database
const dotenvPath = path.resolve(__dirname, '../.env');
const envConfig = {};
if (fs.existsSync(dotenvPath)) {
  const content = fs.readFileSync(dotenvPath, 'utf8');
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] ? match[2].trim() : '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      envConfig[match[1]] = value;
    }
  });
}

const { Client } = require('pg');

const client = new Client({
  host: envConfig.DATABASE_HOST,
  port: parseInt(envConfig.DATABASE_PORT || '5432'),
  user: envConfig.DATABASE_USER,
  password: envConfig.DATABASE_PASSWORD,
  database: envConfig.DATABASE_NAME,
});

// Các hàm tiện ích đồng bộ múi giờ giống hệt trên backend
function getEventTimestamp(date) {
  if (!date) return 0;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}+07:00`).getTime();
}

function getLocalDateString(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getFormattedDate(dateVal) {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    if (dateVal.includes('T')) {
      return dateVal.split('T')[0];
    }
    return dateVal;
  }
  if (dateVal instanceof Date) {
    const y = dateVal.getFullYear();
    const m = String(dateVal.getMonth() + 1).padStart(2, '0');
    const d = String(dateVal.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(dateVal);
}

const getLocalDate = (dateVal, timeStr) => {
  const dateStr = getFormattedDate(dateVal);
  return new Date(`${dateStr}T${timeStr}:00+07:00`);
};

async function main() {
  console.log(`Connecting to database at ${envConfig.DATABASE_HOST}:${envConfig.DATABASE_PORT}...`);
  await client.connect();
  console.log('Connected to DB successfully!');

  try {
    const studentName = 'Bùi Nam Phong';
    const dateStr = '2026-08-13';

    // 1. Tìm thông tin học sinh
    const studentRes = await client.query(
      `SELECT id, student_id, last_name, first_name FROM students WHERE CONCAT(last_name, ' ', first_name) ILIKE $1`,
      [`%${studentName}%`]
    );
    if (studentRes.rows.length === 0) {
      console.error('Không tìm thấy học sinh Bùi Nam Phong!');
      return;
    }
    const student = studentRes.rows[0];
    console.log('\n[1] Học sinh tìm thấy:');
    console.log(`- ID: ${student.id}`);
    console.log(`- Mã HS: ${student.student_id}`);
    console.log(`- Họ tên: ${student.last_name} ${student.first_name}`);

    // 2. Tìm ca học trong ngày 13/08/2026 của học sinh này
    const sessionsRes = await client.query(`
      SELECT session.id, c.class_name as "className", session.start_time as "startTime", session.end_time as "endTime", session.date
      FROM class_sessions session
      INNER JOIN class_students cs ON cs.class_id = session.class_id
      INNER JOIN classes c ON c.id = session.class_id
      WHERE cs.student_id = $1 AND cs.status = 'Active' AND session.date = $2
    `, [student.id, dateStr]);

    const domainSessions = sessionsRes.rows.map(row => ({
      id: row.id,
      className: row.className,
      startTime: row.startTime ? row.startTime.substring(0, 5) : '',
      endTime: row.endTime ? row.endTime.substring(0, 5) : '',
      date: row.date
    }));

    console.log('\n[2] Ca học được lên lịch trong ngày:');
    console.dir(domainSessions, { depth: null });
    if (domainSessions.length === 0) {
      console.error('Không tìm thấy ca học nào được xếp lớp hoạt động (Active) trong ngày này!');
      return;
    }

    // 3. Tìm log quẹt thẻ của học sinh này trong ngày
    // Chuyển đổi ngày sang múi giờ địa phương để so khớp khoảng giờ lưu trong DB
    const startOfDay = `${dateStr}T00:00:00+07:00`;
    const endOfDay = `${dateStr}T23:59:59+07:00`;

    const logsRes = await client.query(`
      SELECT id, employee_no, student_id, event_time, verify_method 
      FROM timekeeping_log
      WHERE student_id = $1 AND event_time BETWEEN $2 AND $3
    `, [student.id, startOfDay, endOfDay]);

    const domainLogs = logsRes.rows.map(row => ({
      studentId: row.student_id,
      employeeNo: row.employee_no,
      eventTime: new Date(row.event_time),
      verifyMethod: row.verify_method
    }));

    console.log('\n[3] Các lượt quẹt thẻ tìm thấy trong DB:');
    console.dir(domainLogs.map(l => ({
      employeeNo: l.employeeNo,
      eventTimeDB: l.eventTime.toLocaleString(),
      eventTimeISO: l.eventTime.toISOString(),
      parsedTimestamp: getEventTimestamp(l.eventTime)
    })), { depth: null });
    if (domainLogs.length === 0) {
      console.error('Không tìm thấy log quẹt thẻ nào của học sinh trong ngày này!');
      return;
    }

    // 4. Bắt đầu chạy thuật toán đối soát (Match)
    console.log('\n[4] Tiến hành chạy thuật toán đối soát:');
    const sortedSessions = [...domainSessions].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const studentLogs = domainLogs.sort((a, b) => getEventTimestamp(a.eventTime) - getEventTimestamp(b.eventTime));

    const filteredLogs = [];
    for (const log of studentLogs) {
      if (filteredLogs.length === 0) {
        filteredLogs.push(log);
      } else {
        const prevLog = filteredLogs[filteredLogs.length - 1];
        const timeDiffMs = getEventTimestamp(log.eventTime) - getEventTimestamp(prevLog.eventTime);
        if (timeDiffMs >= 5 * 60 * 1000) {
          filteredLogs.push(log);
        }
      }
    }

    const results = sortedSessions.map(s => ({
      classSessionId: s.id,
      isPresent: false,
      attendanceType: 'machine',
      verifyMethod: null,
      isLate: false,
      lateMinutes: 0,
      note: null,
      checkInTime: null,
      checkOutTime: null
    }));

    for (const log of filteredLogs) {
      const t = getEventTimestamp(log.eventTime);
      for (let i = 0; i < sortedSessions.length; i++) {
        const s = sortedSessions[i];
        const res = results[i];

        const sessionStart = getLocalDate(s.date, s.startTime).getTime();
        const sessionEnd = getLocalDate(s.date, s.endTime).getTime();

        const checkInStart = sessionStart - 60 * 60000;
        const checkInEnd = sessionEnd;
        const checkOutStart = sessionStart;
        const checkOutEnd = sessionEnd + 60 * 60000;

        console.log(` So khớp giờ quẹt ${log.eventTime.toLocaleTimeString()} (${t}) với ca ${s.className} (${s.startTime} - ${s.endTime}):`);
        console.log(`   - Khung Check-in:  [${new Date(checkInStart).toLocaleTimeString()} - ${new Date(checkInEnd).toLocaleTimeString()}]`);
        console.log(`   - Khung Check-out: [${new Date(checkOutStart).toLocaleTimeString()} - ${new Date(checkOutEnd).toLocaleTimeString()}]`);

        if (!res.isPresent) {
          if (t >= checkInStart && t <= checkInEnd) {
            console.log('   => KẾT QUẢ: Khớp lượt Check-in!');
            res.isPresent = true;
            res.verifyMethod = log.verifyMethod;
            res.checkInTime = log.eventTime;
            break;
          }
        } else {
          if (res.checkOutTime === null && t >= checkOutStart && t <= checkOutEnd) {
            console.log('   => KẾT QUẢ: Khớp lượt Check-out!');
            res.checkOutTime = log.eventTime;
            break;
          }
        }
      }
    }

    // Hậu xử lý (Check quẹt ra để bù check-in)
    for (let i = 0; i < sortedSessions.length; i++) {
      const s = sortedSessions[i];
      const res = results[i];
      const sessionEnd = getLocalDate(s.date, s.endTime).getTime();
      const outEnd = sessionEnd + 60 * 60000;

      const hasOutLog = filteredLogs.some(log => {
        const t = getEventTimestamp(log.eventTime);
        return t >= sessionEnd && t <= outEnd;
      });

      if (!res.isPresent && hasOutLog) {
        console.log(`   => KẾT QUẢ HẬU XỬ LÝ: Có lượt quẹt ra nhưng thiếu quẹt vào -> Đánh dấu Có mặt.`);
        res.isPresent = true;
        res.verifyMethod = 'machine';
        res.note = 'Thiếu quẹt vào';
      }
    }

    console.log('\n[5] Kết quả đối soát cuối cùng:');
    console.log(results);

    // 5. Cập nhật kết quả vào DB student_attendance
    console.log('\n[6] Cập nhật kết quả vào bảng student_attendance...');
    for (const res of results) {
      const existRes = await client.query(
        `SELECT id, is_present, attendance_type, note FROM student_attendance WHERE student_id = $1 AND class_session_id = $2`,
        [student.id, res.classSessionId]
      );

      if (existRes.rows.length > 0) {
        const currentAtt = existRes.rows[0];
        console.log(`- Đã có dòng điểm danh sẵn trong DB: ID: ${currentAtt.id}, type: ${currentAtt.attendance_type}, is_present: ${currentAtt.is_present}`);
        
        if (currentAtt.attendance_type === 'manual') {
          console.log('  -> Bản ghi đã được giáo viên tích tay (manual). Bỏ qua không cập nhật tự động.');
          continue;
        }

        await client.query(
          `UPDATE student_attendance 
           SET is_present = $1, attendance_type = $2, verify_method = $3, note = $4, updated_at = NOW() 
           WHERE id = $5`,
          [res.isPresent, res.attendanceType, res.verifyMethod, res.note, currentAtt.id]
        );
        console.log('  -> Cập nhật điểm danh THÀNH CÔNG!');
      } else {
        await client.query(
          `INSERT INTO student_attendance (id, student_id, class_session_id, is_present, attendance_type, verify_method, note, created_at, updated_at) 
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [student.id, res.classSessionId, res.isPresent, res.attendanceType, res.verifyMethod, res.note]
        );
        console.log('  -> Tạo mới dòng điểm danh THÀNH CÔNG!');
      }
    }

    // 6. Cập nhật matched_sessions trong timekeeping_log
    console.log('\n[7] Cập nhật ca học khớp (matched_sessions) cho bảng timekeeping_log...');
    for (const log of logsRes.rows) {
      const t = getEventTimestamp(new Date(log.event_time));
      const matched = [];

      for (const s of domainSessions) {
        const sessionStart = getLocalDate(s.date, s.startTime).getTime();
        const sessionEnd = getLocalDate(s.date, s.endTime).getTime();

        const checkInStart = sessionStart - 60 * 60000;
        const checkInEnd = sessionEnd;
        const checkOutStart = sessionStart;
        const checkOutEnd = sessionEnd + 60 * 60000;

        if ((t >= checkInStart && t <= checkInEnd) || (t >= checkOutStart && t <= checkOutEnd)) {
          matched.push({
            id: s.id,
            className: s.className,
            startTime: s.startTime,
            endTime: s.endTime,
            date: s.date,
          });
        }
      }

      await client.query(
        `UPDATE timekeeping_log SET matched_sessions = $1 WHERE id = $2`,
        [matched.length > 0 ? JSON.stringify(matched) : null, log.id]
      );
      console.log(`- Cập nhật log ID: ${log.id} -> ${matched.length > 0 ? `Khớp ca ${matched[0].className}` : 'Không khớp ca nào'}`);
    }

    console.log('\n=== TẤT CẢ QUÁ TRÌNH HOÀN TẤT THÀNH CÔNG! ===');

  } catch (err) {
    console.error('Có lỗi xảy ra khi thực thi:', err);
  } finally {
    await client.end();
  }
}

main();
