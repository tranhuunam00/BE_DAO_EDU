import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import dayjs from 'dayjs';
import {
  IStudentProfileContextQueryPort,
} from '../../application/ports/student-profile-context-query.port';
import {
  ParentAiChatContext,
  StudentRecentSessionSummary,
} from '../../application/ports/parent-ai-chat.port';
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

@Injectable()
export class TypeOrmStudentProfileContextAdapter implements IStudentProfileContextQueryPort {
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
  ) {}

  async validateParentStudentOwnership(
    userId: string,
    studentId: string,
  ): Promise<boolean> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, userId },
    });
    return !!student;
  }

  async getDefaultStudentForUser(userId: string): Promise<{
    studentId: string;
    studentName: string;
  } | null> {
    const student = await this.studentRepo.findOne({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
    if (!student) return null;
    return {
      studentId: student.id,
      studentName: `${student.lastName} ${student.firstName}`.trim(),
    };
  }

  async getStudentProfileContext(
    studentId: string,
    limitWeeks: number = 4,
  ): Promise<ParentAiChatContext> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId },
    });
    const studentName = student
      ? `${student.lastName} ${student.firstName}`.trim()
      : 'Học sinh';

    const enrollments = await this.classStudentRepo.find({
      where: { studentId, status: 'Active' },
      relations: { classEntity: true },
    });
    const className = enrollments[0]?.classEntity?.className || undefined;
    const classIds = enrollments.map((e) => e.classId);

    if (!classIds.length) {
      return this.buildEmptyContext(studentId, studentName, className);
    }

    const startDate = dayjs().subtract(limitWeeks * 7, 'day').format('YYYY-MM-DD');
    const endDate = dayjs().format('YYYY-MM-DD');

    const sessions = await this.sessionRepo
      .createQueryBuilder('cs')
      .leftJoinAndSelect('cs.classEntity', 'c')
      .leftJoinAndSelect('c.course', 'course')
      .where('cs.class_id IN (:...classIds)', { classIds })
      .andWhere('cs.date >= :startDate AND cs.date <= :endDate', { startDate, endDate })
      .orderBy('cs.date', 'DESC')
      .getMany();

    if (!sessions.length) {
      return this.buildEmptyContext(studentId, studentName, className);
    }

    const sessionIds = sessions.map((s) => s.id);
    const [attendances, evaluations] = await Promise.all([
      this.attendanceRepo
        .createQueryBuilder('sa')
        .where('sa.student_id = :studentId', { studentId })
        .andWhere('sa.class_session_id IN (:...sessionIds)', { sessionIds })
        .getMany(),
      this.evalRepo
        .createQueryBuilder('se')
        .where('se.student_id = :studentId', { studentId })
        .andWhere('se.class_session_id IN (:...sessionIds)', { sessionIds })
        .getMany(),
    ]);

    const attMap = new Map<string, StudentAttendanceOrmEntity>();
    for (const a of attendances) attMap.set(a.classSessionId, a);

    const evalMap = new Map<string, StudentSessionEvaluationOrmEntity>();
    for (const e of evaluations) evalMap.set(e.classSessionId, e);

    const validSessions = sessions.filter((s) => {
      const isDone = s.status === 'Completed' || s.status === 'In-Progress';
      return isDone || evalMap.has(s.id) || (attMap.has(s.id) && attMap.get(s.id)?.isPresent);
    });

    const recentSessionSummaries: StudentRecentSessionSummary[] = [];
    const sqiInputs: SessionEvaluationInput[] = [];
    let presentCount = 0;
    let homeworkDoneCount = 0;
    let homeworkTotal = 0;
    const strengthsSet = new Set<string>();
    const weaknessesSet = new Set<string>();

    for (const s of validSessions) {
      const att = attMap.get(s.id);
      const ev = evalMap.get(s.id);
      const isPresent = att ? att.isPresent : (ev ? true : false);
      const courseName = s.classEntity?.course?.name || s.classEntity?.className || 'Môn học';

      if (isPresent) presentCount++;

      let hwStatus: string | undefined;
      if (ev?.homeworkStatus) {
        hwStatus = ev.homeworkStatus === HomeworkStatus.COMPLETED ? 'Đã làm' : 'Chưa làm';
        homeworkTotal++;
        if (ev.homeworkStatus === HomeworkStatus.COMPLETED) {
          homeworkDoneCount++;
          strengthsSet.add('Chăm chỉ hoàn thành bài tập về nhà');
        } else {
          weaknessesSet.add('Chưa hoàn thành đầy đủ bài tập về nhà');
        }
      }

      if (ev?.understanding) {
        if (ev.understanding === UnderstandingStatus.UNDERSTOOD) {
          strengthsSet.add('Tiếp thu nhanh, hiểu bài tốt trên lớp');
        } else if (ev.understanding === UnderstandingStatus.NOT_UNDERSTOOD) {
          weaknessesSet.add('Cần giáo viên giảng kỹ lại hoặc kèm thêm bài tập cơ bản');
        }
      }

      if (ev?.participation === ParticipationStatus.ACTIVE) {
        strengthsSet.add('Hăng hái phát biểu, tích cực tương tác');
      }

      if (ev?.behaviorTags) {
        if (ev.behaviorTags.includes(BehaviorTag.TALKATIVE)) {
          weaknessesSet.add('Còn nói chuyện riêng trong giờ học');
        }
        if (ev.behaviorTags.includes(BehaviorTag.DISTRACTED)) {
          weaknessesSet.add('Thỉnh thoảng mất tập trung hoặc làm việc riêng');
        }
      }

      const teacherComment = ev?.comment || att?.evaluationComment || null;
      const score = ev?.score || att?.evaluationScore || null;

      recentSessionSummaries.push({
        date: s.date,
        subject: courseName,
        isPresent,
        homeworkStatus: hwStatus,
        understanding: ev?.understanding || undefined,
        behaviorTags: ev?.behaviorTags || undefined,
        score,
        teacherComment,
      });

      sqiInputs.push({
        classSessionId: s.id,
        subjectName: courseName,
        date: s.date,
        isPresent,
        homeworkStatus: ev?.homeworkStatus as HomeworkStatus | undefined,
        participation: ev?.participation as ParticipationStatus | undefined,
        understanding: ev?.understanding as UnderstandingStatus | undefined,
        behaviorTags: ev?.behaviorTags as BehaviorTag[] | undefined,
        score: score || undefined,
        teacherComment: teacherComment || undefined,
      });
    }

    const totalSessions = validSessions.length;
    const attendanceRatePercent = totalSessions > 0
      ? Math.round((presentCount / totalSessions) * 100)
      : 100;
    const homeworkCompletionPercent = homeworkTotal > 0
      ? Math.round((homeworkDoneCount / homeworkTotal) * 100)
      : 100;

    const sqiResult = SqiCalculator.calculate(sqiInputs);

    return {
      studentId,
      studentName,
      className,
      currentSqiScore: sqiResult.sqiScore,
      sqiTrend: sqiResult.sqiScore >= 80 ? 'up' : sqiResult.sqiScore >= 65 ? 'stable' : 'down',
      attendanceRatePercent,
      homeworkCompletionPercent,
      averageScore: sqiResult.sqiScore ? parseFloat((sqiResult.sqiScore / 10).toFixed(1)) : null,
      strengths: Array.from(strengthsSet).slice(0, 4),
      weaknesses: Array.from(weaknessesSet).slice(0, 4),
      recentSessions: recentSessionSummaries.slice(0, 10),
    };
  }

  private buildEmptyContext(
    studentId: string,
    studentName: string,
    className?: string,
  ): ParentAiChatContext {
    return {
      studentId,
      studentName,
      className,
      currentSqiScore: 80,
      sqiTrend: 'stable',
      attendanceRatePercent: 100,
      homeworkCompletionPercent: 100,
      averageScore: null,
      strengths: ['Đang bắt đầu lộ trình học tập tại trung tâm'],
      weaknesses: [],
      recentSessions: [],
    };
  }
}
