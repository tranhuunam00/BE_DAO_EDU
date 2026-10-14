/* eslint-disable @typescript-eslint/no-explicit-any */
import { performance } from 'perf_hooks';
import { ClassController } from '../../../../src/presentation/controllers/class.controller';
import { SessionStatus } from '../../../../src/domain/value-objects/session-status.enum';

const WEEKDAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const daysFromToday = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

const makeQueryBuilder = (overrides: any = {}) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({ affected: 0 }),
  getOne: jest.fn().mockResolvedValue(null),
  getMany: jest.fn().mockResolvedValue([]),
  getRawMany: jest.fn().mockResolvedValue([]),
  getCount: jest.fn().mockResolvedValue(0),
  update: jest.fn().mockReturnThis(),
  ...overrides,
});

const makeTestHarness = () => {
  const transactionManager = {
    save: jest.fn(async (Entity: any, data: any) => {
      const actualData = data !== undefined ? data : Entity;
      if (Array.isArray(actualData)) {
        return actualData.map((d: any) => ({ id: d.id || `session-${Math.random()}`, ...d }));
      }
      return { id: actualData.id || `session-${Math.random()}`, ...actualData };
    }),
    create: jest.fn((Entity: any, data: any) => data !== undefined ? data : Entity),
  };

  const repos = {
    classRepo: {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      findOneOrFail: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (v) => v),
      createQueryBuilder: jest.fn(() => makeQueryBuilder()),
    },
    scheduleRepo: {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => v),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    },
    sessionRepo: {
      findOne: jest.fn().mockResolvedValue(null),
      findOneOrFail: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((v) => ({ id: `session-${Math.random()}`, ...v })),
      save: jest.fn(async (v) => ({ id: `session-${Math.random()}`, ...v })),
      createQueryBuilder: jest.fn(() => makeQueryBuilder()),
    },
    classStudentRepo: {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    attendanceRepo: {
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    },
    courseRepo: { findOne: jest.fn().mockResolvedValue(null) },
    studentRepo: { findOne: jest.fn() },
    teacherRepo: { findOne: jest.fn() },
    assignmentRepo: { createQueryBuilder: jest.fn(() => makeQueryBuilder()) },
    notificationRepo: { create: jest.fn((v) => v), save: jest.fn() },
    dataSource: {
      transaction: jest.fn(async (cb: (manager: any) => Promise<any>) => cb(transactionManager)),
    },
    transactionManager,
  };

  const ctrl = new ClassController(
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
    { execute: jest.fn().mockResolvedValue(undefined) } as any,
    { execute: jest.fn().mockResolvedValue(undefined) } as any,
    { execute: jest.fn() } as any,
    { execute: jest.fn().mockResolvedValue(undefined) } as any,
    { execute: jest.fn().mockResolvedValue(undefined) } as any,
    repos.dataSource as any,
  );

  return { ctrl, repos, transactionManager };
};

describe('ClassController - Đổi giờ học an toàn & Performance Benchmark (TDD)', () => {
  const classId = 'a0000000-0000-0000-0000-000000000001';
  const nextSaturday = daysFromToday((6 - new Date().getDay() + 7) % 7 || 7);

  describe('1. Kiểm tra gọi findOne nội bộ không bị classId: undefined', () => {
    it('1.1. Khi gọi findOne(classId) dạng nội bộ (1 tham số), scheduleRepo và classStudentRepo phải được truy vấn đúng classId', async () => {
      const { ctrl, repos } = makeTestHarness();
      repos.classRepo.findOne.mockResolvedValue({
        id: classId,
        className: 'TOÁN 8.2',
        status: 'Active',
      });

      await ctrl.findOne(classId as any);

      expect(repos.scheduleRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { classId },
        }),
      );
      expect(repos.classStudentRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { classId },
        }),
      );
    });
  });

  describe('2. Đổi giờ học và tái sinh buổi học với các buổi học tương lai đã có hóa đơn (Billed Sessions)', () => {
    it('2.1. Buổi học tương lai có hóa đơn (không được xóa) phải được dời giờ học mới thay vì tạo thêm buổi trùng lặp', async () => {
      const { ctrl, repos, transactionManager } = makeTestHarness();
      const existingBilledSession = {
        id: 'session-billed-1',
        classId,
        date: nextSaturday,
        startTime: '08:30:00',
        endTime: '10:30:00',
        roomId: 'room-1',
        status: SessionStatus.SCHEDULED,
        attendanceLocked: false,
        teacherId: 'teacher-1',
        assistantId: null,
      };

      repos.classRepo.findOneOrFail.mockResolvedValue({
        id: classId,
        classCode: 'TOAN8.2',
        className: 'TOÁN 8.2',
        status: 'Active',
        startDate: daysFromToday(-30),
        finishDate: daysFromToday(30),
        mainTeacherId: 'teacher-1',
        assistantId: null,
      });

      repos.classRepo.findOne.mockResolvedValue({
        id: classId,
        classCode: 'TOAN8.2',
        className: 'TOÁN 8.2',
        status: 'Active',
      });

      // SessionCandidate contains this session
      repos.sessionRepo.find.mockResolvedValue([existingBilledSession]);
      // Attendance has billId -> AttendanceDeletionGuard marks unsafe
      repos.attendanceRepo.find.mockResolvedValue([
        { id: 'att-1', classSessionId: existingBilledSession.id, billId: 'bill-1' },
      ]);

      const newSchedules = [
        { weekday: WEEKDAY_KEYS[new Date(nextSaturday).getDay()], startTime: '09:00', endTime: '11:00', roomId: 'room-1' },
      ];

      repos.scheduleRepo.find.mockResolvedValue([
        {
          classId,
          weekday: WEEKDAY_KEYS[new Date(nextSaturday).getDay()],
          startTime: '09:00:00',
          endTime: '11:00:00',
          roomId: 'room-1',
        },
      ]);

      await ctrl.update(classId, { schedules: newSchedules });

      // Transaction manager save must update the existing billed session to new hours, NOT create a duplicate
      const saveCalls = transactionManager.save.mock.calls;
      const updatedSessions = saveCalls.find((call: any[]) =>
        call[1] && (call[1].id === 'session-billed-1' || (Array.isArray(call[1]) && call[1].some((s: any) => s.id === 'session-billed-1'))),
      );

      expect(updatedSessions).toBeDefined();
      const targetSession = Array.isArray(updatedSessions[1])
        ? updatedSessions[1].find((s: any) => s.id === 'session-billed-1')
        : updatedSessions[1];

      expect(targetSession.startTime).toMatch(/^09:00/);
      expect(targetSession.endTime).toMatch(/^11:00/);
    });
  });

  describe('3. Performance Benchmark (SLA Limit)', () => {
    it('3.1. Quá trình xử lý đổi lịch và dời giờ các buổi học phải hoàn thành dưới SLA 100ms', async () => {
      const { ctrl, repos } = makeTestHarness();
      repos.classRepo.findOneOrFail.mockResolvedValue({
        id: classId,
        classCode: 'TOAN8.2',
        className: 'TOÁN 8.2',
        status: 'Active',
        startDate: daysFromToday(1),
        finishDate: daysFromToday(90),
        mainTeacherId: 'teacher-1',
      });
      repos.classRepo.findOne.mockResolvedValue({ id: classId, status: 'Active' });
      repos.scheduleRepo.find.mockResolvedValue([
        { weekday: 'Sat', startTime: '09:00:00', endTime: '11:00:00', roomId: 'room-1' },
        { weekday: 'Tue', startTime: '18:30:00', endTime: '20:30:00', roomId: 'room-1' },
      ]);

      const t0 = performance.now();
      await ctrl.update(classId, {
        schedules: [
          { weekday: 'Sat', startTime: '09:00', endTime: '11:00', roomId: 'room-1' },
          { weekday: 'Tue', startTime: '18:30', endTime: '20:30', roomId: 'room-1' },
        ],
      });
      const durationMs = performance.now() - t0;

      expect(durationMs).toBeLessThan(100);
    });
  });
});
