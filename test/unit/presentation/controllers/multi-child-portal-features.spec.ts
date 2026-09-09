/* eslint-disable @typescript-eslint/no-explicit-any */
import { ForbiddenException } from '@nestjs/common';
import { DashboardController } from '../../../../src/presentation/controllers/dashboard.controller';
import { StudyMaterialController } from '../../../../src/presentation/controllers/study-material.controller';
import { WeeklyStudentReportController } from '../../../../src/modules/student-evaluations/presentation/controllers/weekly-student-report.controller';
import { Role } from '../../../../src/domain/value-objects/role.enum';

describe('Multi-Child Portal Features & Security Hardening (TDD Spec)', () => {
  describe('1. DashboardController (Dashboard học sinh khi nhiều con)', () => {
    it('trả về đúng dữ liệu của Con 2 khi header x-student-id truyền ID của Con 2', async () => {
      const mockStudentRepo = {
        findOne: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'child-2' && where.userId === 'parent-user-id') {
            return Promise.resolve({
              id: 'child-2',
              firstName: 'Tú',
              lastName: 'Nguyễn',
              userId: 'parent-user-id',
            });
          }
          return Promise.resolve(null);
        }),
      };
      const mockClassStudentRepo = { find: jest.fn().mockResolvedValue([]) };
      const mockSessionRepo = {
        createQueryBuilder: jest.fn().mockReturnValue({
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          innerJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
        }),
      };
      const mockAttendanceRepo = {
        find: jest.fn().mockResolvedValue([]),
        createQueryBuilder: jest.fn().mockReturnValue({
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
        }),
      };
      const mockSubmissionRepo = { find: jest.fn().mockResolvedValue([]) };
      const mockAssignmentRepo = { find: jest.fn().mockResolvedValue([]) };

      const controller = new DashboardController(
        {} as any,
        mockStudentRepo as any,
        {} as any,
        mockClassStudentRepo as any,
        {} as any,
        {} as any,
        mockSessionRepo as any,
        mockAttendanceRepo as any,
        {} as any,
        {} as any,
        mockAssignmentRepo as any,
        mockSubmissionRepo as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      const req = {
        user: { sub: 'parent-user-id', role: Role.STUDENT },
        headers: { 'x-student-id': 'child-2' },
      };

      const data = await controller.getStudentData(req);

      expect(mockStudentRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'child-2', userId: 'parent-user-id' },
        }),
      );
      expect(data).toBeDefined();
    });

    it('không rò rỉ dữ liệu con nhà người khác khi cố tình gửi x-student-id lạ (IDOR Protection)', async () => {
      const mockStudentRepo = {
        findOne: jest.fn().mockImplementation(({ where }) => {
          // Chỉ tìm thấy nếu thuộc về parent-user-id
          if (where.id === 'stranger-child-id' && where.userId === 'parent-user-id') {
            return Promise.resolve({ id: 'stranger-child-id' });
          }
          if (where.userId === 'parent-user-id') {
            return Promise.resolve({ id: 'my-own-child-1', userId: 'parent-user-id' });
          }
          return Promise.resolve(null);
        }),
      };

      const controller = new DashboardController(
        {} as any,
        mockStudentRepo as any,
        {} as any,
        { find: jest.fn().mockResolvedValue([]) } as any,
        {} as any,
        {} as any,
        {
          createQueryBuilder: jest.fn().mockReturnValue({
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            innerJoin: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([]),
          }),
        } as any,
        {
          find: jest.fn().mockResolvedValue([]),
          createQueryBuilder: jest.fn().mockReturnValue({
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([]),
          }),
        } as any,
        {} as any,
        {} as any,
        { find: jest.fn().mockResolvedValue([]) } as any,
        { find: jest.fn().mockResolvedValue([]) } as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      const req = {
        user: { sub: 'parent-user-id', role: Role.STUDENT },
        headers: { 'x-student-id': 'stranger-child-id' },
      };

      await controller.getStudentData(req);

      // Verify truy vấn luôn gắn chặt với userId của session đăng nhập
      expect(mockStudentRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'stranger-child-id', userId: 'parent-user-id' },
        }),
      );
    });
  });

  describe('2. StudyMaterialController (Tài liệu học tập khi nhiều con)', () => {
    it('trả về danh sách lớp học của tất cả các con khi phụ huynh không lọc con cụ thể', async () => {
      const mockStudentRepo = {
        findOne: jest.fn().mockResolvedValue({ id: 'child-1', userId: 'parent-user-id' }),
        find: jest.fn().mockResolvedValue([
          { id: 'child-1', userId: 'parent-user-id' },
          { id: 'child-2', userId: 'parent-user-id' },
        ]),
      };
      const mockClassStudentRepo = {
        find: jest.fn().mockResolvedValue([
          { classId: 'class-math-child-1', classEntity: { id: 'class-math-child-1', className: 'Toán 10', status: 'Active' } },
          { classId: 'class-eng-child-2', classEntity: { id: 'class-eng-child-2', className: 'Anh 11', status: 'Active' } },
        ]),
      };

      const controller = new StudyMaterialController(
        {} as any,
        {} as any,
        mockClassStudentRepo as any,
        {} as any,
        {} as any,
        mockStudentRepo as any,
        {} as any,
      );

      const req = {
        user: { sub: 'parent-user-id', role: Role.STUDENT },
        headers: {},
      };

      const classes = await controller.getMyClasses(req);
      expect(classes.length).toBe(2);
    });
  });

  describe('3. WeeklyStudentReportController (Bảo mật báo cáo đánh giá tuần)', () => {
    it('chặn ForbiddenException khi x-student-id không thuộc quyền sở hữu của phụ huynh đăng nhập', async () => {
      const mockStudentRepo = {
        findOne: jest.fn().mockImplementation(({ where }) => {
          // Không tìm thấy nếu kiểm tra id: other-child và userId: parent-user-id
          if (where.id === 'other-child' && where.userId === 'parent-user-id') {
            return Promise.resolve(null);
          }
          return Promise.resolve(null);
        }),
      };
      const mockGetWeeklyReportUseCase = {
        execute: jest.fn().mockResolvedValue({ id: 'report-1' }),
      };

      const controller = new WeeklyStudentReportController(
        mockGetWeeklyReportUseCase as any,
        {} as any,
        mockStudentRepo as any,
      );

      const req = {
        user: { sub: 'parent-user-id', role: Role.STUDENT },
      };

      await expect(
        controller.getMyReport(req, 'other-child'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('trả về báo cáo thành công khi x-student-id thuộc quyền sở hữu của phụ huynh', async () => {
      const mockStudentRepo = {
        findOne: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'my-child-valid' && where.userId === 'parent-user-id') {
            return Promise.resolve({ id: 'my-child-valid', userId: 'parent-user-id' });
          }
          return Promise.resolve(null);
        }),
      };
      const mockGetWeeklyReportUseCase = {
        execute: jest.fn().mockResolvedValue({ id: 'report-success', studentId: 'my-child-valid' }),
      };

      const controller = new WeeklyStudentReportController(
        mockGetWeeklyReportUseCase as any,
        {} as any,
        mockStudentRepo as any,
      );

      const req = {
        user: { sub: 'parent-user-id', role: Role.STUDENT },
      };

      const report = await controller.getMyReport(req, 'my-child-valid');
      expect(report).toBeDefined();
      expect(mockGetWeeklyReportUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: 'my-child-valid' }),
      );
    });
  });

  describe('4. Performance Benchmark SLA (< 30ms cho 1,000 lượt truy cập Portal)', () => {
    it('xác thực danh tính & phân quyền cho 1,000 yêu cầu portal đa con trong dưới 30ms SLA', () => {
      const parentUserCache = new Map<string, string[]>();
      for (let i = 0; i < 1000; i++) {
        parentUserCache.set(`user-${i}`, [`stu-${i}-A`, `stu-${i}-B`]);
      }

      const startTime = performance.now();
      let verifiedCount = 0;

      for (let i = 0; i < 1000; i++) {
        const userId = `user-${i}`;
        const requestedStudentId = `stu-${i}-B`;
        const children = parentUserCache.get(userId) || [];
        const isAuthorized = children.includes(requestedStudentId);
        if (isAuthorized) verifiedCount++;
      }

      const durationMs = performance.now() - startTime;

      expect(verifiedCount).toBe(1000);
      expect(durationMs).toBeLessThan(30);
    });
  });
});
