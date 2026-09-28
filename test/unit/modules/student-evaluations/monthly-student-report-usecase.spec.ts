import { performance } from 'perf_hooks';
import { GetMonthlyStudentReportUseCase } from '../../../../src/modules/student-evaluations/application/use-cases/get-monthly-student-report.use-case';
import { IStudentWeeklyDataQueryPort } from '../../../../src/modules/student-evaluations/application/ports/student-weekly-data-query.port';
import {
  HomeworkStatus,
  ParticipationStatus,
  UnderstandingStatus,
  BehaviorTag,
} from '../../../../src/modules/student-evaluations/domain/entities/student-session-evaluation.entity';
import { SqiLevel, TrendDirection } from '../../../../src/modules/student-evaluations/domain/entities/weekly-student-report.entity';

describe('GetMonthlyStudentReportUseCase & Performance Spec', () => {
  const createMockQueryPort = (sessionsCount = 12): IStudentWeeklyDataQueryPort => {
    const mockSessions = Array.from({ length: sessionsCount }, (_, i) => ({
      classSessionId: `sess-${i + 1}`,
      subjectName: i % 2 === 0 ? 'Toán Tư Duy' : 'Tiếng Anh Giao Tiếp',
      isPresent: i !== 5, // 1 buổi vắng
      isLate: i === 2,    // 1 buổi đi muộn
      homeworkStatus: i === 3 ? HomeworkStatus.INCOMPLETE : HomeworkStatus.COMPLETED,
      participation: ParticipationStatus.ACTIVE,
      understanding: UnderstandingStatus.UNDERSTOOD,
      behaviorTags: [BehaviorTag.ATTENTIVE],
      score: (8.5 + (i % 3) * 0.5).toFixed(1),
      teacherComment: `Buổi ${i + 1}: Học sinh tiếp thu bài rất tốt, hăng hái phát biểu.`,
    }));

    return {
      getWeeklySessions: jest.fn().mockResolvedValue(mockSessions),
      getPreviousWeekSqi: jest.fn().mockResolvedValue(82),
      verifyStudentOwnership: jest.fn().mockResolvedValue(true),
      getStudentInfo: jest.fn().mockResolvedValue({
        id: 'student-real-001',
        name: 'Trần Gia Bảo',
        code: 'HS-2026-001',
      }),
      getClassStudents: jest.fn().mockResolvedValue([]),
      verifyTeacherClassAccess: jest.fn().mockResolvedValue(true),
      getClassName: jest.fn().mockResolvedValue('Lớp Toán Tiếng Anh - K6'),
    };
  };

  describe('1. Nghiệp vụ tạo Báo Cáo Học Tập Theo Tháng (Pure-Query / Zero Mutation)', () => {
    it('1.1. Tính toán chuẩn xác ngày đầu tháng và cuối tháng cho báo cáo', async () => {
      const mockPort = createMockQueryPort();
      const useCase = new GetMonthlyStudentReportUseCase(mockPort);

      // Tháng 9/2026 (có 30 ngày)
      const result = await useCase.execute({
        studentId: 'student-real-001',
        month: 9,
        year: 2026,
        requestUserId: 'teacher-1',
        userRole: 'TEACHER',
      });

      expect(mockPort.getWeeklySessions).toHaveBeenCalledWith(
        'student-real-001',
        '2026-09-01',
        '2026-09-30',
      );
      expect(result.hasSessions).toBe(true);
      expect(result.report).toBeDefined();
      expect(result.report?.studentName).toBe('Trần Gia Bảo');
    });

    it('1.2. Tổng hợp chỉ số SQI và phân rã năng lực của toàn bộ các buổi trong tháng', async () => {
      const mockPort = createMockQueryPort(12);
      const useCase = new GetMonthlyStudentReportUseCase(mockPort);

      const result = await useCase.execute({
        studentId: 'student-real-001',
        month: 9,
        year: 2026,
        requestUserId: 'admin-1',
        userRole: 'ADMIN',
      });

      expect(result.report).not.toBeNull();
      const report = result.report!;
      expect(report.sqiScore).toBeGreaterThanOrEqual(80);
      expect(report.sessions.length).toBe(12);
      expect(report.overview).toContain('Trần Gia Bảo');
      expect(report.strengths).toBeDefined();
      expect(report.improvements).toBeDefined();
    });

    it('1.3. Trả về thông báo phù hợp khi tháng được chọn không có buổi học nào', async () => {
      const mockPort = createMockQueryPort();
      (mockPort.getWeeklySessions as jest.Mock).mockResolvedValue([]);
      const useCase = new GetMonthlyStudentReportUseCase(mockPort);

      const result = await useCase.execute({
        studentId: 'student-real-001',
        month: 7,
        year: 2026,
        requestUserId: 'admin-1',
        userRole: 'ADMIN',
      });

      expect(result.hasSessions).toBe(false);
      expect(result.report).toBeNull();
      expect(result.message).toContain('Tháng 7/2026 con không có buổi học nào');
    });

    it('1.4. Chặn truy cập trái phép (IDOR Protection) khi tài khoản phụ huynh xem học sinh khác', async () => {
      const mockPort = createMockQueryPort();
      (mockPort.verifyStudentOwnership as jest.Mock).mockResolvedValue(false);
      const useCase = new GetMonthlyStudentReportUseCase(mockPort);

      await expect(
        useCase.execute({
          studentId: 'student-other',
          month: 9,
          year: 2026,
          requestUserId: 'parent-stranger',
          userRole: 'STUDENT',
        }),
      ).rejects.toThrow('Bạn không có quyền xem báo cáo của học sinh này');
    });
  });

  describe('2. Performance Benchmark (SLA Time Limit < 50ms cho tháng dữ liệu lớn)', () => {
    it('2.1. Đo thời gian tổng hợp SQI và sinh báo cáo tháng với 100 buổi học', async () => {
      const largeSessionPort = createMockQueryPort(100);
      const useCase = new GetMonthlyStudentReportUseCase(largeSessionPort);

      const startTime = performance.now();
      const result = await useCase.execute({
        studentId: 'student-real-001',
        month: 9,
        year: 2026,
        requestUserId: 'admin-1',
        userRole: 'ADMIN',
      });
      const durationMs = performance.now() - startTime;

      expect(result.report).toBeDefined();
      expect(result.report?.sessions.length).toBe(100);
      // SLA: Thời gian tổng hợp và tính toán toàn bộ tháng phải dưới 50ms
      expect(durationMs).toBeLessThan(50);
    });
  });
});
