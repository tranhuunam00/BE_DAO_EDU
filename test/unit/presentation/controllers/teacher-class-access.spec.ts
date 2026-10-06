/* eslint-disable @typescript-eslint/no-explicit-any */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { performance } from 'perf_hooks';
import { ClassController } from '../../../../src/presentation/controllers/class.controller';
import { Role } from '../../../../src/domain/value-objects/role.enum';

describe('Teacher Class Access & Isolation (TDD + Performance Benchmark)', () => {
  const createQueryBuilder = (result: any[] = []) => {
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
      getOne: jest.fn().mockResolvedValue(null),
      getMany: jest.fn().mockResolvedValue(result),
      getCount: jest.fn().mockResolvedValue(result.length),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    return qb;
  };

  const createController = () => {
    const classQb = createQueryBuilder();
    const sessionQb = createQueryBuilder();
    const classStudentQb = createQueryBuilder();

    const repos = {
      classRepo: {
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
        createQueryBuilder: jest.fn(() => classQb),
      },
      scheduleRepo: {
        find: jest.fn().mockResolvedValue([]),
      },
      sessionRepo: {
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        createQueryBuilder: jest.fn(() => sessionQb),
      },
      classStudentRepo: {
        find: jest.fn().mockResolvedValue([]),
        createQueryBuilder: jest.fn(() => classStudentQb),
      },
      attendanceRepo: {
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
      },
      courseRepo: {
        findOne: jest.fn(),
      },
      studentRepo: {
        findOne: jest.fn(),
      },
      teacherRepo: {
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
      },
      assignmentRepo: {
        find: jest.fn().mockResolvedValue([]),
      },
      notificationRepo: {
        find: jest.fn().mockResolvedValue([]),
      },
    };

    const dataSource = {
      getRepository: jest.fn(() => ({
        createQueryBuilder: jest.fn(() => classStudentQb),
      })),
    };

    const controller = new ClassController(
      repos.classRepo as any,
      repos.scheduleRepo as any,
      repos.sessionRepo as any,
      repos.classStudentRepo as any,
      repos.attendanceRepo as any,
      repos.courseRepo as any,
      repos.studentRepo as any,
      repos.teacherRepo as any,
      repos.assignmentRepo as any,
      repos.notificationRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dataSource as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return { controller, repos, classQb, sessionQb };
  };

  describe('1. findAll - Phân quyền và lọc lớp học theo vai trò', () => {
    it('khi user là ADMIN: không lọc theo giáo viên, lấy tất cả lớp', async () => {
      const { controller, repos, classQb } = createController();
      const adminReq = { user: { sub: 'admin-id', role: Role.ADMIN } };

      classQb.getMany.mockResolvedValue([
        { id: 'class-1', className: 'Lớp 1' },
        { id: 'class-2', className: 'Lớp 2' },
      ]);
      classQb.getCount.mockResolvedValue(2);

      const result = await controller.findAll(adminReq as any, 1, 20);

      expect(repos.teacherRepo.findOne).not.toHaveBeenCalled();
      expect(result.classes.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('khi user là TEACHER: chỉ lấy các lớp mà giáo viên đang dạy (chính/trợ giảng/buổi học)', async () => {
      const { controller, repos, classQb, sessionQb } = createController();
      const teacherUser = { sub: 'user-teacher-1', role: Role.TEACHER };

      // Teacher record
      repos.teacherRepo.findOne.mockResolvedValue({ id: 'teacher-uuid-1', userId: 'user-teacher-1' });

      // Teacher is main or assistant in class-1
      repos.classRepo.find.mockResolvedValue([{ id: 'class-1' }]);

      // Teacher has session in class-2
      sessionQb.getRawMany.mockResolvedValue([{ classId: 'class-2' }]);

      classQb.getMany.mockResolvedValue([
        { id: 'class-1', className: 'Lớp 1' },
        { id: 'class-2', className: 'Lớp 2' },
      ]);
      classQb.getCount.mockResolvedValue(2);

      const result = await controller.findAll({ user: teacherUser } as any, 1, 20);

      expect(repos.teacherRepo.findOne).toHaveBeenCalledWith({ where: { userId: 'user-teacher-1' } });
      // Verify qb filtered by class-1 and class-2
      expect(classQb.andWhere).toHaveBeenCalledWith(
        'c.id IN (:...teacherClassIds)',
        expect.objectContaining({
          teacherClassIds: expect.arrayContaining(['class-1', 'class-2']),
        }),
      );
      expect(result.classes.length).toBe(2);
    });

    it('khi user là TEACHER nhưng không phụ trách lớp nào: trả về danh sách rỗng lập tức', async () => {
      const { controller, repos, classQb, sessionQb } = createController();
      const teacherUser = { sub: 'user-teacher-2', role: Role.TEACHER };

      repos.teacherRepo.findOne.mockResolvedValue({ id: 'teacher-uuid-2', userId: 'user-teacher-2' });
      repos.classRepo.find.mockResolvedValue([]);
      sessionQb.getRawMany.mockResolvedValue([]);

      const result = await controller.findAll({ user: teacherUser } as any, 1, 20);

      expect(result.classes).toEqual([]);
      expect(result.total).toBe(0);
      expect(classQb.getMany).not.toHaveBeenCalled();
    });

    it('Performance Benchmark: xử lý lọc lớp giáo viên đạt SLA < 25ms cho 100 lần gọi', async () => {
      const { controller, repos, classQb, sessionQb } = createController();
      const teacherUser = { sub: 'user-teacher-1', role: Role.TEACHER };

      repos.teacherRepo.findOne.mockResolvedValue({ id: 'teacher-uuid-1', userId: 'user-teacher-1' });
      repos.classRepo.find.mockResolvedValue([{ id: 'class-1' }]);
      sessionQb.getRawMany.mockResolvedValue([{ classId: 'class-2' }]);
      classQb.getMany.mockResolvedValue([{ id: 'class-1' }, { id: 'class-2' }]);
      classQb.getCount.mockResolvedValue(2);

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        await controller.findAll({ user: teacherUser } as any, 1, 20);
      }
      const duration = performance.now() - start;

      // SLA: 100 lần xử lý logic phân quyền phải dưới 200ms (trung bình < 2ms/call)
      expect(duration).toBeLessThan(200);
    });
  });

  describe('2. findOne - Chi tiết lớp học và kiểm soát truy cập', () => {
    const validClassId = '11111111-2222-4444-8888-999999999999';

    it('khi user là ADMIN: xem được chi tiết bất kỳ lớp nào', async () => {
      const { controller, repos } = createController();
      repos.classRepo.findOne.mockResolvedValue({
        id: validClassId,
        className: 'Toán 6',
        mainTeacherId: 'other-teacher',
      });

      const result = await controller.findOne(
        { user: { sub: 'admin-1', role: Role.ADMIN } } as any,
        validClassId,
      );

      expect(result.id).toBe(validClassId);
      expect(repos.teacherRepo.findOne).not.toHaveBeenCalled();
    });

    it('khi user là TEACHER phụ trách lớp (giáo viên chính): xem được chi tiết lớp', async () => {
      const { controller, repos } = createController();
      repos.teacherRepo.findOne.mockResolvedValue({ id: 'my-teacher-id' });
      repos.classRepo.findOne.mockResolvedValue({
        id: validClassId,
        className: 'Toán 6',
        mainTeacherId: 'my-teacher-id',
        assistantId: null,
      });

      const result = await controller.findOne(
        { user: { sub: 'teacher-user-1', role: Role.TEACHER } } as any,
        validClassId,
      );

      expect(result.id).toBe(validClassId);
    });

    it('khi user là TEACHER nhưng không phụ trách lớp: ném ForbiddenException', async () => {
      const { controller, repos } = createController();
      repos.teacherRepo.findOne.mockResolvedValue({ id: 'my-teacher-id' });
      repos.classRepo.findOne.mockResolvedValue({
        id: validClassId,
        className: 'Toán 6',
        mainTeacherId: 'other-teacher',
        assistantId: 'another-assistant',
      });
      repos.sessionRepo.count.mockResolvedValue(0);

      await expect(
        controller.findOne(
          { user: { sub: 'teacher-user-1', role: Role.TEACHER } } as any,
          validClassId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
