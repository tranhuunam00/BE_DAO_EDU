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
          attendance: null,
          homework: null,
          behavior: null,
          participation: null,
          academic: null,
          progress: null,
          competency: null,
          attitude: null,
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

    // 1. Chuyên cần (30%) - Tính theo tỷ lệ số buổi có mặt / tổng số buổi
    let presentCount = 0;
    for (const s of sessions) {
      if (s.isPresent) {
        presentCount += 1.0;
      }
    }
    const attendanceScore = totalSessions > 0 ? (presentCount / totalSessions) * 30 : null;

    // 2. Làm bài tập (30%) - Chỉ tính trên các buổi có giao bài tập
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
      homeworkScore = (hwPoints / hwSessions.length) * 30;
    }

    // 3. Tuân thủ nội quy (20%) - Chỉ tính trên các buổi có đánh giá nề nếp
    const behaviorSessions = sessions.filter(
      (s) => Array.isArray(s.behaviorTags) && s.behaviorTags.length > 0,
    );
    let behaviorScore: number | null = null;
    if (behaviorSessions.length > 0) {
      let goodSessions = 0;
      for (const s of behaviorSessions) {
        const tags = (s.behaviorTags || []).map((t) => String(t).toLowerCase());
        const hasViolation = tags.some((tag) =>
          ['talkative', 'distracted', 'unfocused', 'phone', 'sleepy', 'disruptive'].includes(tag),
        );
        if (!hasViolation) {
          goodSessions += 1.0;
        }
      }
      behaviorScore = (goodSessions / behaviorSessions.length) * 20;
    }

    // 4. Tích cực tham gia (20%) - Chỉ tính trên các buổi có đánh giá tương tác
    const partSessions = sessions.filter(
      (s) => s.participation !== undefined && s.participation !== null,
    );
    let participationScore: number | null = null;
    if (partSessions.length > 0) {
      let partPoints = 0;
      for (const s of partSessions) {
        if (s.participation === ParticipationStatus.ACTIVE) {
          partPoints += 1.0;
        } else if ((s.participation as string) === 'normal') {
          partPoints += 0.6;
        } else {
          partPoints += 0.0; // PASSIVE
        }
      }
      participationScore = (partPoints / partSessions.length) * 20;
    }

    // 5. TÍNH ĐIỂM SQI TỔNG HỢP: Chuẩn hóa trên tổng trọng số của các tiêu chí đã có dữ liệu
    let totalWeightedPoints = 0;
    let totalAvailableWeight = 0;

    if (attendanceScore !== null) {
      totalWeightedPoints += attendanceScore;
      totalAvailableWeight += 30;
    }
    if (homeworkScore !== null) {
      totalWeightedPoints += homeworkScore;
      totalAvailableWeight += 30;
    }
    if (behaviorScore !== null) {
      totalWeightedPoints += behaviorScore;
      totalAvailableWeight += 20;
    }
    if (participationScore !== null) {
      totalWeightedPoints += participationScore;
      totalAvailableWeight += 20;
    }

    const totalSqi =
      totalAvailableWeight > 0
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round((totalWeightedPoints / totalAvailableWeight) * 100 * 10) / 10,
            ),
          )
        : 0;

    // Tính chênh lệch và xu hướng so với tuần trước
    let delta = 0;
    let trend = TrendDirection.STABLE;

    if (previousWeekSqi !== null && previousWeekSqi !== undefined) {
      delta = Math.round((totalSqi - previousWeekSqi) * 10) / 10;
      if (delta >= 2.5) {
        trend = TrendDirection.UP;
      } else if (delta <= -2.5) {
        trend = TrendDirection.DOWN;
      } else {
        trend = TrendDirection.STABLE;
      }
    } else {
      trend = TrendDirection.NEW;
    }

    // Tính điểm theo từng môn tuần trước để so sánh xu hướng
    const prevSubjectMap = new Map<string, { totalScore: number; count: number }>();
    if (previousSessions && previousSessions.length > 0) {
      for (const ps of previousSessions) {
        const name = ps.subjectName || 'Chung';
        const ex = prevSubjectMap.get(name) || { totalScore: 0, count: 0 };
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

    // Tính điểm môn học tuần này
    const subjectMap = new Map<string, { totalScore: number; count: number; hasRealScore: boolean }>();
    for (const s of sessions) {
      const name = s.subjectName || 'Chung';
      const existing = subjectMap.get(name) || { totalScore: 0, count: 0, hasRealScore: false };
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

      const prev = prevSubjectMap.get(name);
      const prevAvg = prev && prev.count > 0 ? Math.round((prev.totalScore / prev.count) * 10) / 10 : null;

      if (prevAvg !== null) {
        scoreDelta = Math.round((avg - prevAvg) * 10) / 10;
        if (scoreDelta >= 0.5) subTrend = TrendDirection.UP;
        else if (scoreDelta <= -0.5) subTrend = TrendDirection.DOWN;
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
      attendance: attendanceScore !== null ? Math.round(attendanceScore * 10) / 10 : null,
      homework: homeworkScore !== null ? Math.round(homeworkScore * 10) / 10 : null,
      behavior: behaviorScore !== null ? Math.round(behaviorScore * 10) / 10 : null,
      participation: participationScore !== null ? Math.round(participationScore * 10) / 10 : null,
      attitude: participationScore !== null ? Math.round(participationScore * 10) / 10 : null,
      competency: null,
      academic: null,
      progress: null,
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
