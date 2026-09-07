import { performance } from 'perf_hooks';
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

describe('SqiCalculator Domain Service & Benchmark Spec', () => {
  describe('1. Logic tính toán chỉ số SQI (7 Yếu tố - 100%)', () => {
    it('1.1. Tính toán chuẩn xác SQI cho học sinh xuất sắc (Level 5 >= 90 điểm)', () => {
      const sessions: SessionEvaluationInput[] = [
        {
          classSessionId: 'sess-1',
          subjectName: 'Toán',
          isPresent: true,
          isLate: false,
          homeworkStatus: HomeworkStatus.COMPLETED,
          participation: ParticipationStatus.ACTIVE,
          understanding: UnderstandingStatus.UNDERSTOOD,
          behaviorTags: [BehaviorTag.ATTENTIVE],
          score: '9.0',
        },
        {
          classSessionId: 'sess-2',
          subjectName: 'Tiếng Anh',
          isPresent: true,
          isLate: false,
          homeworkStatus: HomeworkStatus.COMPLETED,
          participation: ParticipationStatus.ACTIVE,
          understanding: UnderstandingStatus.UNDERSTOOD,
          behaviorTags: [BehaviorTag.ATTENTIVE],
          score: '9.5',
        },
      ];

      const result = SqiCalculator.calculate(sessions, 85);

      expect(result.sqiScore).toBeGreaterThanOrEqual(90);
      expect(result.sqiDelta).toBeGreaterThan(0);
      expect(result.level).toBe(SqiLevel.LEVEL_5_EXCELLENT);
      expect(result.breakdown.attendance).toBe(10);
      expect(result.breakdown.homework).toBe(10);
      expect(result.breakdown.attitude).toBe(10);
      expect(result.breakdown.behavior).toBe(5);
      expect(result.subjectPerformances.length).toBe(2);
    });

    it('1.2. Tính toán chính xác SQI khi học sinh có dấu hiệu suy giảm', () => {
      const sessions: SessionEvaluationInput[] = [
        {
          classSessionId: 'sess-1',
          subjectName: 'Toán',
          isPresent: true,
          isLate: true,
          homeworkStatus: HomeworkStatus.NOT_DONE,
          participation: ParticipationStatus.PASSIVE,
          understanding: UnderstandingStatus.NOT_UNDERSTOOD,
          behaviorTags: [BehaviorTag.TALKATIVE, BehaviorTag.PHONE],
          score: '5.0',
        },
        {
          classSessionId: 'sess-2',
          subjectName: 'Toán',
          isPresent: false,
          isLate: false,
          homeworkStatus: HomeworkStatus.INCOMPLETE,
          participation: ParticipationStatus.PASSIVE,
          understanding: UnderstandingStatus.NOT_UNDERSTOOD,
          behaviorTags: [],
          score: null,
        },
      ];

      const result = SqiCalculator.calculate(sessions, 75);

      expect(result.sqiScore).toBeLessThan(60);
      expect(result.sqiDelta).toBeLessThan(0);
      expect(result.trend).toBe(TrendDirection.DOWN);
      expect(result.breakdown.homework).toBeLessThan(5);
      expect(result.breakdown.attendance).toBeLessThan(5);
    });

    it('1.3. Xử lý an toàn khi tuần đó học sinh không có buổi học nào (Nghỉ lễ)', () => {
      const result = SqiCalculator.calculate([], 80);

      expect(result.sqiScore).toBe(0);
      expect(result.sqiDelta).toBe(0);
      expect(result.hasSessions).toBe(false);
      expect(result.subjectPerformances).toHaveLength(0);
    });

    it('1.4. Xử lý chính xác kịch bản Tuần đầu tiên (chưa có điểm tuần trước)', () => {
      const sessions: SessionEvaluationInput[] = [
        {
          classSessionId: 'sess-1',
          subjectName: 'Toán',
          isPresent: true,
          isLate: false,
          homeworkStatus: HomeworkStatus.COMPLETED,
          participation: ParticipationStatus.ACTIVE,
          understanding: UnderstandingStatus.UNDERSTOOD,
          behaviorTags: [BehaviorTag.ATTENTIVE],
          score: '8.0',
        },
      ];

      const result = SqiCalculator.calculate(sessions, null);

      expect(result.sqiScore).toBeGreaterThan(70);
      expect(result.sqiDelta).toBe(0);
      expect(result.trend).toBe(TrendDirection.NEW);
      expect(result.breakdown.progress).toBe(16);
    });
  });

  describe('2. Performance Benchmark (SLA Time Limit Constraint)', () => {
    it('tính toán và tổng hợp SQI cho 1,000 học sinh độc lập trong dưới 50ms (SLA Benchmark)', () => {
      const STUDENT_COUNT = 1000;
      const mockStudentWorkloads = Array.from({ length: STUDENT_COUNT }, (_, i) => ({
        studentId: `student-${i}`,
        previousSqi: 70 + (i % 20),
        sessions: [
          {
            classSessionId: `session-${i}-1`,
            subjectName: 'Toán',
            isPresent: i % 10 !== 0,
            isLate: i % 15 === 0,
            homeworkStatus:
              i % 5 === 0
                ? HomeworkStatus.NOT_DONE
                : i % 4 === 0
                  ? HomeworkStatus.INCOMPLETE
                  : HomeworkStatus.COMPLETED,
            participation: i % 3 === 0 ? ParticipationStatus.PASSIVE : ParticipationStatus.ACTIVE,
            understanding:
              i % 4 === 0 ? UnderstandingStatus.NOT_UNDERSTOOD : UnderstandingStatus.UNDERSTOOD,
            behaviorTags: i % 8 === 0 ? [BehaviorTag.TALKATIVE] : [BehaviorTag.ATTENTIVE],
            score: (7 + (i % 3)).toFixed(1),
          },
          {
            classSessionId: `session-${i}-2`,
            subjectName: 'Tiếng Anh',
            isPresent: true,
            isLate: false,
            homeworkStatus: HomeworkStatus.COMPLETED,
            participation: ParticipationStatus.ACTIVE,
            understanding: UnderstandingStatus.UNDERSTOOD,
            behaviorTags: [BehaviorTag.ATTENTIVE],
            score: '8.5',
          },
        ],
      }));

      const startTime = performance.now();
      const results = mockStudentWorkloads.map((item) =>
        SqiCalculator.calculate(item.sessions, item.previousSqi),
      );
      const durationMs = performance.now() - startTime;

      expect(results.length).toBe(STUDENT_COUNT);
      expect(results[0].sqiScore).toBeGreaterThan(0);
      expect(results[STUDENT_COUNT - 1].sqiScore).toBeGreaterThan(0);

      console.log(
        `[BENCHMARK] Thời gian tính toán SQI cho ${STUDENT_COUNT} học sinh: ${durationMs.toFixed(2)}ms (SLA < 50ms)`,
      );
      expect(durationMs).toBeLessThan(50);
    });
  });
});
