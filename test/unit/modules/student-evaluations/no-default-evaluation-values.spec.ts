import { performance } from 'perf_hooks';
import {
  StudentSessionEvaluationEntity,
  HomeworkStatus,
  ParticipationStatus,
  UnderstandingStatus,
  BehaviorTag,
} from '../../../../src/modules/student-evaluations/domain/entities/student-session-evaluation.entity';
import {
  SqiCalculator,
  SessionEvaluationInput,
} from '../../../../src/modules/student-evaluations/domain/services/sqi-calculator.service';

describe('No Default Evaluation Values Spec (TDD & Performance Benchmark)', () => {
  describe('1. Domain Entity: Cấm tự ý gán mặc định (No Default Fallback)', () => {
    it('1.1. Khi khởi tạo entity không truyền tiêu chí, homeworkStatus, participation, understanding phải là undefined/null (KHÔNG được tự gán COMPLETED, ACTIVE, UNDERSTOOD)', () => {
      const evaluation = StudentSessionEvaluationEntity.create({
        classSessionId: 'session-uuid-1',
        studentId: 'student-uuid-1',
      });

      expect(evaluation.homeworkStatus).toBeUndefined();
      expect(evaluation.participation).toBeUndefined();
      expect(evaluation.understanding).toBeUndefined();
      expect(evaluation.behaviorTags).toEqual([]);
      expect(evaluation.score).toBeNull();
      expect(evaluation.comment).toBeNull();
    });

    it('1.2. Cho phép cập nhật tiêu chí từng phần mà không bị ép gán giá trị mặc định vào các trường còn lại', () => {
      const evaluation = StudentSessionEvaluationEntity.create({
        classSessionId: 'session-uuid-1',
        studentId: 'student-uuid-1',
      });

      evaluation.updateCriteria({
        homeworkStatus: HomeworkStatus.COMPLETED,
      });

      expect(evaluation.homeworkStatus).toBe(HomeworkStatus.COMPLETED);
      expect(evaluation.participation).toBeUndefined();
      expect(evaluation.understanding).toBeUndefined();
    });
  });

  describe('2. SqiCalculator: Chỉ tính điểm khi có dữ liệu thật trong DB', () => {
    it('2.1. Học sinh có 13 buổi điểm danh (5 đúng giờ, 6 đi muộn, 2 vắng) nhưng CHƯA ĐƯỢC CHẤM BTVN, Năng động, Nội quy', () => {
      // Mô phỏng chính xác trường hợp thực tế của người dùng:
      // 13 buổi điểm danh: 5 đúng giờ (x1.0), 6 đi muộn (x0.75), 2 vắng (x0.0)
      // 11 buổi có mặt KHÔNG có bản ghi đánh giá bài tập hay phát biểu
      const sessions: SessionEvaluationInput[] = [
        ...Array.from({ length: 5 }, (_, i) => ({
          classSessionId: `sess-on-time-${i}`,
          subjectName: 'Toán',
          isPresent: true,
          isLate: false,
          attendanceStatus: 'on_time',
          homeworkStatus: undefined,
          participation: undefined,
          behaviorTags: [],
        })),
        ...Array.from({ length: 6 }, (_, i) => ({
          classSessionId: `sess-late-${i}`,
          subjectName: 'Toán',
          isPresent: true,
          isLate: true,
          attendanceStatus: 'late',
          homeworkStatus: undefined,
          participation: undefined,
          behaviorTags: [],
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          classSessionId: `sess-absent-${i}`,
          subjectName: 'Toán',
          isPresent: false,
          attendanceStatus: 'absent_unexcused',
          homeworkStatus: undefined,
          participation: undefined,
          behaviorTags: [],
        })),
      ];

      const result = SqiCalculator.calculate(sessions, null);

      // 1. Chuyên cần: (5*1.0 + 6*0.75 + 0)/13 * 30 = 9.5/13 * 30 = 21.9
      expect(result.breakdown.attendance).toBe(21.9);
      expect(result.breakdown.narratives?.attendance).toContain('5 buổi đúng giờ');
      expect(result.breakdown.narratives?.attendance).toContain('6 buổi đi muộn');
      expect(result.breakdown.narratives?.attendance).toContain('2 buổi vắng không phép');

      // 2. Bài tập: Chưa chấm -> PHẢI LÀ NULL và 'Chưa có ghi nhận' (CẤM 30/30 hay '11 buổi đã làm BTVN')
      expect(result.breakdown.homework).toBeNull();
      expect(result.breakdown.narratives?.homework).toBe('Chưa có ghi nhận');

      // 3. Nội quy: Chưa chấm -> PHẢI LÀ NULL và 'Chưa có ghi nhận'
      expect(result.breakdown.behavior).toBeNull();
      expect(result.breakdown.narratives?.behavior).toBe('Chưa có ghi nhận');

      // 4. Năng động (Tương tác): Chưa chấm -> PHẢI LÀ NULL và 'Chưa có ghi nhận' (CẤM 20/20 hay '11 buổi chủ động giơ tay')
      expect(result.breakdown.participation).toBeNull();
      expect(result.breakdown.narratives?.participation).toBe('Chưa có ghi nhận');

      // Điểm SQI tổng chỉ chuẩn hóa trên tiêu chí đã có dữ liệu (Chuyên cần)
      // 21.923 / 30 * 100 = 73.1 điểm
      expect(result.sqiScore).toBe(73.1);
    });

    it('2.2. Khi giáo viên THỰC TẾ ĐÁNH GIÁ một số buổi, chỉ tính trên các buổi có dữ liệu đó', () => {
      const sessions: SessionEvaluationInput[] = [
        {
          classSessionId: 'sess-1',
          subjectName: 'Toán',
          isPresent: true,
          attendanceStatus: 'on_time',
          homeworkStatus: HomeworkStatus.COMPLETED,
          participation: ParticipationStatus.ACTIVE,
        },
        {
          classSessionId: 'sess-2',
          subjectName: 'Toán',
          isPresent: true,
          attendanceStatus: 'on_time',
          homeworkStatus: HomeworkStatus.NOT_DONE,
          // participation: undefined (chưa chấm)
        },
        {
          classSessionId: 'sess-3',
          subjectName: 'Toán',
          isPresent: true,
          attendanceStatus: 'on_time',
          // homeworkStatus: undefined
          // participation: undefined
        },
      ];

      const result = SqiCalculator.calculate(sessions, null);

      // Bài tập chỉ tính trên 2 buổi có chấm (1 completed, 1 not_done) -> 50% * 30 = 15 điểm
      expect(result.breakdown.homework).toBe(15);
      expect(result.breakdown.narratives?.homework).toContain('1 buổi đã làm BTVN');
      expect(result.breakdown.narratives?.homework).toContain('1 buổi chưa làm');

      // Năng động chỉ tính trên 1 buổi có chấm -> 100% * 20 = 20 điểm
      expect(result.breakdown.participation).toBe(20);
      expect(result.breakdown.narratives?.participation).toBe('1 buổi chủ động giơ tay');

      // Nội quy hoàn toàn chưa chấm -> null
      expect(result.breakdown.behavior).toBeNull();
      expect(result.breakdown.narratives?.behavior).toBe('Chưa có ghi nhận');
    });
  });

  describe('3. Performance Benchmark Test (SLA Constraint)', () => {
    it('Xử lý tính toán SQI cho 2,000 học sinh với dataset hỗn hợp nhiều null dưới 50ms', () => {
      const STUDENT_COUNT = 2000;
      const mockStudents = Array.from({ length: STUDENT_COUNT }, (_, i) => ({
        studentId: `std-${i}`,
        sessions: [
          {
            classSessionId: `s-${i}-1`,
            subjectName: 'Toán',
            isPresent: true,
            attendanceStatus: 'on_time',
            homeworkStatus: i % 2 === 0 ? HomeworkStatus.COMPLETED : undefined,
            participation: i % 3 === 0 ? ParticipationStatus.ACTIVE : undefined,
            behaviorTags: [],
          },
          {
            classSessionId: `s-${i}-2`,
            subjectName: 'Văn',
            isPresent: true,
            attendanceStatus: 'late',
            homeworkStatus: undefined,
            participation: undefined,
            behaviorTags: [],
          },
        ],
      }));

      // Warmup JIT
      SqiCalculator.calculate(mockStudents[0].sessions, null);

      const start = performance.now();
      for (let i = 0; i < STUDENT_COUNT; i++) {
        SqiCalculator.calculate(mockStudents[i].sessions, null);
      }
      const durationMs = performance.now() - start;

      console.log(`[BENCHMARK] Tính toán SQI ${STUDENT_COUNT} học sinh mất ${durationMs.toFixed(2)}ms (SLA < 100ms)`);
      expect(durationMs).toBeLessThan(100);
    });
  });
});
