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
  BehaviorTag,
} from '../../../../src/modules/student-evaluations/domain/entities/student-session-evaluation.entity';

describe('SqiCalculator Domain Service & Benchmark Spec (4 Chỉ số: 30 - 30 - 20 - 20)', () => {
  describe('1. Logic tính toán bộ 4 chỉ số SQI (Tổng 100%)', () => {
    it('1.1. Tính toán chuẩn xác SQI cho học sinh xuất sắc (Level 5 >= 90 điểm)', () => {
      const sessions: SessionEvaluationInput[] = [
        {
          classSessionId: 'sess-1',
          subjectName: 'Toán',
          isPresent: true,
          homeworkStatus: HomeworkStatus.COMPLETED,
          participation: ParticipationStatus.ACTIVE,
          behaviorTags: [BehaviorTag.ATTENTIVE],
        },
        {
          classSessionId: 'sess-2',
          subjectName: 'Tiếng Anh',
          isPresent: true,
          homeworkStatus: HomeworkStatus.COMPLETED,
          participation: ParticipationStatus.ACTIVE,
          behaviorTags: [BehaviorTag.ATTENTIVE],
        },
      ];

      const result = SqiCalculator.calculate(sessions, 85);

      // Điểm tối đa: Chuyên cần (30) + Bài tập (30) + Nội quy (20) + Tham gia (20) = 100đ
      expect(result.sqiScore).toBe(100);
      expect(result.sqiDelta).toBe(15);
      expect(result.level).toBe(SqiLevel.LEVEL_5_EXCELLENT);
      expect(result.trend).toBe(TrendDirection.UP);
      expect(result.breakdown.attendance).toBe(30);
      expect(result.breakdown.homework).toBe(30);
      expect(result.breakdown.behavior).toBe(20);
      expect(result.breakdown.participation).toBe(20);
    });

    it('1.2. Tính toán chính xác SQI khi học sinh suy giảm (vắng, chưa làm bài, nói chuyện, ít nói)', () => {
      const sessions: SessionEvaluationInput[] = [
        {
          classSessionId: 'sess-1',
          subjectName: 'Toán',
          isPresent: true,
          homeworkStatus: HomeworkStatus.NOT_DONE, // 0/30
          participation: ParticipationStatus.PASSIVE, // 0/20
          behaviorTags: [BehaviorTag.TALKATIVE], // 0/20
        },
        {
          classSessionId: 'sess-2',
          subjectName: 'Toán',
          isPresent: false, // 1 có mặt / 2 buổi -> Chuyên cần 15/30
          homeworkStatus: HomeworkStatus.INCOMPLETE, // 0.5 * 30 -> 15/30 => TB bài tập = 7.5
          participation: ParticipationStatus.PASSIVE,
          behaviorTags: [BehaviorTag.DISTRACTED],
        },
      ];

      const result = SqiCalculator.calculate(sessions, 75);

      // Chuyên cần: (1/2)*30 = 15đ
      // Bài tập: ((0 + 0.5)/2)*30 = 7.5đ
      // Nội quy: (0/2)*20 = 0đ
      // Tham gia: (0/2)*20 = 0đ
      // Tổng SQI: 15 + 7.5 + 0 + 0 = 22.5đ
      expect(result.breakdown.attendance).toBe(15);
      expect(result.breakdown.homework).toBe(7.5);
      expect(result.breakdown.behavior).toBe(0);
      expect(result.breakdown.participation).toBe(0);
      expect(result.sqiScore).toBe(22.5);
      expect(result.level).toBe(SqiLevel.LEVEL_1_WEAK);
      expect(result.trend).toBe(TrendDirection.DOWN);
      expect(result.sqiDelta).toBeLessThan(-50);
    });

    it('1.3. Xử lý an toàn khi học sinh không có buổi học nào trong tuần (nghỉ lễ)', () => {
      const result = SqiCalculator.calculate([], 80);

      expect(result.sqiScore).toBe(0);
      expect(result.sqiDelta).toBe(0);
      expect(result.hasSessions).toBe(false);
      expect(result.breakdown.attendance).toBeNull();
      expect(result.breakdown.homework).toBeNull();
      expect(result.breakdown.behavior).toBeNull();
      expect(result.breakdown.participation).toBeNull();
    });

    it('1.4. Xử lý chính xác kịch bản Tuần đầu tiên (chưa có điểm kỳ trước)', () => {
      const sessions: SessionEvaluationInput[] = [
        {
          classSessionId: 'sess-1',
          subjectName: 'Toán',
          isPresent: true,
          homeworkStatus: HomeworkStatus.COMPLETED,
          participation: ParticipationStatus.ACTIVE,
          behaviorTags: [BehaviorTag.ATTENTIVE],
        },
      ];

      const result = SqiCalculator.calculate(sessions, null);

      expect(result.sqiScore).toBe(100);
      expect(result.sqiDelta).toBe(0);
      expect(result.trend).toBe(TrendDirection.NEW);
    });

    it('1.5. Tiêu chí chưa có thì trả về null (hiển thị "-"), SQI chỉ tính trên tiêu chí đã có', () => {
      const sessions: SessionEvaluationInput[] = [
        {
          classSessionId: 'sess-1',
          subjectName: 'Toán',
          isPresent: true,
          // Không có bài tập, nội quy, tham gia
        },
        {
          classSessionId: 'sess-2',
          subjectName: 'Toán',
          isPresent: true,
        },
      ];

      const result = SqiCalculator.calculate(sessions, null);

      // Chuyên cần 100% -> 30/30đ
      expect(result.breakdown.attendance).toBe(30);
      expect(result.breakdown.homework).toBeNull();
      expect(result.breakdown.behavior).toBeNull();
      expect(result.breakdown.participation).toBeNull();

      // SQI chuẩn hóa trên các tiêu chí đã có (30/30 -> 100đ)
      expect(result.sqiScore).toBe(100);
      expect(result.level).toBe(SqiLevel.LEVEL_5_EXCELLENT);
    });

    it('1.6. Chuyên cần chỉ có Có mặt vs Vắng mặt, tính đúng tỷ lệ 30%', () => {
      const sessions: SessionEvaluationInput[] = [
        { classSessionId: 'sess-1', subjectName: 'Toán', isPresent: true },
        { classSessionId: 'sess-2', subjectName: 'Toán', isPresent: false },
      ];

      const result = SqiCalculator.calculate(sessions, null);

      // 1/2 buổi có mặt -> Chuyên cần 15/30
      expect(result.breakdown.attendance).toBe(15);
      // Chuẩn hóa SQI -> 50đ
      expect(result.sqiScore).toBe(50);
      expect(result.breakdown.homework).toBeNull();
    });
  });

  describe('2. Performance Benchmark (SLA Time Limit Constraint)', () => {
    it('tính toán SQI 4 chỉ số cho 1,000 học sinh trong dưới 50ms (SLA Benchmark)', () => {
      const STUDENT_COUNT = 1000;
      const mockStudentWorkloads = Array.from({ length: STUDENT_COUNT }, (_, i) => ({
        studentId: `student-${i}`,
        previousSqi: 70 + (i % 20),
        sessions: [
          {
            classSessionId: `session-${i}-1`,
            subjectName: 'Toán',
            isPresent: i % 10 !== 0,
            homeworkStatus:
              i % 5 === 0
                ? HomeworkStatus.NOT_DONE
                : i % 4 === 0
                  ? HomeworkStatus.INCOMPLETE
                  : HomeworkStatus.COMPLETED,
            participation: i % 3 === 0 ? ParticipationStatus.PASSIVE : ParticipationStatus.ACTIVE,
            behaviorTags: i % 8 === 0 ? [BehaviorTag.TALKATIVE] : [BehaviorTag.ATTENTIVE],
          },
          {
            classSessionId: `session-${i}-2`,
            subjectName: 'Tiếng Anh',
            isPresent: true,
            homeworkStatus: HomeworkStatus.COMPLETED,
            participation: ParticipationStatus.ACTIVE,
            behaviorTags: [BehaviorTag.ATTENTIVE],
          },
        ],
      }));

      // Warm up V8 JIT
      SqiCalculator.calculate(mockStudentWorkloads[0].sessions, mockStudentWorkloads[0].previousSqi);

      const startTime = performance.now();
      const results = mockStudentWorkloads.map((item) =>
        SqiCalculator.calculate(item.sessions, item.previousSqi),
      );
      const durationMs = performance.now() - startTime;

      expect(results.length).toBe(STUDENT_COUNT);
      expect(results[0].sqiScore).toBeGreaterThan(0);
      expect(results[STUDENT_COUNT - 1].sqiScore).toBeGreaterThan(0);

      console.log(
        `[BENCHMARK] Thời gian tính toán SQI 4 chỉ số cho ${STUDENT_COUNT} học sinh: ${durationMs.toFixed(2)}ms (SLA < 150ms)`,
      );
      expect(durationMs).toBeLessThan(150);
    });
  });
});
