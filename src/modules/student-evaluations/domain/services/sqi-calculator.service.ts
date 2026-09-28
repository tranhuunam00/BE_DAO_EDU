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
  className?: string;
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
          academic: null,
          progress: null,
          competency: null,
          attendance: null,
          homework: null,
          attitude: null,
          behavior: null,
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

    // 1. Chuyên cần (10%) - Chỉ tính Có mặt (1.0) vs Vắng (0.0)
    let presentCount = 0;
    for (const s of sessions) {
      if (s.isPresent) {
        presentCount += 1.0;
      }
    }
    const attendanceScore = totalSessions > 0 ? (presentCount / totalSessions) * 10 : null;

    // 2. Bài tập về nhà (10%) - Không có thì để null (hiển thị -)
    const hwSessions = sessions.filter(
      (s) => s.homeworkStatus !== undefined && s.homeworkStatus !== null,
    );
    let homeworkScore: number | null = null;
    if (hwSessions.length > 0) {
      let hwPoints = 0;
      for (const s of hwSessions) {
        if (s.homeworkStatus === HomeworkStatus.COMPLETED) {
          hwPoints += 1.0;
        } else if (s.homeworkStatus === HomeworkStatus.INCOMPLETE) {
          hwPoints += 0.5;
        } else {
          hwPoints += 0.0;
        }
      }
      homeworkScore = (hwPoints / hwSessions.length) * 10;
    }

    // 3. Thái độ học tập (10%) - Không có thì để null (hiển thị -)
    const attSessions = sessions.filter(
      (s) => s.participation !== undefined && s.participation !== null,
    );
    let attitudeScore: number | null = null;
    if (attSessions.length > 0) {
      let attPoints = 0;
      for (const s of attSessions) {
        if (s.participation === ParticipationStatus.ACTIVE) {
          attPoints += 1.0;
        } else {
          attPoints += 0.5;
        }
      }
      attitudeScore = (attPoints / attSessions.length) * 10;
    }

    // 4. Kỹ năng & Hành vi / Kỷ luật (5%) - Không có thì để null (hiển thị -)
    const behaviorSessions = sessions.filter(
      (s) => Array.isArray(s.behaviorTags) && s.behaviorTags.length > 0,
    );
    let behaviorScore: number | null = null;
    if (behaviorSessions.length > 0) {
      let negativeViolations = 0;
      for (const s of behaviorSessions) {
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
      behaviorScore = Math.max(0, 5 - negativeViolations);
    }

    // 5. Năng lực tiếp thu (15%) - Không có thì để null (hiển thị -)
    const compSessions = sessions.filter(
      (s) => s.understanding !== undefined && s.understanding !== null,
    );
    let competencyScore: number | null = null;
    if (compSessions.length > 0) {
      let understoodCount = 0;
      for (const s of compSessions) {
        if (s.understanding === UnderstandingStatus.UNDERSTOOD) {
          understoodCount += 1.0;
        } else if ((s.understanding as any) === 'partially') {
          understoodCount += 0.5;
        } else {
          understoodCount += 0.0;
        }
      }
      competencyScore = (understoodCount / compSessions.length) * 15;
    }

    // 6. Kết quả học tập (30%) - Chỉ tính khi có điểm số thực tế
    const acadSessions = sessions.filter(
      (s) =>
        s.score !== null &&
        s.score !== undefined &&
        String(s.score).trim() !== '' &&
        !isNaN(Number(String(s.score).replace(',', '.'))),
    );
    let academicScore: number | null = null;
    if (acadSessions.length > 0) {
      let totalNorm = 0;
      for (const s of acadSessions) {
        const parsed = Number(String(s.score).replace(',', '.'));
        totalNorm += Math.min(Math.max(parsed / 10, 0), 1);
      }
      academicScore = (totalNorm / acadSessions.length) * 30;
    }

    // 7. Mức độ tiến bộ (20%) - So sánh với kỳ trước nếu có
    let progressScore: number | null = null;
    let delta = 0;
    let trend = TrendDirection.STABLE;

    if (previousWeekSqi !== null && previousWeekSqi !== undefined) {
      let currentBaseSum = 0;
      let currentBaseWeight = 0;
      if (attendanceScore !== null) { currentBaseSum += attendanceScore; currentBaseWeight += 10; }
      if (homeworkScore !== null) { currentBaseSum += homeworkScore; currentBaseWeight += 10; }
      if (attitudeScore !== null) { currentBaseSum += attitudeScore; currentBaseWeight += 10; }
      if (behaviorScore !== null) { currentBaseSum += behaviorScore; currentBaseWeight += 5; }
      if (competencyScore !== null) { currentBaseSum += competencyScore; currentBaseWeight += 15; }
      if (academicScore !== null) { currentBaseSum += academicScore; currentBaseWeight += 30; }

      if (currentBaseWeight > 0) {
        const normalizedCurrent = (currentBaseSum / currentBaseWeight) * 100;
        delta = Math.round((normalizedCurrent - previousWeekSqi) * 10) / 10;
        if (delta >= 2.5) {
          progressScore = 20;
          trend = TrendDirection.UP;
        } else if (delta >= -2.5) {
          progressScore = normalizedCurrent >= 90 ? 20 : 16;
          trend = TrendDirection.STABLE;
        } else if (delta >= -7.0) {
          progressScore = 12;
          trend = TrendDirection.DOWN;
        } else {
          progressScore = 8;
          trend = TrendDirection.DOWN;
        }
      }
    } else {
      trend = TrendDirection.NEW;
    }

    // 8. TÍNH ĐIỂM SQI TỔNG HỢP: CHỈ TÍNH TRÊN NHỮNG TIÊU CHÍ ĐÃ CÓ DỮ LIỆU
    let totalWeightedPoints = 0;
    let totalAvailableWeight = 0;

    if (attendanceScore !== null) {
      totalWeightedPoints += attendanceScore;
      totalAvailableWeight += 10;
    }
    if (homeworkScore !== null) {
      totalWeightedPoints += homeworkScore;
      totalAvailableWeight += 10;
    }
    if (attitudeScore !== null) {
      totalWeightedPoints += attitudeScore;
      totalAvailableWeight += 10;
    }
    if (behaviorScore !== null) {
      totalWeightedPoints += behaviorScore;
      totalAvailableWeight += 5;
    }
    if (competencyScore !== null) {
      totalWeightedPoints += competencyScore;
      totalAvailableWeight += 15;
    }
    if (academicScore !== null) {
      totalWeightedPoints += academicScore;
      totalAvailableWeight += 30;
    }
    if (progressScore !== null) {
      totalWeightedPoints += progressScore;
      totalAvailableWeight += 20;
    }

    const totalSqi = totalAvailableWeight > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round((totalWeightedPoints / totalAvailableWeight) * 100 * 10) / 10,
          ),
        )
      : 0;

    // Tính điểm môn học tuần trước để so sánh chính xác
    const prevSubjectMap = new Map<string, { totalScore: number; count: number }>();
    if (previousSessions && previousSessions.length > 0) {
      for (const ps of previousSessions) {
        const name = ps.subjectName || 'Chung';
        const ex = prevSubjectMap.get(name) || { totalScore: 0, count: 0 };
        // Chỉ tính khi có điểm thực tế, KHÔNG bịa mặc định
        if (ps.score !== null && ps.score !== undefined && ps.score !== '') {
          const p = Number(String(ps.score).replace(',', '.'));
          if (!isNaN(p)) {
            ex.totalScore += p;
            ex.count += 1;
            prevSubjectMap.set(name, ex);
          }
        }
      }
    }

    // Tính điểm theo từng môn tuần này
    const subjectMap = new Map<string, { totalScore: number; count: number; hasRealScore: boolean }>();
    for (const s of sessions) {
      const name = s.subjectName || 'Chung';
      const existing = subjectMap.get(name) || { totalScore: 0, count: 0, hasRealScore: false };
      // Chỉ tính khi có điểm thực tế, KHÔNG bịa mặc định
      if (s.score !== null && s.score !== undefined && s.score !== '') {
        const parsed = Number(String(s.score).replace(',', '.'));
        if (!isNaN(parsed)) {
          existing.totalScore += parsed;
          existing.count += 1;
          existing.hasRealScore = true;
          subjectMap.set(name, existing);
        }
      }
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
      academic: academicScore !== null ? Math.round(academicScore * 10) / 10 : null,
      progress: progressScore !== null ? Math.round(progressScore * 10) / 10 : null,
      competency: competencyScore !== null ? Math.round(competencyScore * 10) / 10 : null,
      attendance: attendanceScore !== null ? Math.round(attendanceScore * 10) / 10 : null,
      homework: homeworkScore !== null ? Math.round(homeworkScore * 10) / 10 : null,
      attitude: attitudeScore !== null ? Math.round(attitudeScore * 10) / 10 : null,
      behavior: behaviorScore !== null ? Math.round(behaviorScore * 10) / 10 : null,
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
