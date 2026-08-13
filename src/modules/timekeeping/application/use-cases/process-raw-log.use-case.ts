import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';
import { StudentOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import { StudentAttendanceOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { ClassSessionOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { TimekeepingLogOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/timekeeping-log.orm-entity';
import { TeacherOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/teacher.orm-entity';
import { TimekeepingMatcher, DomainClassSession, TimekeepingLog, normalizeEmployeeNo, parseTimekeepingCode } from '../../domain/services/timekeeping-matcher';

@Injectable()
export class ProcessRawLogUseCase {
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

    // 1. Phân loại theo tiền tố sử dụng hàm tiện ích parseTimekeepingCode
    const parsed = parseTimekeepingCode(studentCode);
    let finalEmployeeNo = parsed.normalizedCode;

    if (parsed.type === 'student') {
      student = await this.studentRepository.createQueryBuilder('student')
        .where("LTRIM(REGEXP_REPLACE(student.studentId, '\\D', '', 'g'), '0') = :code", { code: finalEmployeeNo })
        .getOne();
    } else if (parsed.type === 'teacher') {
      const codes = parsed.candidates && parsed.candidates.length > 0 ? parsed.candidates : [finalEmployeeNo];
      teacher = await this.teacherRepository.createQueryBuilder('teacher')
        .where("LTRIM(REGEXP_REPLACE(teacher.teacherId, '\\D', '', 'g'), '0') IN (:...codes)", { codes })
        .getOne();
      if (teacher) {
        finalEmployeeNo = normalizeEmployeeNo(teacher.teacherId);
      }
    } else {
      // Fallback tương thích ngược không có tiền tố
      student = await this.studentRepository.createQueryBuilder('student')
        .where("LTRIM(REGEXP_REPLACE(student.studentId, '\\D', '', 'g'), '0') = :code", { code: finalEmployeeNo })
        .getOne();
      
      if (!student) {
        teacher = await this.teacherRepository.createQueryBuilder('teacher')
          .where("LTRIM(REGEXP_REPLACE(teacher.teacherId, '\\D', '', 'g'), '0') = :code", { code: finalEmployeeNo })
          .getOne();
      }
    }

    // 2. Ghi nhận nhật ký thô và chống trùng lặp qua DB Unique constraint
    try {
      await this.timekeepingLogRepository.createQueryBuilder()
        .insert()
        .values({
          studentId: student ? student.id : null,
          teacherId: teacher ? teacher.id : null,
          employeeNo: finalEmployeeNo,
          eventTime,
          verifyMethod,
          rawPayload,
          originalId,
          imageKey,
        })
        .orIgnore() // ON CONFLICT DO NOTHING
        .execute();
    } catch (err) {
      // Bỏ qua nếu có lỗi trùng lặp ràng buộc duy nhất
    }

    if (teacher) {
      // Nếu là giáo viên, chỉ ghi log và không chạy đối khớp ca học của học sinh
      return [];
    }

    if (!student) {
      return [];
    }

    // 3. Tính toán khung ngày học của lượt quẹt (múi giờ +07:00)
    const offset = 7 * 60 * 60 * 1000;
    const localTime = new Date(eventTime.getTime() + offset);
    const dateString = localTime.toISOString().substring(0, 10);

    const startOfDay = new Date(`${dateString}T00:00:00+07:00`);
    const endOfDay = new Date(`${dateString}T23:59:59+07:00`);

    // 4. Lấy tất cả nhật ký quẹt thẻ trong ngày của học sinh này
    const dbLogs = await this.timekeepingLogRepository.find({
      where: {
        studentId: student.id,
        eventTime: Between(startOfDay, endOfDay)
      }
    });

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

    // 6. Chạy thuật toán đối khớp của tầng Domain
    const matchResults = TimekeepingMatcher.match(student.id, domainSessions, domainLogs);

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

      const saved = await this.studentAttendanceRepository.save(attendance);
      savedResults.push(saved);
    }

    // 8. Cập nhật các ca học đối khớp (matched_sessions) cho toàn bộ logs trong ngày của học sinh này
    for (const dbLog of dbLogs) {
      const t = dbLog.eventTime.getTime();
      const matched = [];

      for (const s of domainSessions) {
        const sessionStart = new Date(`${s.date}T${s.startTime}:00+07:00`).getTime();
        const sessionEnd = new Date(`${s.date}T${s.endTime}:00+07:00`).getTime();

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
    }

    return savedResults;
  }
}
