import { SqiCalculator } from '../../domain/services/sqi-calculator.service';
import { SqiLevel, TrendDirection } from '../../domain/entities/weekly-student-report.entity';
import { IStudentWeeklyDataQueryPort } from '../ports/student-weekly-data-query.port';

export interface GetClassWeeklyReportsInput {
  classId: string;
  weekNumber?: number;
  month?: number;
  year: number;
  requestUserId?: string;
  userRole?: string;
}

export interface StudentWeeklySummary {
  studentId: string;
  studentName: string;
  studentCode: string;
  sqiScore: number | null;
  sqiDelta: number | null;
  level: SqiLevel | null;
  trend: TrendDirection;
  hasSessions: boolean;
  attendanceRate: number | null;
  homeworkRate: number | null;
}

export interface GetClassWeeklyReportsOutput {
  classId: string;
  className: string;
  weekNumber?: number;
  month?: number;
  year: number;
  startDate: string;
  endDate: string;
  averageSqi: number;
  totalStudents: number;
  levelDistribution: {
    level5: number;
    level4: number;
    level3: number;
    level2: number;
    level1: number;
  };
  students: StudentWeeklySummary[];
}

export class GetClassWeeklyReportsUseCase {
  constructor(private readonly queryPort: IStudentWeeklyDataQueryPort) {}

  async execute(input: GetClassWeeklyReportsInput): Promise<GetClassWeeklyReportsOutput> {
    const { classId, weekNumber, month, year, requestUserId, userRole } = input;

    if (!classId || !classId.trim()) {
      throw new Error('classId không được để trống');
    }

    // 1. Kiểm tra phân quyền: Nếu là Teacher thì phải phụ trách lớp này
    if (userRole === 'TEACHER' && requestUserId) {
      const hasAccess = await this.queryPort.verifyTeacherClassAccess(requestUserId, classId);
      if (!hasAccess) {
        throw new Error('Bạn không có quyền xem báo cáo của lớp học này');
      }
    }

    const className = (await this.queryPort.getClassName(classId)) || 'Lớp học';

    const isMonthly = typeof month === 'number' && month >= 1 && month <= 12;
    let startDate: string;
    let endDate: string;
    let prevStart: string;
    let prevEnd: string;
    let previousPeriodNumber = 0;
    let previousYear = year;

    if (isMonthly) {
      const paddedMonth = String(month).padStart(2, '0');
      const lastDay = new Date(year, month, 0).getDate();
      startDate = `${year}-${paddedMonth}-01`;
      endDate = `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`;

      const prevMonth = month === 1 ? 12 : month - 1;
      previousYear = month === 1 ? year - 1 : year;
      const prevLastDay = new Date(previousYear, prevMonth, 0).getDate();
      prevStart = `${previousYear}-${String(prevMonth).padStart(2, '0')}-01`;
      prevEnd = `${previousYear}-${String(prevMonth).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`;
      previousPeriodNumber = prevMonth;
    } else {
      const validWeek = weekNumber || 1;
      const currentRange = this.getWeekDateRange(validWeek, year);
      startDate = currentRange.startDate;
      endDate = currentRange.endDate;

      const previousWeek = validWeek === 1 ? 52 : validWeek - 1;
      previousYear = validWeek === 1 ? year - 1 : year;
      const prevRange = this.getWeekDateRange(previousWeek, previousYear);
      prevStart = prevRange.startDate;
      prevEnd = prevRange.endDate;
      previousPeriodNumber = previousWeek;
    }

    // 2. Lấy danh sách học sinh đang học trong lớp
    const enrolledStudents = await this.queryPort.getClassStudents(classId);

    if (!enrolledStudents.length) {
      return {
        classId,
        className,
        weekNumber,
        month,
        year,
        startDate,
        endDate,
        averageSqi: 0,
        totalStudents: 0,
        levelDistribution: { level5: 0, level4: 0, level3: 0, level2: 0, level1: 0 },
        students: [],
      };
    }

    // 3. Tính toán SQI cho từng học sinh trong lớp (PURE QUERY - ZERO MUTATION)
    const studentSummaries: StudentWeeklySummary[] = [];
    let totalSqiSum = 0;
    let validStudentCount = 0;

    const levelDist = {
      level5: 0,
      level4: 0,
      level3: 0,
      level2: 0,
      level1: 0,
    };

    for (const student of enrolledStudents) {
      const [sessions, prevSessions, prevSqi] = await Promise.all([
        this.queryPort.getWeeklySessions(student.id, startDate, endDate),
        this.queryPort.getWeeklySessions(student.id, prevStart, prevEnd),
        this.queryPort.getPreviousWeekSqi(student.id, previousPeriodNumber, previousYear),
      ]);

      const sqiResult = SqiCalculator.calculate(
        sessions,
        prevSessions.length > 0 ? prevSessions : prevSqi,
      );

      // Tính tỉ lệ điểm danh và BTVN
      let attendanceRate: number | null = null;
      let homeworkRate: number | null = null;
      if (sessions.length > 0) {
        const presentCount = sessions.filter((s) => s.isPresent).length;
        attendanceRate = Math.round((presentCount / sessions.length) * 100);

        const sessionsWithHw = sessions.filter(
          (s) => Boolean(s.homeworkStatus),
        );
        if (sessionsWithHw.length > 0) {
          const doneHwCount = sessionsWithHw.filter((s) => s.homeworkStatus === 'completed').length;
          homeworkRate = Math.round((doneHwCount / sessionsWithHw.length) * 100);
        }
      }

      if (sqiResult.hasSessions && sqiResult.sqiScore !== null) {
        totalSqiSum += sqiResult.sqiScore;
        validStudentCount += 1;

        if (sqiResult.level === SqiLevel.LEVEL_5_EXCELLENT) levelDist.level5 += 1;
        else if (sqiResult.level === SqiLevel.LEVEL_4_GOOD) levelDist.level4 += 1;
        else if (sqiResult.level === SqiLevel.LEVEL_3_FAIR) levelDist.level3 += 1;
        else if (sqiResult.level === SqiLevel.LEVEL_2_AVERAGE) levelDist.level2 += 1;
        else levelDist.level1 += 1;
      }

      studentSummaries.push({
        studentId: student.id,
        studentName: student.name,
        studentCode: student.code,
        sqiScore: sqiResult.hasSessions ? sqiResult.sqiScore : null,
        sqiDelta: sqiResult.hasSessions ? sqiResult.sqiDelta : null,
        level: sqiResult.hasSessions ? sqiResult.level : null,
        trend: sqiResult.hasSessions ? sqiResult.trend : TrendDirection.STABLE,
        hasSessions: sqiResult.hasSessions,
        attendanceRate,
        homeworkRate,
      });
    }

    const averageSqi =
      validStudentCount > 0 ? Math.round((totalSqiSum / validStudentCount) * 10) / 10 : 0;

    return {
      classId,
      className,
      weekNumber,
      month,
      year,
      startDate,
      endDate,
      averageSqi,
      totalStudents: enrolledStudents.length,
      levelDistribution: levelDist,
      students: studentSummaries,
    };
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
