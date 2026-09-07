import { WeeklyStudentReportController } from '../../../../src/modules/student-evaluations/presentation/controllers/weekly-student-report.controller';
import { GetWeeklyStudentReportUseCase } from '../../../../src/modules/student-evaluations/application/use-cases/get-weekly-student-report.use-case';
import { GetClassWeeklyReportsUseCase } from '../../../../src/modules/student-evaluations/application/use-cases/get-class-weekly-reports.use-case';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('WeeklyStudentReportController Spec', () => {
  let controller: WeeklyStudentReportController;
  let mockWeeklyUseCase: jest.Mocked<GetWeeklyStudentReportUseCase>;
  let mockClassUseCase: jest.Mocked<GetClassWeeklyReportsUseCase>;
  let mockStudentRepo: any;

  beforeEach(() => {
    mockWeeklyUseCase = {
      execute: jest.fn().mockResolvedValue({
        report: { id: 'rep-1', sqiScore: 85 } as any,
        hasSessions: true,
        message: undefined,
      }),
    } as any;

    mockClassUseCase = {
      execute: jest.fn().mockResolvedValue({
        summary: { totalStudents: 10, averageSqi: 82 },
        students: [],
      }),
    } as any;

    mockStudentRepo = {
      findOne: jest.fn(),
    };

    controller = new WeeklyStudentReportController(
      mockWeeklyUseCase,
      mockClassUseCase,
      mockStudentRepo,
    );
  });

  describe('1. getMyReport (Phụ huynh / Học sinh)', () => {
    it('1.1. Ưu tiên sử dụng header x-student-id khi phụ huynh chuyển đổi giữa các con', async () => {
      const req = { user: { sub: 'user-parent-1', role: 'STUDENT' } };

      const result = await controller.getMyReport(req, 'child-student-2', '35', '2026');

      expect(mockWeeklyUseCase.execute).toHaveBeenCalledWith({
        studentId: 'child-student-2',
        weekNumber: 35,
        year: 2026,
        requestUserId: 'user-parent-1',
        userRole: 'STUDENT',
      });
      expect(result.data).toBeDefined();
      expect(mockStudentRepo.findOne).not.toHaveBeenCalled();
    });

    it('1.2. Tự động tìm học sinh đầu tiên của phụ huynh nếu không có header x-student-id', async () => {
      const req = { user: { sub: 'user-parent-1', role: 'STUDENT' } };
      mockStudentRepo.findOne.mockResolvedValue({ id: 'child-student-1', userId: 'user-parent-1' });

      const result = await controller.getMyReport(req, undefined, '35', '2026');

      expect(mockStudentRepo.findOne).toHaveBeenCalledWith({ where: { userId: 'user-parent-1' } });
      expect(mockWeeklyUseCase.execute).toHaveBeenCalledWith({
        studentId: 'child-student-1',
        weekNumber: 35,
        year: 2026,
        requestUserId: 'user-parent-1',
        userRole: 'STUDENT',
      });
      expect(result.data).toBeDefined();
    });

    it('1.3. Ném NotFoundException nếu tài khoản không có học sinh nào liên kết', async () => {
      const req = { user: { sub: 'user-parent-orphan', role: 'STUDENT' } };
      mockStudentRepo.findOne.mockResolvedValue(null);

      await expect(
        controller.getMyReport(req, undefined, '35', '2026'),
      ).rejects.toThrow(NotFoundException);
    });

    it('1.4. Ném ForbiddenException nếu không có user.sub trong request context', async () => {
      const req = { user: {} };

      await expect(
        controller.getMyReport(req, 'student-1', '35', '2026'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('2. getClassWeeklyReports (Giáo viên & Admin)', () => {
    it('2.1. Lấy danh sách báo cáo tuần của cả lớp theo classId', async () => {
      const req = { user: { sub: 'teacher-1', role: 'TEACHER' } };

      const result = await controller.getClassWeeklyReports('class-123', req, '35', '2026');

      expect(mockClassUseCase.execute).toHaveBeenCalledWith({
        classId: 'class-123',
        weekNumber: 35,
        year: 2026,
        requestUserId: 'teacher-1',
        userRole: 'TEACHER',
      });
      expect(result.success).toBe(true);
      expect(result.data.summary.totalStudents).toBe(10);
    });
  });

  describe('3. getStudentWeeklyReport (Admin & Giáo viên xem từng em)', () => {
    it('3.1. Cho phép xem báo cáo của một học sinh cụ thể', async () => {
      const req = { user: { sub: 'admin-1', role: 'ADMIN' } };

      const result = await controller.getStudentWeeklyReport('student-abc', req, '35', '2026');

      expect(mockWeeklyUseCase.execute).toHaveBeenCalledWith({
        studentId: 'student-abc',
        weekNumber: 35,
        year: 2026,
        requestUserId: 'admin-1',
        userRole: 'ADMIN',
      });
      expect(result.data).toBeDefined();
    });
  });
});
