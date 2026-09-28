import { PublicWeeklyReportController } from '../../../../src/modules/student-evaluations/presentation/controllers/public-weekly-report.controller';
import { GetWeeklyStudentReportUseCase } from '../../../../src/modules/student-evaluations/application/use-cases/get-weekly-student-report.use-case';
import { GetMonthlyStudentReportUseCase } from '../../../../src/modules/student-evaluations/application/use-cases/get-monthly-student-report.use-case';

describe('PublicWeeklyReportController Spec (TDD & Performance SLA)', () => {
  let controller: PublicWeeklyReportController;
  let mockWeeklyUseCase: jest.Mocked<GetWeeklyStudentReportUseCase>;
  let mockMonthlyUseCase: jest.Mocked<GetMonthlyStudentReportUseCase>;

  beforeEach(() => {
    mockWeeklyUseCase = {
      execute: jest.fn().mockResolvedValue({
        report: {
          id: 'rep-public-1',
          studentId: 'stu-1',
          studentName: 'Nguyễn Hải Minh',
          sqiScore: 92,
          isApproved: true,
          toJSON: () => ({
            id: 'rep-public-1',
            studentId: 'stu-1',
            studentName: 'Nguyễn Hải Minh',
            sqiScore: 92,
            isApproved: true,
          }),
        } as any,
        hasSessions: true,
        message: undefined,
      }),
    } as any;

    mockMonthlyUseCase = {
      execute: jest.fn().mockResolvedValue({
        report: {
          id: 'rep-public-m-1',
          studentId: 'stu-1',
          studentName: 'Nguyễn Hải Minh',
          sqiScore: 95,
          isApproved: true,
          toJSON: () => ({
            id: 'rep-public-m-1',
            studentId: 'stu-1',
            studentName: 'Nguyễn Hải Minh',
            sqiScore: 95,
            isApproved: true,
          }),
        } as any,
        hasSessions: true,
        message: undefined,
      }),
    } as any;

    controller = new PublicWeeklyReportController(mockWeeklyUseCase, mockMonthlyUseCase);
  });

  describe('1. GET /public/weekly-reports/student/:studentId (Báo cáo công khai không cần đăng nhập)', () => {
    it('1.1. Phụ huynh truy cập xem báo cáo tuần bằng studentId và week/year', async () => {
      const result = await controller.getPublicStudentReport('stu-1', 'week', '38', '2026');

      expect(result.success).toBe(true);
      expect(result.data?.studentName).toBe('Nguyễn Hải Minh');
      expect(result.data?.sqiScore).toBe(92);
      expect(mockWeeklyUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 'stu-1',
          weekNumber: 38,
          year: 2026,
          userRole: 'PUBLIC',
        }),
      );
    });

    it('1.2. Phụ huynh truy cập xem báo cáo tháng bằng studentId và month/year', async () => {
      const result = await controller.getPublicStudentReport('stu-1', 'month', undefined, '2026', '9');

      expect(result.success).toBe(true);
      expect(result.data?.sqiScore).toBe(95);
      expect(mockMonthlyUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 'stu-1',
          month: 9,
          year: 2026,
          userRole: 'PUBLIC',
        }),
      );
    });

    it('1.3. Performance Benchmark: Phục vụ 500 lượt xem công khai dưới SLA 30ms', async () => {
      const t0 = performance.now();
      for (let i = 0; i < 500; i++) {
        await controller.getPublicStudentReport('stu-1', 'week', '38', '2026');
      }
      const duration = performance.now() - t0;
      console.log(`[PUBLIC REPORT BENCHMARK] 500 public requests handled in: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(30);
    });
  });
});
