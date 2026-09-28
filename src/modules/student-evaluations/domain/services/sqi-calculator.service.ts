import {
  HomeworkStatus,
  ParticipationStatus,
  UnderstandingStatus,
  BehaviorTag,
} from '../entities/student-session-evaluation.entity';
import {
  SqiLevel,
  TrendDirection,
  SqiBreakdown,
  SubjectPerformance,
} from '../entities/weekly-student-report.entity';

export interface SessionEvaluationInput {
  classSessionId: string;
  subjectName: string;
  date?: string;
  isPresent: boolean;
  isLate?: boolean;
  homeworkStatus?: HomeworkStatus;
  participation?: ParticipationStatus;
  understanding?: UnderstandingStatus;
  behaviorTags?: BehaviorTag[];
  score?: string | null;
  teacherComment?: string | null;
}

export interface SqiCalculationResult {
  sqiScore: number;
  sqiDelta: number;
  level: SqiLevel;
  trend: TrendDirection;
  hasSessions: boolean;
  breakdown: SqiBreakdown;
  subjectPerformances: SubjectPerformance[];
}

export class SqiCalculator {
  public static calculate(
    sessions: SessionEvaluationInput[],
    previousDataOrSqi: SessionEvaluationInput[] | number | null = null,
  ): SqiCalculationResult {
    if (!sessions || sessions.length === 0) {
      return {
        sqiScore: 0,
        sqiDelta: 0,
        level: SqiLevel.LEVEL_1_WEAK,
        trend: TrendDirection.STABLE,
        hasSessions: false,
        breakdown: {
          academic: 0,
          progress: 0,
          competency: 0,
          attendance: 0,
          homework: 0,
          attitude: 0,
          behavior: 0,
        },
        subjectPerformances: [],
      };
    }

    let previousSessions: SessionEvaluationInput[] | null = null;
    let previousWeekSqi: number | null = null;

    if (Array.isArray(previousDataOrSqi)) {
      previousSessions = previousDataOrSqi;
      if (previousSessions.length > 0) {
        const prevRes = SqiCalculator.calculate(previousSessions, null);
        previousWeekSqi = prevRes.sqiScore;
      }
    } else if (typeof previousDataOrSqi === 'number') {
      previousWeekSqi = previousDataOrSqi;
    }

    const totalSessions = sessions.length;

    // 1. Chuyên cần (10%)
    let attendancePoints = 0;
    for (const s of sessions) {
      if (s.isPresent) {
        attendancePoints += s.isLate ? 0.7 : 1.0;
      } else {
        attendancePoints += 0.0;
      }
    }
    const attendanceScore = (attendancePoints / totalSessions) * 10;

    // 2. Bài tập về nhà (10%)
    let homeworkPoints = 0;
    for (const s of sessions) {
      if (s.homeworkStatus === HomeworkStatus.COMPLETED) {
        homeworkPoints += 1.0;
      } else if (s.homeworkStatus === HomeworkStatus.INCOMPLETE) {
        homeworkPoints += 0.5;
      } else {
        homeworkPoints += 0.0;
      }
    }
    const homeworkScore = (homeworkPoints / totalSessions) * 10;

    // 3. Thái độ học tập (10%)
    let attitudePoints = 0;
    for (const s of sessions) {
      if (s.participation === ParticipationStatus.ACTIVE) {
        attitudePoints += 1.0;
      } else {
        attitudePoints += 0.6;
      }
    }
    const attitudeScore = (attitudePoints / totalSessions) * 10;

    // 4. Kỹ năng & Hành vi (5%)
    let negativeViolations = 0;
    for (const s of sessions) {
      const tags = s.behaviorTags || [];
      for (const tag of tags) {
        if (
          tag === BehaviorTag.TALKATIVE ||
          tag === BehaviorTag.PHONE ||
          tag === BehaviorTag.DISTRACTED
        ) {
          negativeViolations += 1;
        }
      }
    }
    const behaviorScore = Math.max(0, 5 - negativeViolations);

    // 5. Năng lực tiếp thu (15%)
    let understoodCount = 0;
    for (const s of sessions) {
      if (s.understanding === UnderstandingStatus.UNDERSTOOD) {
        understoodCount += 1;
      }
    }
    const competencyScore = (understoodCount / totalSessions) * 15;

    // 6. Kết quả học tập (30%)
    let totalAcademicNorm = 0;
    for (const s of sessions) {
      if (s.score !== null && s.score !== undefined && s.score !== '') {
        const parsed = Number(String(s.score).replace(',', '.'));
        if (!isNaN(parsed)) {
          totalAcademicNorm += Math.min(Math.max(parsed / 10, 0), 1);
        } else {
          totalAcademicNorm += s.understanding === UnderstandingStatus.UNDERSTOOD ? 0.85 : 0.5;
        }
      } else {
        totalAcademicNorm += s.understanding === UnderstandingStatus.UNDERSTOOD ? 0.85 : 0.5;
      }
    }
    const academicScore = (totalAcademicNorm / totalSessions) * 30;

    // 7. Mức độ tiến bộ (20%)
    const baseSumWithoutProgress =
      attendanceScore + homeworkScore + attitudeScore + behaviorScore + competencyScore + academicScore;
    const normalizedCurrent = (baseSumWithoutProgress / 80) * 100;

    let progressScore = 16;
    let delta = 0;
    let trend = TrendDirection.STABLE;

    if (previousWeekSqi === null || previousWeekSqi === undefined) {
      progressScore = 16;
      delta = 0;
      trend = TrendDirection.NEW;
    } else {
      delta = normalizedCurrent - previousWeekSqi;
      if (delta >= 2.5) {
        progressScore = 20;
        trend = TrendDirection.UP;
      } else if (delta >= -2.5) {
        progressScore = 16;
        trend = TrendDirection.STABLE;
      } else if (delta >= -7.0) {
        progressScore = 12;
        trend = TrendDirection.DOWN;
      } else {
        progressScore = 8;
        trend = TrendDirection.DOWN;
      }
    }

    const totalSqi = Math.min(
      100,
      Math.max(
        0,
        Math.round(
          (academicScore +
            progressScore +
            competencyScore +
            attendanceScore +
            homeworkScore +
            attitudeScore +
            behaviorScore) *
            10,
        ) / 10,
      ),
    );

    // Tính điểm môn học tuần trước để so sánh chính xác
    const prevSubjectMap = new Map<string, { totalScore: number; count: number }>();
    if (previousSessions && previousSessions.length > 0) {
      for (const ps of previousSessions) {
        const name = ps.subjectName || 'Chung';
        const ex = prevSubjectMap.get(name) || { totalScore: 0, count: 0 };
        let sScore = 8.0;
        if (ps.score !== null && ps.score !== undefined && ps.score !== '') {
          const p = Number(String(ps.score).replace(',', '.'));
          if (!isNaN(p)) sScore = p;
        } else if (ps.understanding === UnderstandingStatus.NOT_UNDERSTOOD) {
          sScore = 5.5;
        }
        ex.totalScore += sScore;
        ex.count += 1;
        prevSubjectMap.set(name, ex);
      }
    }

    // Tính điểm theo từng môn tuần này
    const subjectMap = new Map<string, { totalScore: number; count: number; hasRealScore: boolean }>();
    for (const s of sessions) {
      const name = s.subjectName || 'Chung';
      const existing = subjectMap.get(name) || { totalScore: 0, count: 0, hasRealScore: false };
      let sessionScore = 8.0;
      if (s.score !== null && s.score !== undefined && s.score !== '') {
        const parsed = Number(String(s.score).replace(',', '.'));
        if (!isNaN(parsed)) {
          sessionScore = parsed;
          existing.hasRealScore = true;
        }
      } else if (s.understanding === UnderstandingStatus.NOT_UNDERSTOOD) {
        sessionScore = 5.5;
      }
      existing.totalScore += sessionScore;
      existing.count += 1;
      subjectMap.set(name, existing);
    }

    const subjectPerformances: SubjectPerformance[] = [];
    subjectMap.forEach((val, name) => {
      const avg = Math.round((val.totalScore / val.count) * 10) / 10;
      let subTrend = TrendDirection.STABLE;
      let scoreDelta: number | undefined = undefined;
      let prevAvg: number | null = null;

      const prevSub = prevSubjectMap.get(name);
      if (prevSub && prevSub.count > 0) {
        prevAvg = Math.round((prevSub.totalScore / prevSub.count) * 10) / 10;
        scoreDelta = Math.round((avg - prevAvg) * 10) / 10;
        if (scoreDelta > 0.1) {
          subTrend = TrendDirection.UP;
        } else if (scoreDelta < -0.1) {
          subTrend = TrendDirection.DOWN;
        } else {
          subTrend = TrendDirection.STABLE;
        }
      } else {
        subTrend = TrendDirection.NEW;
      }

      subjectPerformances.push({
        subjectName: name,
        score: avg,
        previousScore: prevAvg,
        trend: subTrend,
        scoreDelta,
        isEstimated: !val.hasRealScore,
      });
    });

    const breakdown: SqiBreakdown = {
      academic: Math.round(academicScore * 10) / 10,
      progress: Math.round(progressScore * 10) / 10,
      competency: Math.round(competencyScore * 10) / 10,
      attendance: Math.round(attendanceScore * 10) / 10,
      homework: Math.round(homeworkScore * 10) / 10,
      attitude: Math.round(attitudeScore * 10) / 10,
      behavior: Math.round(behaviorScore * 10) / 10,
    };

    let level = SqiLevel.LEVEL_1_WEAK;
    if (totalSqi >= 90) level = SqiLevel.LEVEL_5_EXCELLENT;
    else if (totalSqi >= 75) level = SqiLevel.LEVEL_4_GOOD;
    else if (totalSqi >= 60) level = SqiLevel.LEVEL_3_FAIR;
    else if (totalSqi >= 45) level = SqiLevel.LEVEL_2_AVERAGE;

    return {
      sqiScore: totalSqi,
      sqiDelta: Math.round(delta * 10) / 10,
      level,
      trend,
      hasSessions: true,
      breakdown,
      subjectPerformances,
    };
  }
}
