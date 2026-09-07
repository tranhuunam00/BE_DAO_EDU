import { SqiCalculator } from '../../domain/services/sqi-calculator.service';
import { SqiLevel, TrendDirection } from '../../domain/entities/weekly-student-report.entity';
import { IStudentWeeklyDataQueryPort } from '../ports/student-weekly-data-query.port';

export interface GetClassWeeklyReportsInput {
  classId: string;
  weekNumber: number;
  year: number;
  requestUserId: string;
  userRole: string;
}

export interface StudentWeeklySummary {
  studentId: string;
  studentName: string;
  studentCode: string;
  sqiScore: number;
  sqiDelta: number;
  level: SqiLevel;
  trend: TrendDirection;
  hasSessions: boolean;
  attendanceRate: number;
  homeworkRate: number;
}

export interface GetClassWeeklyReportsOutput {
  classId: string;
  className: string;
  weekNumber: number;
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
    const { classId, weekNumber, year, requestUserId, userRole } = input;

    if (!classId || !classId.trim()) {
      throw new Error('classId không được để trống');
    }

    // 1. Kiểm tra phân quyền: Nếu là Teacher thì phải phụ trách lớp này
    if (userRole === 'TEACHER') {
      const hasAccess = await this.queryPort.verifyTeacherClassAccess(requestUserId, classId);
      if (!hasAccess) {
        throw new Error('Bạn không có quyền xem báo cáo của lớp học này');
      }
    }

    const className = (await this.queryPort.getClassName(classId)) || 'Lớp học';
    const { startDate, endDate } = this.getWeekDateRange(weekNumber, year);

    // 2. Lấy danh sách học sinh đang học trong lớp
    const enrolledStudents = await this.queryPort.getClassStudents(classId);

    if (!enrolledStudents.length) {
      return {
        classId,
        className,
        weekNumber,
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
    const previousWeek = weekNumber === 1 ? 52 : weekNumber - 1;
    const previousYear = weekNumber === 1 ? year - 1 : year;

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
      const [sessions, prevSqi] = await Promise.all([
        this.queryPort.getWeeklySessions(student.id, startDate, endDate),
        this.queryPort.getPreviousWeekSqi(student.id, previousWeek, previousYear),
      ]);

      const sqiResult = SqiCalculator.calculate(sessions, prevSqi);

      // Tính tỉ lệ điểm danh và BTVN
      let attendanceRate = 0;
      let homeworkRate = 0;
      if (sessions.length > 0) {
        const presentCount = sessions.filter((s) => s.isPresent).length;
        attendanceRate = Math.round((presentCount / sessions.length) * 100);

        const doneHwCount = sessions.filter((s) => s.homeworkStatus === 'completed').length;
        homeworkRate = Math.round((doneHwCount / sessions.length) * 100);
      }

      if (sqiResult.hasSessions) {
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
        sqiScore: sqiResult.sqiScore,
        sqiDelta: sqiResult.sqiDelta,
        level: sqiResult.level,
        trend: sqiResult.trend,
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
