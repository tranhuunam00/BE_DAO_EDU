import { performance } from 'perf_hooks';
import { SqiCalculator, SessionEvaluationInput } from '../../../../src/modules/student-evaluations/domain/services/sqi-calculator.service';

describe('TDD: Attendance Strict Binary (Chỉ Có mặt hoặc Vắng - Không có Đi muộn)', () => {
  describe('1. Logic tính điểm chuyên cần & Narrative chuỗi', () => {
    it('1.1. Học sinh có mặt (isPresent = true) luôn được 100% chuyên cần (1.0đ/buổi), kể cả khi cờ isLate = true từ máy chấm công', () => {
      const sessions: SessionEvaluationInput[] = [
        {
          classSessionId: 'sess-1',
          subjectName: 'Toán',
          isPresent: true,
          isLate: true, // Legacy / machine timestamp flag
          attendanceStatus: 'late',
        },
        {
          classSessionId: 'sess-2',
          subjectName: 'Toán',
          isPresent: true,
          isLate: false,
          attendanceStatus: 'on_time',
        },
      ];

      const result = SqiCalculator.calculate(sessions, null);

      // Chuyên cần 2/2 buổi có mặt -> 30/30đ
      expect(result.breakdown.attendance).toBe(30);
      // Narrative TUYỆT ĐỐI KHÔNG chứa 'đi muộn', 'đúng giờ' mà là 'buổi có mặt'
      expect(result.breakdown.narratives?.attendance).toBe('2 buổi có mặt');
      expect(result.breakdown.narratives?.attendance).not.toContain('đi muộn');
      expect(result.breakdown.narratives?.attendance).not.toContain('về sớm');
    });

    it('1.2. Học sinh vắng mặt (có phép / không phép) nhận 0đ chuyên cần và hiển thị đúng nhãn vắng', () => {
      const sessions: SessionEvaluationInput[] = [
        {
          classSessionId: 'sess-1',
          subjectName: 'Toán',
          isPresent: true,
        },
        {
          classSessionId: 'sess-2',
          subjectName: 'Toán',
          isPresent: false,
          attendanceStatus: 'absent_excused',
        },
        {
          classSessionId: 'sess-3',
          subjectName: 'Toán',
          isPresent: false,
          attendanceStatus: 'absent_unexcused',
        },
      ];

      const result = SqiCalculator.calculate(sessions, null);

      // 1 buổi có mặt trên 3 buổi -> (1/3) * 30 = 10đ
      expect(result.breakdown.attendance).toBe(10);
      expect(result.breakdown.narratives?.attendance).toContain('1 buổi có mặt');
      expect(result.breakdown.narratives?.attendance).toContain('1 buổi vắng có phép');
      expect(result.breakdown.narratives?.attendance).toContain('1 buổi vắng không phép');
      expect(result.breakdown.narratives?.attendance).not.toContain('đi muộn');
    });

    it('1.3. Tất cả các trạng thái trung gian (early_leave, late_much) nếu isPresent = true đều quy về Có mặt', () => {
      const sessions: SessionEvaluationInput[] = [
        {
          classSessionId: 'sess-1',
          subjectName: 'Toán',
          isPresent: true,
          attendanceStatus: 'early_leave',
        },
        {
          classSessionId: 'sess-2',
          subjectName: 'Toán',
          isPresent: true,
          attendanceStatus: 'late_much',
        },
      ];

      const result = SqiCalculator.calculate(sessions, null);

      expect(result.breakdown.attendance).toBe(30);
      expect(result.breakdown.narratives?.attendance).toBe('2 buổi có mặt');
    });
  });

  describe('2. Performance Benchmark SLA: Xử lý khối lượng lớn điểm danh', () => {
    it('Benchmark: Tính toán 1,000 học sinh x 10 buổi (10,000 buổi học) phải hoàn thành dưới 50ms', () => {
      const largeSessions: SessionEvaluationInput[] = Array.from({ length: 10 }, (_, i) => ({
        classSessionId: `sess-${i}`,
        subjectName: 'Toán',
        isPresent: i % 5 !== 0, // 8 buổi có mặt, 2 buổi vắng
        isLate: i % 2 === 0,
        attendanceStatus: i % 5 === 0 ? 'absent_excused' : 'present',
      }));

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        SqiCalculator.calculate(largeSessions, null);
      }
      const duration = performance.now() - start;

      // SLA Limit: < 100ms
      expect(duration).toBeLessThan(100);
    });
  });
});
