import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';
import { StudentOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import { StudentAttendanceOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { ClassSessionOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { TimekeepingLogOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/timekeeping-log.orm-entity';
import { TeacherOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/teacher.orm-entity';
import { TimekeepingMatcher, DomainClassSession, TimekeepingLog, normalizeEmployeeNo, parseTimekeepingCode, getEventTimestamp, getLocalDateString } from '../../domain/services/timekeeping-matcher';

@Injectable()
export class ProcessRawLogUseCase {
  private readonly logger = new Logger(ProcessRawLogUseCase.name);

  constructor(
    @InjectRepository(StudentOrmEntity)
    private readonly studentRepository: Repository<StudentOrmEntity>,
    
    @InjectRepository(StudentAttendanceOrmEntity)
    private readonly studentAttendanceRepository: Repository<StudentAttendanceOrmEntity>,
    
    @InjectRepository(TimekeepingLogOrmEntity)
    private readonly timekeepingLogRepository: Repository<TimekeepingLogOrmEntity>,

    @InjectRepository(TeacherOrmEntity)
    private readonly teacherRepository: Repository<TeacherOrmEntity>,

    private readonly dataSource: DataSource,
  ) {}

  async execute(
    studentCode: string,
    eventTime: Date,
    verifyMethod: string,
    rawPayload?: any,
    originalId?: string,
    imageKey?: string,
  ): Promise<any[]> {
    let student: StudentOrmEntity | null = null;
    let teacher: TeacherOrmEntity | null = null;

    const cleanStudentCode = normalizeEmployeeNo(studentCode);

    // 1. Phân loại theo tiền tố sử dụng hàm tiện ích parseTimekeepingCode
    const parsed = parseTimekeepingCode(cleanStudentCode);
    const finalEmployeeNo = parsed.normalizedCode;

    if (parsed.type === 'student') {
      student = await this.studentRepository.createQueryBuilder('student')
        .where("LTRIM(REGEXP_REPLACE(student.studentId, '[^0-9]', '', 'g'), '0') = :code", { code: finalEmployeeNo })
        .getOne();
    } else if (parsed.type === 'teacher') {
      teacher = await this.teacherRepository.createQueryBuilder('teacher')
        .where("LTRIM(REGEXP_REPLACE(teacher.teacherId, '[^0-9]', '', 'g'), '0') = :code", { code: finalEmployeeNo })
        .getOne();
    } else {
      // Fallback tương thích ngược không có tiền tố
      student = await this.studentRepository.createQueryBuilder('student')
        .where("LTRIM(REGEXP_REPLACE(student.studentId, '[^0-9]', '', 'g'), '0') = :code", { code: finalEmployeeNo })
        .getOne();
      
      if (!student) {
        teacher = await this.teacherRepository.createQueryBuilder('teacher')
          .where("LTRIM(REGEXP_REPLACE(teacher.teacherId, '[^0-9]', '', 'g'), '0') = :code", { code: finalEmployeeNo })
          .getOne();
      }
    }

    // 2. Ghi nhận nhật ký thô và chống trùng lặp qua DB Unique constraint
    try {
      const existingLog = await this.timekeepingLogRepository.findOne({
        where: { employeeNo: cleanStudentCode, eventTime }
      });

      if (existingLog) {
        let needsUpdate = false;
        if (parsed.type === 'teacher') {
          // 1. Mã tiền tố Giáo viên (222...): Bắt buộc xóa sạch studentId và cập nhật teacherId
          if (existingLog.studentId !== null) {
            existingLog.studentId = null;
            needsUpdate = true;
          }
          const targetTeacherId = teacher ? teacher.id : null;
          if (existingLog.teacherId !== targetTeacherId) {
            existingLog.teacherId = targetTeacherId;
            needsUpdate = true;
          }
        } else if (parsed.type === 'student') {
          // 2. Mã tiền tố Học sinh (1111...): Bắt buộc xóa sạch teacherId và cập nhật studentId
          if (existingLog.teacherId !== null) {
            existingLog.teacherId = null;
            needsUpdate = true;
          }
          const targetStudentId = student ? student.id : null;
          if (existingLog.studentId !== targetStudentId) {
            existingLog.studentId = targetStudentId;
            needsUpdate = true;
          }
        } else {
          // 3. Fallback không có tiền tố: Ưu tiên entity tìm được và xóa entity còn lại
          if (student) {
            if (existingLog.studentId !== student.id) {
              existingLog.studentId = student.id;
              needsUpdate = true;
            }
            if (existingLog.teacherId !== null) {
              existingLog.teacherId = null;
              needsUpdate = true;
            }
          } else if (teacher) {
            if (existingLog.teacherId !== teacher.id) {
              existingLog.teacherId = teacher.id;
              needsUpdate = true;
            }
            if (existingLog.studentId !== null) {
              existingLog.studentId = null;
              needsUpdate = true;
            }
          }
        }
        if (needsUpdate) {
          await this.timekeepingLogRepository.save(existingLog);
        }
      } else {
        await this.timekeepingLogRepository.createQueryBuilder()
          .insert()
          .values({
            studentId: student ? student.id : null,
            teacherId: teacher ? teacher.id : null,
            employeeNo: cleanStudentCode,
            eventTime,
            verifyMethod,
            rawPayload,
            originalId,
            imageKey,
          })
          .orIgnore() // ON CONFLICT DO NOTHING
          .execute();
      }
    } catch (err) {
      // Bỏ qua nếu có lỗi trùng lặp ràng buộc duy nhất
    }

    if (teacher) {
      console.log(`[ProcessRawLog] Found teacher: ID=${teacher.id}, Name=${teacher.lastName} ${teacher.firstName}, Code=${teacher.teacherId}`);
      const dateString = getLocalDateString(eventTime);
      const startOfDay = new Date(`${dateString}T00:00:00+07:00`);
      const endOfDay = new Date(`${dateString}T23:59:59+07:00`);

      // 1. Lấy tất cả nhật ký quẹt thẻ trong ngày của giáo viên này
      const teacherLogs = await this.timekeepingLogRepository.find({
        where: {
          teacherId: teacher.id,
          eventTime: Between(startOfDay, endOfDay),
        },
      });

      // 2. Lấy danh sách ca học giáo viên này phụ trách (dạy chính hoặc trợ giảng) trong ngày
      const sessions = await this.dataSource.getRepository(ClassSessionOrmEntity)
        .createQueryBuilder('session')
        .innerJoin('classes', 'c', 'c.id = session.class_id')
        .where('(session.teacher_id = :teacherId OR session.assistant_id = :teacherId)', { teacherId: teacher.id })
        .andWhere('session.date = :date', { date: dateString })
        .select([
          'session.id AS id',
          'c.class_name AS className',
          'session.startTime AS startTime',
          'session.endTime AS endTime',
          'session.date AS date',
        ])
        .getRawMany();

      const domainSessions: DomainClassSession[] = sessions.map(row => {
        const startTimeVal = row.starttime || row.startTime || '';
        const endTimeVal = row.endtime || row.endTime || '';
        return {
          id: row.id,
          className: row.classname || row.className || '',
          startTime: startTimeVal ? startTimeVal.substring(0, 5) : '',
          endTime: endTimeVal ? endTimeVal.substring(0, 5) : '',
          date: row.date,
        };
      });

      // 3. Đối khớp thời gian quẹt thẻ với các ca dạy (khoảng +/- 60 phút)
      for (const dbLog of teacherLogs) {
        const t = getEventTimestamp(dbLog.eventTime);
        const matched = [];

        for (const s of domainSessions) {
          const sDateStr = getLocalDateString(s.date);
          const sessionStart = new Date(`${sDateStr}T${s.startTime}:00+07:00`).getTime();
          const sessionEnd = new Date(`${sDateStr}T${s.endTime}:00+07:00`).getTime();

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

        dbLog.matchedSessions = matched.length > 0 ? matched : null;
        await this.timekeepingLogRepository.save(dbLog);
      }

      return [];
    }

    if (!student) {
      console.log(`[ProcessRawLog] Student not found for code: ${studentCode}`);
      return [];
    }

    console.log(`[ProcessRawLog] Found student: ID=${student.id}, Name=${student.lastName} ${student.firstName}, Code=${student.studentId}`);

    // 3. Tính toán khung ngày học của lượt quẹt (múi giờ +07:00)
    const dateString = getLocalDateString(eventTime);
    console.log(`[ProcessRawLog] Date string calculated from eventTime (${eventTime.toISOString()} / ${eventTime.toLocaleString()}): ${dateString}`);

    const startOfDay = new Date(`${dateString}T00:00:00+07:00`);
    const endOfDay = new Date(`${dateString}T23:59:59+07:00`);

    // 4. Lấy tất cả nhật ký quẹt thẻ trong ngày của học sinh này
    const dbLogs = await this.timekeepingLogRepository.find({
      where: {
        studentId: student.id,
        eventTime: Between(startOfDay, endOfDay)
      }
    });
    console.log(`[ProcessRawLog] Found ${dbLogs.length} timekeeping logs in DB for date ${dateString} between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`);

    const domainLogs: TimekeepingLog[] = dbLogs.map(log => ({
      studentId: log.studentId,
      employeeNo: log.employeeNo,
      eventTime: log.eventTime,
      verifyMethod: log.verifyMethod,
    }));

    // 5. Lấy danh sách ca học được xếp lịch trong ngày của học sinh này
    const sessions = await this.dataSource.getRepository(ClassSessionOrmEntity)
      .createQueryBuilder('session')
      .innerJoin('class_students', 'cs', 'cs.class_id = session.class_id')
      .innerJoin('classes', 'c', 'c.id = session.class_id')
      .where('cs.student_id = :studentId', { studentId: student.id })
      .andWhere('cs.status = :status', { status: 'Active' })
      .andWhere('session.date = :date', { date: dateString })
      .select([
        'session.id AS id',
        'c.class_name AS className',
        'session.startTime AS startTime',
        'session.endTime AS endTime',
        'session.date AS date',
      ])
      .getRawMany();

    const domainSessions: DomainClassSession[] = sessions.map(row => {
      const startTimeVal = row.starttime || row.startTime || '';
      const endTimeVal = row.endtime || row.endTime || '';
      return {
        id: row.id,
        className: row.classname || row.className || '',
        startTime: startTimeVal ? startTimeVal.substring(0, 5) : '',
        endTime: endTimeVal ? endTimeVal.substring(0, 5) : '',
        date: row.date,
      };
    });
    console.log(`[ProcessRawLog] Found ${domainSessions.length} active sessions: ${JSON.stringify(domainSessions)}`);

    // 6. Chạy thuật toán đối khớp của tầng Domain
    const matchResults = TimekeepingMatcher.match(student.id, domainSessions, domainLogs);
    console.log(`[ProcessRawLog] Match results from domain matcher: ${JSON.stringify(matchResults)}`);

    // 7. Lưu / Cập nhật kết quả điểm danh vào bảng student_attendance
    const savedResults = [];
    for (const res of matchResults) {
      let attendance = await this.studentAttendanceRepository.findOne({
        where: { studentId: student.id, classSessionId: res.classSessionId }
      });

      // Nếu đã có bản ghi điểm danh do giáo viên tích thủ công (manual) -> Không ghi đè
      if (attendance && attendance.attendanceType === 'manual') {
        savedResults.push(attendance);
        continue;
      }

      if (!attendance) {
        attendance = this.studentAttendanceRepository.create({
          studentId: student.id,
          classSessionId: res.classSessionId,
        });
      }

      attendance.isPresent = res.isPresent;
      attendance.attendanceType = res.attendanceType;
      attendance.verifyMethod = res.verifyMethod;
      attendance.isLate = res.isLate;
      attendance.lateMinutes = res.lateMinutes;
      attendance.note = res.note;

      console.log(`[ProcessRawLog] Saving attendance: studentId=${student.id}, sessionId=${res.classSessionId}, isPresent=${res.isPresent}, type=${res.attendanceType}, note=${res.note}`);
      const saved = await this.studentAttendanceRepository.save(attendance);
      console.log(`[ProcessRawLog] Attendance SAVED successfully: ID=${saved.id}, isPresent=${saved.isPresent}`);
      savedResults.push(saved);
    }

    // 8. Cập nhật các ca học đối khớp (matched_sessions) cho toàn bộ logs trong ngày của học sinh này
    for (const dbLog of dbLogs) {
      const t = getEventTimestamp(dbLog.eventTime);
      const matched = [];

      for (const s of domainSessions) {
        const sDateStr = getLocalDateString(s.date);
        const sessionStart = new Date(`${sDateStr}T${s.startTime}:00+07:00`).getTime();
        const sessionEnd = new Date(`${sDateStr}T${s.endTime}:00+07:00`).getTime();

        // Khoảng thời gian cho phép quẹt thẻ (+/- 1 tiếng)
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

      dbLog.matchedSessions = matched.length > 0 ? matched : null;
      await this.timekeepingLogRepository.save(dbLog);
      console.log(`[ProcessRawLog] Updated matched_sessions for log ID=${dbLog.id} (eventTime=${dbLog.eventTime.toISOString()}): ${JSON.stringify(dbLog.matchedSessions)}`);
    }

    return savedResults;
  }
}
