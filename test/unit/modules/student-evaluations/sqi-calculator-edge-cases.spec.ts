import {
  SqiCalculator,
  SessionEvaluationInput,
} from '../../../../src/modules/student-evaluations/domain/services/sqi-calculator.service';
import {
  SqiLevel,
  TrendDirection,
} from '../../../../src/modules/student-evaluations/domain/entities/weekly-student-report.entity';
import {
  HomeworkStatus,
  ParticipationStatus,
  UnderstandingStatus,
  BehaviorTag,
} from '../../../../src/modules/student-evaluations/domain/entities/student-session-evaluation.entity';

describe('SqiCalculator Edge Cases & Boundary Values Spec', () => {
  it('1. Xử lý khi học sinh vắng 100% các buổi học trong tuần (Attendance = 0, HW = 0)', () => {
    const sessions: SessionEvaluationInput[] = [
      {
        classSessionId: 's-1',
        subjectName: 'Toán',
        isPresent: false,
        homeworkStatus: HomeworkStatus.NOT_DONE,
        participation: ParticipationStatus.PASSIVE,
        understanding: UnderstandingStatus.NOT_UNDERSTOOD,
        behaviorTags: [],
        score: null,
      },
      {
        classSessionId: 's-2',
        subjectName: 'Văn',
        isPresent: false,
        homeworkStatus: HomeworkStatus.NOT_DONE,
        participation: ParticipationStatus.PASSIVE,
        understanding: UnderstandingStatus.NOT_UNDERSTOOD,
        behaviorTags: [],
        score: null,
      },
    ];

    const result = SqiCalculator.calculate(sessions, 70);

    expect(result.hasSessions).toBe(true);
    expect(result.breakdown.attendance).toBe(0);
    expect(result.breakdown.homework).toBe(0);
    expect(result.level).toBe(SqiLevel.LEVEL_1_WEAK);
    expect(result.trend).toBe(TrendDirection.DOWN);
    expect(result.sqiDelta).toBeLessThan(-20);
  });

  it('2. Xử lý các định dạng điểm số không chuẩn (dấu phẩy "8,75", chuỗi text "chưa có", điểm âm, điểm > 10)', () => {
    const sessions: SessionEvaluationInput[] = [
      {
        classSessionId: 's-1',
        subjectName: 'Toán',
        isPresent: true,
        homeworkStatus: HomeworkStatus.COMPLETED,
        participation: ParticipationStatus.ACTIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        score: '8,75', // Chuỗi dấu phẩy kiểu Việt Nam
      },
      {
        classSessionId: 's-2',
        subjectName: 'Toán',
        isPresent: true,
        homeworkStatus: HomeworkStatus.COMPLETED,
        participation: ParticipationStatus.ACTIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        score: 'chưa chấm', // Chuỗi không phải số -> fallback theo understanding
      },
      {
        classSessionId: 's-3',
        subjectName: 'Toán',
        isPresent: true,
        homeworkStatus: HomeworkStatus.COMPLETED,
        participation: ParticipationStatus.ACTIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        score: '-5', // Điểm âm -> clamp về 0
      },
      {
        classSessionId: 's-4',
        subjectName: 'Toán',
        isPresent: true,
        homeworkStatus: HomeworkStatus.COMPLETED,
        participation: ParticipationStatus.ACTIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        score: '15', // Điểm > 10 -> clamp về 10
      },
    ];

    const result = SqiCalculator.calculate(sessions, 80);

    expect(result.sqiScore).toBeGreaterThan(0);
    expect(result.sqiScore).toBeLessThanOrEqual(100);
    expect(Number.isNaN(result.sqiScore)).toBe(false);
    expect(Number.isNaN(result.sqiDelta)).toBe(false);
  });

  it('3. Hành vi có nhiều vi phạm tiêu cực (phone, talkative, distracted) - điểm behavior bị trừ clamp ở mức 0 không bao giờ âm', () => {
    const sessions: SessionEvaluationInput[] = [
      {
        classSessionId: 's-1',
        subjectName: 'Toán',
        isPresent: true,
        homeworkStatus: HomeworkStatus.COMPLETED,
        participation: ParticipationStatus.ACTIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        behaviorTags: [
          BehaviorTag.TALKATIVE,
          BehaviorTag.PHONE,
          BehaviorTag.DISTRACTED,
          BehaviorTag.TALKATIVE,
          BehaviorTag.PHONE,
          BehaviorTag.DISTRACTED,
        ], // 6 lỗi vi phạm -> 5 - 6 = -1 -> phải clamp về 0
        score: '8.0',
      },
    ];

    const result = SqiCalculator.calculate(sessions, 80);

    expect(result.breakdown.behavior).toBe(0);
    expect(result.breakdown.behavior).toBeGreaterThanOrEqual(0);
  });

  it('4. Điểm tuyệt đối 100/100 ở mọi tiêu chí: SQI = 100 và Level 5 Xuất sắc', () => {
    const sessions: SessionEvaluationInput[] = [
      {
        classSessionId: 's-perfect',
        subjectName: 'Toán Chuyên',
        isPresent: true,
        isLate: false,
        homeworkStatus: HomeworkStatus.COMPLETED,
        participation: ParticipationStatus.ACTIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        behaviorTags: [BehaviorTag.ATTENTIVE, BehaviorTag.LEADERSHIP],
        score: '10.0',
      },
    ];

    // Tuần trước 80, tuần này hoàn hảo tăng vọt -> UP, progress = 20
    const result = SqiCalculator.calculate(sessions, 80);

    expect(result.sqiScore).toBe(100);
    expect(result.level).toBe(SqiLevel.LEVEL_5_EXCELLENT);
    expect(result.trend).toBe(TrendDirection.UP);
    expect(result.breakdown.academic).toBe(30);
    expect(result.breakdown.attendance).toBe(10);
    expect(result.breakdown.homework).toBe(10);
    expect(result.breakdown.attitude).toBe(10);
    expect(result.breakdown.competency).toBe(15);
    expect(result.breakdown.behavior).toBe(5);
    expect(result.breakdown.progress).toBe(20);
  });
});
