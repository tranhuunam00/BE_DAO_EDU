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
  attendanceStatus?: string;
  homeworkStatus?: string | HomeworkStatus;
  participation?: string | ParticipationStatus;
  understanding?: string | UnderstandingStatus;
  behaviorTags?: string[] | BehaviorTag[];
  behaviorStatus?: string;
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

    // 1. Chuyên cần (30%)
    let attPoints = 0;
    const attCounts: Record<string, number> = {};

    for (const s of sessions) {
      const status = (s.attendanceStatus || '').toLowerCase();
      let p = 0;
      let label = '';
      if (status === 'yes' || status === 'on_time' || status === 'makeup') {
        p = 1.0;
        label = status === 'makeup' ? 'buổi học bù' : 'buổi đúng giờ';
      } else if (status === 'late') {
        p = 0.75;
        label = 'buổi đi muộn';
      } else if (status === 'early_leave') {
        p = 0.75;
        label = 'buổi về sớm';
      } else if (status === 'late_much') {
        p = 0.4;
        label = 'buổi đi muộn nhiều';
      } else if (status === 'absent_excused') {
        p = 0.2;
        label = 'buổi vắng có phép';
      } else if (status === 'no' || status === 'absent_unexcused') {
        p = 0.0;
        label = status === 'no' ? 'buổi vắng mặt' : 'buổi vắng không phép';
      } else {
        // Fallback tương thích dữ liệu cũ
        if (s.isPresent) {
          p = 1.0;
          label = s.isLate ? 'buổi đi muộn' : 'buổi đúng giờ';
        } else {
          p = 0.0;
          label = 'buổi vắng mặt';
        }
      }
      attPoints += p;
      attCounts[label] = (attCounts[label] || 0) + 1;
    }
    const attendanceScore = totalSessions > 0 ? (attPoints / totalSessions) * 30 : null;
    const attendanceNarrative = Object.entries(attCounts)
      .map(([lbl, count]) => `${count} ${lbl}`)
      .join(', ') || 'Chưa có dữ liệu';

    // 2. Làm BTVN (30%)
    const hwSessions = sessions.filter((s) => {
      const st = String(s.homeworkStatus || '').toLowerCase();
      return st !== '' && st !== 'no_homework' && st !== 'none' && st !== 'undefined';
    });
    let homeworkScore: number | null = null;
    let homeworkNarrative = 'Không giao BTVN';
    if (hwSessions.length > 0) {
      let hwPoints = 0;
      const hwCounts: Record<string, number> = {};
      for (const s of hwSessions) {
        const st = String(s.homeworkStatus || '').toLowerCase();
        let p = 0;
        let label = '';
        if (st === 'yes' || st === 'excellent' || st === 'completed' || st === 'done') {
          p = 1.0;
          label = st === 'excellent' ? 'buổi làm tốt 100%' : 'buổi đã làm BTVN';
        } else if (st === 'missing_few' || st === 'forgot_notebook') {
          p = 0.7;
          label = st === 'forgot_notebook' ? 'buổi quên mang vở' : 'buổi làm thiếu ít';
        } else if (st === 'incomplete') {
          p = 0.5;
          label = 'buổi chưa xong';
        } else if (st === 'coping') {
          p = 0.4;
          label = 'buổi làm đối phó/sơ sài';
        } else if (st === 'missing_many') {
          p = 0.3;
          label = 'buổi làm thiếu nhiều';
        } else {
          p = 0.0;
          label = 'buổi chưa làm';
        }
        hwPoints += p;
        hwCounts[label] = (hwCounts[label] || 0) + 1;
      }
      homeworkScore = (hwPoints / hwSessions.length) * 30;
      homeworkNarrative = Object.entries(hwCounts)
        .map(([lbl, count]) => `${count} ${lbl}`)
        .join(', ');
    }

    // 3. Tuân thủ NQ (20%)
    const behaviorSessions = sessions.filter(
      (s) => (Array.isArray(s.behaviorTags) && s.behaviorTags.length > 0) || Boolean(s.behaviorStatus),
    );
    let behaviorScore: number | null = null;
    let behaviorNarrative = 'Chưa có ghi nhận';
    if (behaviorSessions.length > 0) {
      let behPoints = 0;
      const behCounts: Record<string, number> = {};
      for (const s of behaviorSessions) {
        const tags = (s.behaviorTags || []).map((t) => String(t).toLowerCase());
        const status = String(s.behaviorStatus || tags[0] || '').toLowerCase();
        let p = 1.0;
        let label = 'buổi tốt/nghiêm túc';

        if (s.behaviorStatus) {
          if (status === 'yes' || status === 'good') {
            p = 1.0;
            label = 'buổi tốt/nghiêm túc';
          } else if (status === 'no') {
            p = 0.0;
            label = 'buổi chưa nghiêm túc';
          } else if (status === 'disruptive') {
            p = 0.1;
            label = 'buổi đùa trong lớp';
          } else if (status === 'phone_private') {
            p = 0.3;
            label = 'buổi dùng điện thoại/việc riêng';
          } else if (status === 'talkative') {
            p = 0.5;
            label = 'buổi hay nói chuyện';
          } else if (['unfocused', 'sleepy', 'missing_tools'].includes(status)) {
            p = 0.7;
            label = status === 'sleepy' ? 'buổi buồn ngủ/mệt mỏi' : status === 'missing_tools' ? 'buổi thiếu sách vở' : 'buổi mất tập trung';
          } else {
            p = 1.0;
            label = 'buổi tốt/nghiêm túc';
          }
        } else {
          // Legacy logic
          const hasViolation = tags.some((tag) =>
            ['talkative', 'distracted', 'unfocused', 'phone', 'sleepy', 'disruptive'].includes(tag),
          );
          if (!hasViolation) {
            p = 1.0;
            label = 'buổi tốt/nghiêm túc';
          } else {
            p = 0.0;
            label = tags.includes('talkative') ? 'buổi hay nói chuyện' : 'buổi mất tập trung';
          }
        }

        behPoints += p;
        behCounts[label] = (behCounts[label] || 0) + 1;
      }
      behaviorScore = (behPoints / behaviorSessions.length) * 20;
      behaviorNarrative = Object.entries(behCounts)
        .map(([lbl, count]) => `${count} ${lbl}`)
        .join(', ');
    }

    // 4. Tích cực phát biểu (20%)
    const partSessions = sessions.filter(
      (s) => s.participation !== undefined && s.participation !== null && String(s.participation) !== '',
    );
    let participationScore: number | null = null;
    let participationNarrative = 'Chưa có ghi nhận';
    if (partSessions.length > 0) {
      let partPoints = 0;
      const partCounts: Record<string, number> = {};
      for (const s of partSessions) {
        const pStatus = String(s.participation).toLowerCase();
        let p = 0.7;
        let label = 'buổi chăm chú nhưng ít nói';

        if (pStatus === 'yes' || pStatus === 'active_raise_hand' || pStatus === 'active') {
          p = 1.0;
          label = pStatus === 'yes' ? 'buổi tích cực phát biểu' : 'buổi chủ động giơ tay';
        } else if (pStatus === 'no') {
          p = 0.0;
          label = 'buổi chưa phát biểu';
        } else if (pStatus === 'proactive_ask') {
          p = 1.0;
          label = 'buổi chủ động hỏi bài';
        } else if (pStatus === 'answer_well') {
          p = 0.8;
          label = 'buổi gọi trả lời được';
        } else if (pStatus === 'attentive_quiet' || pStatus === 'normal') {
          p = 0.7;
          label = 'buổi chăm chú nhưng ít nói';
        } else if (pStatus === 'answer_hesitant') {
          p = 0.4;
          label = 'buổi gọi còn ấp úng';
        } else {
          p = 0.0;
          label = pStatus === 'cannot_answer' ? 'buổi gọi không trả lời được' : 'buổi ít nói';
        }
        partPoints += p;
        partCounts[label] = (partCounts[label] || 0) + 1;
      }
      participationScore = (partPoints / partSessions.length) * 20;
      participationNarrative = Object.entries(partCounts)
        .map(([lbl, count]) => `${count} ${lbl}`)
        .join(', ');
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
      narratives: {
        attendance: attendanceNarrative,
        homework: homeworkNarrative,
        behavior: behaviorNarrative,
        participation: participationNarrative,
      },
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
