import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  IStudentWeeklyDataQueryPort,
  StudentBasicInfo,
} from '../../application/ports/student-weekly-data-query.port';
import {
  SessionEvaluationInput,
  SqiCalculator,
} from '../../domain/services/sqi-calculator.service';
import {
  HomeworkStatus,
  ParticipationStatus,
  UnderstandingStatus,
  BehaviorTag,
} from '../../domain/entities/student-session-evaluation.entity';
import { StudentOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import { ClassSessionOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { StudentAttendanceOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { StudentSessionEvaluationOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student-session-evaluation.orm-entity';
import { ClassStudentOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/class-student.orm-entity';
import { ClassOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/class.orm-entity';
import { TeacherOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/teacher.orm-entity';

@Injectable()
export class TypeOrmStudentWeeklyDataQueryAdapter implements IStudentWeeklyDataQueryPort {
  constructor(
    @InjectRepository(StudentOrmEntity)
    private readonly studentRepo: Repository<StudentOrmEntity>,
    @InjectRepository(ClassSessionOrmEntity)
    private readonly sessionRepo: Repository<ClassSessionOrmEntity>,
    @InjectRepository(StudentAttendanceOrmEntity)
    private readonly attendanceRepo: Repository<StudentAttendanceOrmEntity>,
    @InjectRepository(StudentSessionEvaluationOrmEntity)
    private readonly evalRepo: Repository<StudentSessionEvaluationOrmEntity>,
    @InjectRepository(ClassStudentOrmEntity)
    private readonly classStudentRepo: Repository<ClassStudentOrmEntity>,
    @InjectRepository(ClassOrmEntity)
    private readonly classRepo: Repository<ClassOrmEntity>,
    @InjectRepository(TeacherOrmEntity)
    private readonly teacherRepo: Repository<TeacherOrmEntity>,
  ) {}

  async getWeeklySessions(
    studentId: string,
    startDate: string,
    endDate: string,
  ): Promise<SessionEvaluationInput[]> {
    const enrollments = await this.classStudentRepo.find({
      where: { studentId, status: 'Active' },
    });
    if (!enrollments.length) return [];

    const classIds = enrollments.map((e) => e.classId);

    const sessions = await this.sessionRepo
      .createQueryBuilder('cs')
      .leftJoinAndSelect('cs.classEntity', 'c')
      .leftJoinAndSelect('c.course', 'course')
      .leftJoinAndSelect('c.courseLevel', 'courseLevel')
      .where('cs.class_id IN (:...classIds)', { classIds })
      .andWhere('cs.date >= :startDate AND cs.date <= :endDate', { startDate, endDate })
      .orderBy('cs.date', 'ASC')
      .addOrderBy('cs.start_time', 'ASC')
      .getMany();

    if (!sessions.length) return [];

    const sessionIds = sessions.map((s) => s.id);

    const [attendances, evaluations] = await Promise.all([
      this.attendanceRepo.find({
        where: {
          studentId,
          classSessionId: In(sessionIds),
        },
      }),
      this.evalRepo.find({
        where: {
          studentId,
          classSessionId: In(sessionIds),
        },
      }),
    ]);

    const attMap = new Map<string, StudentAttendanceOrmEntity>();
    for (const a of attendances) {
      attMap.set(a.classSessionId, a);
    }

    const evalMap = new Map<string, StudentSessionEvaluationOrmEntity>();
    for (const e of evaluations) {
      evalMap.set(e.classSessionId, e);
    }

    // Chỉ tính các buổi học đã/đang diễn ra hoặc đã có ghi nhận điểm danh/đánh giá
    // Tránh tính các buổi 'Scheduled' trong tương lai làm học sinh bị 0% chuyên cần và trừ điểm oan
    const activeSessions = sessions.filter((s) => {
      const hasEval = evalMap.has(s.id);
      const hasAtt = attMap.has(s.id);
      const isPastOrCurrent = s.status === 'Completed' || s.status === 'In-Progress';
      return isPastOrCurrent || hasEval || (hasAtt && attMap.get(s.id)?.isPresent);
    });

    if (!activeSessions.length) return [];

    return activeSessions.map((s) => {
      const att = attMap.get(s.id);
      const ev = evalMap.get(s.id);

      const isPresent = att ? att.isPresent : false;
      const isLate = att ? att.isLate : false;
      
      const levelName = s.classEntity?.courseLevel?.levelName?.trim() || '';
      let courseName = (s.classEntity?.course?.name || '').replace(/^Học phí\s+/i, '').trim();

      let subjectName = 'Môn học chung';
      if (courseName && levelName) {
        subjectName = `${courseName} - ${levelName}`;
      } else if (levelName) {
        subjectName = levelName;
      } else if (courseName) {
        subjectName = courseName;
      } else if (s.classEntity?.className) {
        subjectName = s.classEntity.className;
      }

      // Không có evaluation record → undefined, KHÔNG được tự gán mặc định
      const homeworkStatus: HomeworkStatus | undefined = ev?.homeworkStatus
        ? (ev.homeworkStatus as HomeworkStatus)
        : undefined;

      const participation: ParticipationStatus | undefined = ev?.participation
        ? (ev.participation as ParticipationStatus)
        : undefined;

      const understanding: UnderstandingStatus | undefined = ev?.understanding
        ? (ev.understanding as UnderstandingStatus)
        : undefined;

      const behaviorTags: BehaviorTag[] = (ev?.behaviorTags || []) as BehaviorTag[];
      const score = ev?.score || att?.evaluationScore || null;
      const teacherComment = ev?.comment || att?.evaluationComment || null;

      const attendanceStatus =
        (att as any)?.status ||
        (att as any)?.attendanceStatus ||
        (att?.reason && ['on_time', 'makeup', 'late', 'early_leave', 'late_much', 'absent_excused', 'absent_unexcused'].includes(att.reason) ? att.reason : undefined) ||
        (isPresent ? (isLate ? 'late' : 'on_time') : 'absent_unexcused');

      return {
        classSessionId: s.id,
        className: s.classEntity?.className || s.classEntity?.classCode || '',
        subjectName,
        date: s.date ? new Date(s.date).toISOString().split('T')[0] : '',
        isPresent,
        isLate,
        attendanceStatus,
        homeworkStatus,
        participation,
        understanding,
        behaviorTags,
        score,
        teacherComment,
      };
    });
  }

  async getPreviousWeekSqi(
    studentId: string,
    weekNumber: number,
    year: number,
  ): Promise<number | null> {
    try {
      const { startDate, endDate } = this.getWeekDateRange(weekNumber, year);
      const prevSessions = await this.getWeeklySessions(studentId, startDate, endDate);
      if (!prevSessions.length) return null;
      const prevResult = SqiCalculator.calculate(prevSessions, null);
      return prevResult.sqiScore;
    } catch {
      return null;
    }
  }

  async verifyStudentOwnership(requestUserId: string, studentId: string): Promise<boolean> {
    if (!requestUserId || !studentId) return false;
    const student = await this.studentRepo.findOne({
      where: { id: studentId, userId: requestUserId },
    });
    return !!student;
  }

  async getStudentInfo(studentId: string): Promise<StudentBasicInfo | null> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId },
    });
    if (!student) return null;
    return {
      id: student.id,
      name: `${student.lastName || ''} ${student.firstName || ''}`.trim(),
      code: student.studentId,
    };
  }

  async getClassStudents(classId: string): Promise<StudentBasicInfo[]> {
    const enrollments = await this.classStudentRepo
      .createQueryBuilder('cs')
      .leftJoinAndSelect('cs.student', 's')
      .where('cs.class_id = :classId AND cs.status = :status', {
        classId,
        status: 'Active',
      })
      .orderBy('s.last_name', 'ASC')
      .addOrderBy('s.first_name', 'ASC')
      .getMany();

    return enrollments
      .filter((e) => e.student)
      .map((e) => ({
        id: e.student.id,
        name: `${e.student.lastName || ''} ${e.student.firstName || ''}`.trim(),
        code: e.student.studentId,
      }));
  }

  async verifyTeacherClassAccess(teacherUserId: string, classId: string): Promise<boolean> {
    const teacher = await this.teacherRepo.findOne({
      where: { userId: teacherUserId },
    });
    if (!teacher) return false;

    const classEntity = await this.classRepo.findOne({
      where: { id: classId },
    });
    if (!classEntity) return false;

    return (
      classEntity.mainTeacherId === teacher.id ||
      classEntity.assistantId === teacher.id
    );
  }

  async getClassName(classId: string): Promise<string | null> {
    const classEntity = await this.classRepo.findOne({
      where: { id: classId },
      select: { className: true },
    });
    return classEntity ? classEntity.className : null;
  }

  private getWeekDateRange(
    weekNumber: number,
    year: number,
  ): { startDate: string; endDate: string } {
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = jan4.getUTCDay() || 7;
    const week1Monday = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000);
    const targetMonday = new Date(week1Monday.getTime() + (weekNumber - 1) * 7 * 86400000);
    const targetSunday = new Date(targetMonday.getTime() + 6 * 86400000);

    const format = (d: Date) => d.toISOString().split('T')[0];
    return {
      startDate: format(targetMonday),
      endDate: format(targetSunday),
    };
  }
}
