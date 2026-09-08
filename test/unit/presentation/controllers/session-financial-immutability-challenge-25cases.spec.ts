/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConflictException } from '@nestjs/common';
import { ClassController } from '../../../../src/presentation/controllers/class.controller';
import { SessionStatus } from '../../../../src/domain/value-objects/session-status.enum';

describe('Session Financial Immutability Challenge - 25 Strict Edge Cases', () => {
  const createQueryBuilder = (result: any[] = []) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue(result),
    getCount: jest.fn().mockResolvedValue(0),
  });

  const createController = () => {
    const sessionQueryBuilder = createQueryBuilder();
    const repos = {
      classRepo: {
        findOne: jest.fn(),
        findOneOrFail: jest.fn(),
        create: jest.fn((val) => val),
        save: jest.fn(async (val) => val),
        createQueryBuilder: jest.fn(() => createQueryBuilder()),
      },
      scheduleRepo: {
        find: jest.fn().mockResolvedValue([]),
        create: jest.fn((val) => val),
        save: jest.fn(async (val) => val),
        delete: jest.fn(),
      },
      sessionRepo: {
        findOne: jest.fn(),
        findOneOrFail: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        find: jest.fn().mockResolvedValue([]),
        create: jest.fn((val) => val),
        save: jest.fn(async (val) => ({ id: 'session-1', ...val })),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
        createQueryBuilder: jest.fn(() => sessionQueryBuilder),
      },
      classStudentRepo: {
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
      },
      attendanceRepo: {
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
        create: jest.fn((val) => val),
        save: jest.fn(async (val) => val),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      },
      courseRepo: { findOne: jest.fn() },
      studentRepo: { findOne: jest.fn() },
      teacherRepo: { findOne: jest.fn() },
      assignmentRepo: { createQueryBuilder: jest.fn(() => createQueryBuilder()) },
      notificationRepo: { create: jest.fn(), save: jest.fn() },
      dataSource: {
        transaction: jest.fn(async (cb: (manager: any) => Promise<any>) => {
          return cb({ save: jest.fn(), create: jest.fn((_, d) => d) });
        }),
      },
    };
    const academics = {
      checkRecurring: { execute: jest.fn().mockResolvedValue(undefined) },
      checkSession: { execute: jest.fn().mockResolvedValue(undefined) },
      enrollStudent: { execute: jest.fn() },
      removeStudent: { execute: jest.fn().mockResolvedValue(undefined) },
      createAdhocSession: { execute: jest.fn() },
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
      { execute: jest.fn().mockResolvedValue([]) } as any,
      academics.checkRecurring as any,
      academics.checkSession as any,
      academics.enrollStudent as any,
      academics.removeStudent as any,
      academics.createAdhocSession as any,
      repos.dataSource as any,
    );

    return { controller, repos, academics, sessionQueryBuilder };
  };

  const mockAdminReq = { user: { sub: 'admin-1', role: 'ADMIN' } };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T08:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // --- Group 1: startAttendance Financial Guards (Cases 1-3) ---
  describe('1. startAttendance Financial Integrity', () => {
    it('Case 01: Blocks startAttendance if session has teacher wageId', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOneOrFail.mockResolvedValue({
        id: 'sess-1',
        status: SessionStatus.SCHEDULED,
        attendanceLocked: false,
        wageId: 'wage-123',
        classEntity: { id: 'c-1' },
      });

      await expect(
        controller.startAttendance(mockAdminReq, 'sess-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('Case 02: Blocks startAttendance if session has assistant wageId', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOneOrFail.mockResolvedValue({
        id: 'sess-1',
        status: SessionStatus.SCHEDULED,
        attendanceLocked: false,
        assistantWageId: 'wage-ta-456',
        classEntity: { id: 'c-1' },
      });

      await expect(
        controller.startAttendance(mockAdminReq, 'sess-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('Case 03: Allows startAttendance if session is unbilled and not wage-locked', async () => {
      const { controller, repos } = createController();
      const mockSession = {
        id: 'sess-1',
        status: SessionStatus.SCHEDULED,
        attendanceLocked: false,
        wageId: null,
        assistantWageId: null,
        classEntity: { id: 'c-1' },
      };
      repos.sessionRepo.findOneOrFail.mockResolvedValue(mockSession);

      const result = await controller.startAttendance(mockAdminReq, 'sess-1');
      expect(result.status).toBe(SessionStatus.IN_PROGRESS);
      expect(repos.sessionRepo.save).toHaveBeenCalled();
    });
  });

  // --- Group 2: revertToScheduled Financial Guards (Cases 4-7) ---
  describe('2. revertToScheduled Financial Integrity', () => {
    it('Case 04: Blocks revertToScheduled if session has teacher wageId', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOneOrFail.mockResolvedValue({
        id: 'sess-2',
        status: SessionStatus.IN_PROGRESS,
        attendanceLocked: false,
        wageId: 'wage-111',
        classEntity: { id: 'c-1' },
      });

      await expect(
        controller.revertToScheduled(mockAdminReq, 'sess-2'),
      ).rejects.toThrow(ConflictException);
    });

    it('Case 05: Blocks revertToScheduled if session has assistant wageId', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOneOrFail.mockResolvedValue({
        id: 'sess-2',
        status: SessionStatus.IN_PROGRESS,
        attendanceLocked: false,
        assistantWageId: 'wage-222',
        classEntity: { id: 'c-1' },
      });

      await expect(
        controller.revertToScheduled(mockAdminReq, 'sess-2'),
      ).rejects.toThrow(ConflictException);
    });

    it('Case 06: Blocks revertToScheduled if any attendance has student billId', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOneOrFail.mockResolvedValue({
        id: 'sess-2',
        status: SessionStatus.IN_PROGRESS,
        attendanceLocked: false,
        classEntity: { id: 'c-1' },
      });
      repos.attendanceRepo.find.mockResolvedValue([
        { id: 'att-1', studentId: 'st-1', billId: 'bill-999' },
      ]);

      await expect(
        controller.revertToScheduled(mockAdminReq, 'sess-2'),
      ).rejects.toThrow(ConflictException);
    });

    it('Case 07: Allows revertToScheduled when in-progress with zero wageId and zero billId', async () => {
      const { controller, repos } = createController();
      const mockSession = {
        id: 'sess-2',
        status: SessionStatus.IN_PROGRESS,
        attendanceLocked: false,
        wageId: null,
        assistantWageId: null,
        classEntity: { id: 'c-1' },
      };
      repos.sessionRepo.findOneOrFail.mockResolvedValue(mockSession);
      repos.attendanceRepo.find.mockResolvedValue([
        { id: 'att-1', studentId: 'st-1', billId: null },
      ]);

      const res = await controller.revertToScheduled(mockAdminReq, 'sess-2');
      expect(res.status).toBe(SessionStatus.SCHEDULED);
      expect(repos.attendanceRepo.update).toHaveBeenCalledWith(
        { classSessionId: 'sess-2' },
        { isPresent: false, reason: null, note: null },
      );
    });
  });

  // --- Group 3: saveAttendance Financial Guards (Cases 8-11) ---
  describe('3. saveAttendance Financial Integrity', () => {
    it('Case 08: Blocks saveAttendance if session has teacher wageId', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOneOrFail.mockResolvedValue({
        id: 'sess-3',
        status: SessionStatus.IN_PROGRESS,
        attendanceLocked: false,
        wageId: 'wage-teacher-333',
        classEntity: { id: 'c-1' },
      });

      await expect(
        controller.saveAttendance(mockAdminReq, 'sess-3', { attendance: [] }),
      ).rejects.toThrow(ConflictException);
    });

    it('Case 09: Blocks saveAttendance if session has assistant wageId', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOneOrFail.mockResolvedValue({
        id: 'sess-3',
        status: SessionStatus.IN_PROGRESS,
        attendanceLocked: false,
        assistantWageId: 'wage-ta-444',
        classEntity: { id: 'c-1' },
      });

      await expect(
        controller.saveAttendance(mockAdminReq, 'sess-3', { attendance: [] }),
      ).rejects.toThrow(ConflictException);
    });

    it('Case 10: Blocks saveAttendance if any student has billId', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOneOrFail.mockResolvedValue({
        id: 'sess-3',
        status: SessionStatus.IN_PROGRESS,
        attendanceLocked: false,
        classEntity: { id: 'c-1' },
      });
      repos.attendanceRepo.find.mockResolvedValue([
        { id: 'att-3', billId: 'bill-student-555' },
      ]);

      await expect(
        controller.saveAttendance(mockAdminReq, 'sess-3', { attendance: [] }),
      ).rejects.toThrow(ConflictException);
    });

    it('Case 11: Allows saveAttendance when session is unbilled and unwaged', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOneOrFail.mockResolvedValue({
        id: 'sess-3',
        status: SessionStatus.IN_PROGRESS,
        attendanceLocked: false,
        wageId: null,
        assistantWageId: null,
        classEntity: { id: 'c-1' },
      });
      repos.attendanceRepo.find.mockResolvedValue([]);
      repos.attendanceRepo.findOne.mockResolvedValue(null);

      const res = await controller.saveAttendance(mockAdminReq, 'sess-3', {
        attendance: [{ studentId: 'st-1', isPresent: true }],
      });
      expect(res.message).toBe('Điểm danh lưu thành công');
      expect(repos.attendanceRepo.save).toHaveBeenCalled();
    });
  });

  // --- Group 4: overrideAttendance Financial Guards (Cases 12-15) ---
  describe('4. overrideAttendance Financial Integrity', () => {
    it('Case 12: Blocks overrideAttendance if session has teacher wageId', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOneOrFail.mockResolvedValue({
        id: 'sess-4',
        attendanceLocked: true,
        wageId: 'wage-teacher-666',
      });

      await expect(
        controller.overrideAttendance('sess-4', { attendance: [] }),
      ).rejects.toThrow(ConflictException);
    });

    it('Case 13: Blocks overrideAttendance if session has assistant wageId', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOneOrFail.mockResolvedValue({
        id: 'sess-4',
        attendanceLocked: true,
        assistantWageId: 'wage-ta-777',
      });

      await expect(
        controller.overrideAttendance('sess-4', { attendance: [] }),
      ).rejects.toThrow(ConflictException);
    });

    it('Case 14: Blocks overrideAttendance if any record has billId', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOneOrFail.mockResolvedValue({
        id: 'sess-4',
        attendanceLocked: true,
      });
      repos.attendanceRepo.find.mockResolvedValue([
        { id: 'att-4', billId: 'bill-student-888' },
      ]);

      await expect(
        controller.overrideAttendance('sess-4', { attendance: [] }),
      ).rejects.toThrow(ConflictException);
    });

    it('Case 15: Allows overrideAttendance if session is locked but unwaged and unbilled', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOneOrFail.mockResolvedValue({
        id: 'sess-4',
        attendanceLocked: true,
        wageId: null,
        assistantWageId: null,
      });
      repos.attendanceRepo.find.mockResolvedValue([]);
      repos.attendanceRepo.findOne.mockResolvedValue(null);

      const res = await controller.overrideAttendance('sess-4', {
        attendance: [{ studentId: 'st-1', isPresent: true, reason: 'Phép bổ sung' }],
      });
      expect(res.message).toContain('Đã cập nhật điểm danh thành công');
    });
  });

  // --- Group 5: updateSession Financial Guards (Cases 16-22) ---
  describe('5. updateSession Financial Integrity', () => {
    it('Case 16: Blocks changing teacherId if session has teacher wageId', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOneOrFail.mockResolvedValue({
        id: 'sess-5', wageId: 'wage-t-999', attendanceLocked: false, date: '2026-06-20',
      });
      await expect(
        controller.updateSession('sess-5', { teacherId: 't-new' }, mockAdminReq),
      ).rejects.toThrow(ConflictException);
    });

    it('Case 17: Blocks changing assistantId if session has assistant wageId', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOneOrFail.mockResolvedValue({
        id: 'sess-5', assistantWageId: 'wage-ta-999', attendanceLocked: false, date: '2026-06-20',
      });
      await expect(
        controller.updateSession('sess-5', { assistantId: 'ta-new' }, mockAdminReq),
      ).rejects.toThrow(ConflictException);
    });

    it('Case 18: Blocks changing date if session has wageId', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOneOrFail.mockResolvedValue({
        id: 'sess-5', wageId: 'wage-locked', attendanceLocked: false, date: '2026-06-20',
      });
      await expect(
        controller.updateSession('sess-5', { date: '2026-06-21' }, mockAdminReq),
      ).rejects.toThrow(ConflictException);
    });

    it('Case 19: Blocks changing times if session has wageId', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOneOrFail.mockResolvedValue({
        id: 'sess-5', wageId: 'wage-locked', attendanceLocked: false, date: '2026-06-20',
      });
      await expect(
        controller.updateSession('sess-5', { startTime: '10:00', endTime: '12:00' }, mockAdminReq),
      ).rejects.toThrow(ConflictException);
    });

    it('Case 20: Blocks changing roomId if session has wageId', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOneOrFail.mockResolvedValue({
        id: 'sess-5', wageId: 'wage-locked', attendanceLocked: false, date: '2026-06-20',
      });
      await expect(
        controller.updateSession('sess-5', { roomId: 'room-101' }, mockAdminReq),
      ).rejects.toThrow(ConflictException);
    });

    it('Case 21: Blocks updateSession if any attendance has billId', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOneOrFail.mockResolvedValue({
        id: 'sess-5', wageId: null, attendanceLocked: false, date: '2026-06-20',
      });
      repos.attendanceRepo.find.mockResolvedValue([{ id: 'att-b', billId: 'bill-1' }]);

      await expect(
        controller.updateSession('sess-5', { roomId: 'room-101' }, mockAdminReq),
      ).rejects.toThrow(ConflictException);
    });

    it('Case 22: all-future updates exclude wage-locked future sessions from query', async () => {
      const { controller, repos, sessionQueryBuilder } = createController();
      repos.sessionRepo.findOneOrFail.mockResolvedValue({
        id: 'sess-future-root', classId: 'class-1', date: '2026-06-20',
        startTime: '08:00', endTime: '10:00', attendanceLocked: false, wageId: null, assistantWageId: null,
      });
      sessionQueryBuilder.getMany.mockResolvedValue([]);

      await controller.updateSession(
        'sess-future-root',
        { scope: 'all-future', startTime: '09:00', endTime: '11:00' },
        mockAdminReq,
      );

      expect(sessionQueryBuilder.andWhere).toHaveBeenCalledWith(
        's.wage_id IS NULL AND s.assistant_wage_id IS NULL',
      );
    });
  });

  // --- Group 6: deleteSession Financial Guards (Cases 23-25) ---
  describe('6. deleteSession Financial Integrity', () => {
    it('Case 23: Throws ConflictException when deleting session with wageId', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOne.mockResolvedValue({
        id: 'sess-del-1', status: SessionStatus.SCHEDULED, attendanceLocked: false, wageId: 'wage-active-123',
      });
      await expect(controller.deleteSession('sess-del-1')).rejects.toThrow(ConflictException);
    });

    it('Case 24: Throws ConflictException when deleting session with assistantWageId', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOne.mockResolvedValue({
        id: 'sess-del-2', status: SessionStatus.SCHEDULED, attendanceLocked: false, assistantWageId: 'wage-ta-456',
      });
      await expect(controller.deleteSession('sess-del-2')).rejects.toThrow(ConflictException);
    });

    it('Case 25: Throws ConflictException when deleting session with billedTeacherWage or billedAssistantWage > 0', async () => {
      const { controller, repos } = createController();
      repos.sessionRepo.findOne.mockResolvedValue({
        id: 'sess-del-3', status: SessionStatus.SCHEDULED, attendanceLocked: false, wageId: null, billedTeacherWage: 250000,
      });
      await expect(controller.deleteSession('sess-del-3')).rejects.toThrow(ConflictException);
    });
  });
});
