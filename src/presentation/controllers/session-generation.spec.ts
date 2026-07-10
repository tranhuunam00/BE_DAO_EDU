/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Test suite: Session Generation Rules
 *
 * Business rules being tested:
 * 1. generateSessions() chỉ sinh buổi học TỪ HÔM NAY TRỞ ĐI (tương lai).
 * 2. Buổi mới được sinh ra phải có status = "Scheduled" (Chưa bắt đầu).
 * 3. Buổi hiện có với status IN_PROGRESS / COMPLETED không bao giờ bị ghi đè hay tạo lại.
 * 4. Buổi hiện có status = SCHEDULED, ngày tương lai, attendance_locked = false
 *    → chỉ cập nhật teacher/assistant, KHÔNG tạo record mới.
 * 5. regenerateFutureSessions() xóa buổi SCHEDULED tương lai chưa khoá trước khi tái sinh.
 *    Buổi IN_PROGRESS / COMPLETED / đã khoá KHÔNG bị xóa.
 * 6. Nếu lớp không Active, không có lịch, hoặc không có startDate → không sinh buổi.
 * 7. Ngày trùng ngày lễ (skipHolidays=true) → bỏ qua.
 */

import { ConflictException } from '@nestjs/common';
import { ClassController } from './class.controller';
import { SessionStatus } from '../../domain/value-objects/session-status.enum';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { StudentAttendanceOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';

// ─── Shared helpers ────────────────────────────────────────────────────────────

/** Returns today's date string YYYY-MM-DD */
const todayStr = () => new Date().toISOString().split('T')[0];

/** Returns a date string N days from today */
const daysFromToday = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

/** Returns a date string N days BEFORE today */
const daysAgo = (n: number) => daysFromToday(-n);

/** Map 0-6 → 3-char weekday key used by the schedule entity */
const WEEKDAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Get the weekday key for a date string */
const weekdayOf = (dateStr: string) => WEEKDAY_KEYS[new Date(dateStr).getDay()];

// ─── Controller factory ────────────────────────────────────────────────────────

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

const makeRepos = (overrides: any = {}) => {
  const transactionManager = {
    save: jest.fn(async (Entity: any, data: any) => {
      const actualData = data !== undefined ? data : Entity;
      if (Array.isArray(actualData)) {
        return actualData.map((d: any) => ({ id: `id-${Math.random()}`, ...d }));
      }
      return { id: `id-${Math.random()}`, ...actualData };
    }),
    create: jest.fn((Entity: any, data: any) => {
      const actualData = data !== undefined ? data : Entity;
      return actualData;
    }),
  };

  const repos = {
    classRepo: {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      findOneOrFail: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(() => makeQueryBuilder()),
      ...overrides.classRepo,
    },
    scheduleRepo: {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => v),
      delete: jest.fn(),
      ...overrides.scheduleRepo,
    },
    sessionRepo: {
      findOne: jest.fn().mockResolvedValue(null),
      findOneOrFail: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((v) => ({ id: `session-${Math.random()}`, ...v })),
      save: jest.fn(async (v) => ({ id: `session-${Math.random()}`, ...v })),
      createQueryBuilder: jest.fn(() => makeQueryBuilder()),
      ...overrides.sessionRepo,
    },
    classStudentRepo: {
      findOne: jest.fn().mockResolvedValue(null),
      findOneOrFail: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => v),
      ...overrides.classStudentRepo,
    },
    attendanceRepo: {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => v),
      delete: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      ...overrides.attendanceRepo,
    },
    courseRepo: { findOne: jest.fn() },
    studentRepo: { findOne: jest.fn(), save: jest.fn(async (v) => v) },
    teacherRepo: { findOne: jest.fn() },
    assignmentRepo: { createQueryBuilder: jest.fn(() => makeQueryBuilder()) },
    notificationRepo: { create: jest.fn((v) => v), save: jest.fn() },
    dataSource: {
      transaction: jest.fn(async (cb: (manager: any) => Promise<any>) => {
        return cb(transactionManager);
      }),
    },
    transactionManager,
    ...overrides,
  };

  return repos;
};

const makeController = (repoOverrides: any = {}) => {
  const repos = makeRepos(repoOverrides);
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
    { execute: jest.fn().mockResolvedValue([]) } as any,  // getHolidayDates
    { execute: jest.fn().mockResolvedValue(undefined) } as any,  // checkRecurring
    { execute: jest.fn().mockResolvedValue(undefined) } as any,  // checkSession
    { execute: jest.fn() } as any,                              // enrollStudent
    { execute: jest.fn().mockResolvedValue(undefined) } as any, // removeStudent
    repos.dataSource as any,                                    // DataSource (for transactions)
  );
  return { ctrl, repos };
};

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const tomorrow = daysFromToday(1);
const yesterday = daysAgo(1);
const nextWeekDay = daysFromToday(7);

/** A minimal Active class entity */
const makeActiveClass = (overrides: any = {}) => ({
  id: 'class-1',
  status: 'Active',
  startDate: tomorrow,
  finishDate: daysFromToday(7),
  mainTeacherId: 'teacher-1',
  assistantId: null,
  skipHolidays: false,
  ...overrides,
});

/** A weekly schedule falling on `date` */
const scheduleForDate = (date: string) => ({
  weekday: weekdayOf(date),
  roomId: 'room-1',
  startTime: '08:00',
  endTime: '10:00',
});

// ══════════════════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe('ClassController — Session Generation Rules', () => {

  // ─── 1. Tiền điều kiện (guard rails) ──────────────────────────────────────

  describe('Guard conditions — không sinh buổi khi thiếu điều kiện', () => {
    it('không sinh buổi khi lớp có status ≠ Active (e.g. Inactive)', async () => {
      const { ctrl, repos } = makeController();
      repos.classRepo.findOneOrFail.mockResolvedValue(
        makeActiveClass({ status: 'Inactive' }),
      );

      await (ctrl as any).generateSessions('class-1');

      expect(repos.transactionManager.save).not.toHaveBeenCalled();
    });

    it('không sinh buổi khi lớp không có startDate', async () => {
      const { ctrl, repos } = makeController();
      repos.classRepo.findOneOrFail.mockResolvedValue(
        makeActiveClass({ startDate: null }),
      );

      await (ctrl as any).generateSessions('class-1');

      expect(repos.transactionManager.save).not.toHaveBeenCalled();
    });

    it('không sinh buổi khi lớp chưa có lịch học (schedules = [])', async () => {
      const { ctrl, repos } = makeController();
      repos.classRepo.findOneOrFail.mockResolvedValue(makeActiveClass());
      repos.scheduleRepo.find.mockResolvedValue([]); // no schedules

      await (ctrl as any).generateSessions('class-1');

      expect(repos.transactionManager.save).not.toHaveBeenCalled();
    });

    it('generateSessionsEndpoint() ném ConflictException khi lớp không Active', async () => {
      const { ctrl, repos } = makeController();
      repos.classRepo.findOneOrFail.mockResolvedValue(
        makeActiveClass({ status: 'Archived' }),
      );

      await expect(ctrl.generateSessionsEndpoint('class-1'))
        .rejects.toThrow(ConflictException);
    });

    it('generateSessionsEndpoint() ném ConflictException khi chưa cấu hình lịch', async () => {
      const { ctrl, repos } = makeController();
      repos.classRepo.findOneOrFail.mockResolvedValue(makeActiveClass());
      repos.scheduleRepo.find.mockResolvedValue([]);

      await expect(ctrl.generateSessionsEndpoint('class-1'))
        .rejects.toThrow(ConflictException);
    });

    it('generateSessionsEndpoint() ném ConflictException khi thiếu startDate', async () => {
      const { ctrl, repos } = makeController();
      repos.classRepo.findOneOrFail.mockResolvedValue(makeActiveClass({ startDate: null }));
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate(tomorrow)]);

      await expect(ctrl.generateSessionsEndpoint('class-1'))
        .rejects.toThrow(ConflictException);
    });
  });

  // ─── 2. Chỉ sinh buổi TƯƠNG LAI ──────────────────────────────────────────

  describe('Chỉ sinh buổi học từ hôm nay trở đi (tương lai)', () => {
    it('sinh buổi với startDate là ngày mai → tạo session mới', async () => {
      const { ctrl, repos } = makeController();
      repos.classRepo.findOneOrFail.mockResolvedValue(
        makeActiveClass({ startDate: tomorrow, finishDate: tomorrow }),
      );
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate(tomorrow)]);
      repos.classStudentRepo.find.mockResolvedValue([]);
      repos.sessionRepo.find.mockResolvedValue([]); // no existing sessions

      await (ctrl as any).generateSessions('class-1');

      expect(repos.transactionManager.save).toHaveBeenCalledWith(
        ClassSessionOrmEntity,
        expect.arrayContaining([
          expect.objectContaining({
            date: tomorrow,
            status: SessionStatus.SCHEDULED,
          }),
        ]),
      );
    });

    it('không sinh buổi với date = hôm qua (quá khứ)', async () => {
      const { ctrl, repos } = makeController();
      // startDate is yesterday, finishDate is also yesterday → falls in the past
      repos.classRepo.findOneOrFail.mockResolvedValue(
        makeActiveClass({ startDate: yesterday, finishDate: yesterday }),
      );
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate(yesterday)]);
      repos.classStudentRepo.find.mockResolvedValue([]);
      repos.sessionRepo.find.mockResolvedValue([]);

      await (ctrl as any).generateSessions('class-1');

      expect(repos.transactionManager.save).not.toHaveBeenCalled();
    });

    it('startDate trong quá khứ → coi như bắt đầu từ hôm nay', async () => {
      const { ctrl, repos } = makeController();
      // startDate = yesterday, finishDate = tomorrow: should generate from today's date onward
      repos.classRepo.findOneOrFail.mockResolvedValue(
        makeActiveClass({ startDate: yesterday, finishDate: tomorrow }),
      );
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate(tomorrow)]);
      repos.classStudentRepo.find.mockResolvedValue([]);
      repos.sessionRepo.find.mockResolvedValue([]);

      await (ctrl as any).generateSessions('class-1');

      // Should only create the session on tomorrow since yesterday is past
      const saveCalls = repos.transactionManager.save.mock.calls;
      const sessionSaveCall = saveCalls.find((call: any[]) => call[0] === ClassSessionOrmEntity);
      expect(sessionSaveCall).toBeDefined();

      const createdSessions = sessionSaveCall[1];
      const createdDates = createdSessions.map((s: any) => s.date).filter(Boolean);
      expect(createdDates.every((d: string) => d >= todayStr())).toBe(true);
    });
  });

  // ─── 3. Buổi mới phải có status = SCHEDULED ──────────────────────────────

  describe('Buổi mới sinh phải có status = Scheduled (Chưa bắt đầu)', () => {
    it('session mới được tạo với status = Scheduled', async () => {
      const { ctrl, repos } = makeController();
      repos.classRepo.findOneOrFail.mockResolvedValue(
        makeActiveClass({ startDate: tomorrow, finishDate: tomorrow }),
      );
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate(tomorrow)]);
      repos.classStudentRepo.find.mockResolvedValue([]);
      repos.sessionRepo.find.mockResolvedValue([]);

      await (ctrl as any).generateSessions('class-1');

      const saveCalls = repos.transactionManager.save.mock.calls;
      const sessionSaveCall = saveCalls.find((call: any[]) => call[0] === ClassSessionOrmEntity);
      expect(sessionSaveCall).toBeDefined();

      const createdSessions = sessionSaveCall[1];
      expect(createdSessions[0]).toMatchObject({ status: SessionStatus.SCHEDULED });
    });

    it('session mới được tạo với attendanceLocked = false', async () => {
      const { ctrl, repos } = makeController();
      repos.classRepo.findOneOrFail.mockResolvedValue(
        makeActiveClass({ startDate: tomorrow, finishDate: tomorrow }),
      );
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate(tomorrow)]);
      repos.classStudentRepo.find.mockResolvedValue([]);
      repos.sessionRepo.find.mockResolvedValue([]);

      await (ctrl as any).generateSessions('class-1');

      const saveCalls = repos.transactionManager.save.mock.calls;
      const sessionSaveCall = saveCalls.find((call: any[]) => call[0] === ClassSessionOrmEntity);
      expect(sessionSaveCall).toBeDefined();

      const createdSessions = sessionSaveCall[1];
      expect(createdSessions[0]).toMatchObject({ attendanceLocked: false });
    });
  });

  // ─── 4. Không tạo lại buổi đã tồn tại với trạng thái khác ───────────────

  describe('Không tạo/ghi đè buổi đã có status IN_PROGRESS hoặc COMPLETED', () => {
    const existingStatuses = [
      { label: 'In-Progress', status: SessionStatus.IN_PROGRESS },
      { label: 'Completed',   status: SessionStatus.COMPLETED   },
    ];

    for (const { label, status } of existingStatuses) {
      it(`bỏ qua buổi ngày mai đã tồn tại với status ${label}`, async () => {
        const { ctrl, repos } = makeController();
        repos.classRepo.findOneOrFail.mockResolvedValue(
          makeActiveClass({ startDate: tomorrow, finishDate: tomorrow }),
        );
        repos.scheduleRepo.find.mockResolvedValue([scheduleForDate(tomorrow)]);
        repos.classStudentRepo.find.mockResolvedValue([]);
        // Session already exists in preloaded list with non-Scheduled status
        repos.sessionRepo.find.mockResolvedValue([
          {
            id: 'existing-session',
            date: tomorrow,
            startTime: '08:00',
            status,
            attendanceLocked: false,
          },
        ]);

        await (ctrl as any).generateSessions('class-1');

        // Must NOT update or save anything since no new sessions are generated
        expect(repos.transactionManager.save).not.toHaveBeenCalled();
      });
    }

    it('bỏ qua buổi đã khoá (attendanceLocked = true) kể cả status Scheduled', async () => {
      const { ctrl, repos } = makeController();
      repos.classRepo.findOneOrFail.mockResolvedValue(
        makeActiveClass({ startDate: tomorrow, finishDate: tomorrow }),
      );
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate(tomorrow)]);
      repos.classStudentRepo.find.mockResolvedValue([]);
      repos.sessionRepo.find.mockResolvedValue([
        {
          id: 'locked-session',
          date: tomorrow,
          startTime: '08:00',
          status: SessionStatus.SCHEDULED,
          attendanceLocked: true, // locked!
        },
      ]);

      await (ctrl as any).generateSessions('class-1');

      // Should NOT save or update
      expect(repos.transactionManager.save).not.toHaveBeenCalled();
    });

    it('buổi Scheduled tương lai chưa khoá → chỉ cập nhật teacher, không tạo mới', async () => {
      const { ctrl, repos } = makeController();
      const existingSession = {
        id: 'existing-session',
        date: tomorrow,
        startTime: '08:00',
        status: SessionStatus.SCHEDULED,
        attendanceLocked: false,
        teacherId: 'old-teacher',
        assistantId: null,
      };
      repos.classRepo.findOneOrFail.mockResolvedValue(
        makeActiveClass({ startDate: tomorrow, finishDate: tomorrow, mainTeacherId: 'new-teacher' }),
      );
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate(tomorrow)]);
      repos.classStudentRepo.find.mockResolvedValue([]);
      repos.sessionRepo.find.mockResolvedValue([existingSession]);

      await (ctrl as any).generateSessions('class-1');

      // Must update the existing session inside the transaction manager
      expect(repos.transactionManager.save).toHaveBeenCalledWith(
        ClassSessionOrmEntity,
        expect.arrayContaining([
          expect.objectContaining({ id: 'existing-session', teacherId: 'new-teacher' }),
        ]),
      );
    });
  });

  // ─── 5. regenerateFutureSessions xóa đúng buổi ───────────────────────────

  describe('regenerateFutureSessions() — xóa đúng và chỉ xóa buổi SCHEDULED chưa khoá', () => {
    it('câu DELETE phải lọc: date >= today AND attendance_locked = false AND status = Scheduled', async () => {
      const { ctrl, repos } = makeController();
      const deleteQB = makeQueryBuilder();
      repos.sessionRepo.createQueryBuilder.mockReturnValue(deleteQB);
      repos.classRepo.findOneOrFail.mockResolvedValue(
        makeActiveClass({ startDate: tomorrow, finishDate: tomorrow }),
      );
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate(tomorrow)]);
      repos.classStudentRepo.find.mockResolvedValue([]);
      repos.sessionRepo.find.mockResolvedValue([]);

      await (ctrl as any).regenerateFutureSessions('class-1');

      // The delete query builder chain should have been called with correct filters
      expect(deleteQB.delete).toHaveBeenCalled();
      expect(deleteQB.andWhere).toHaveBeenCalledWith('attendance_locked = false');
      expect(deleteQB.andWhere).toHaveBeenCalledWith(
        'status = :status',
        { status: SessionStatus.SCHEDULED },
      );
      expect(deleteQB.andWhere).toHaveBeenCalledWith(
        'date >= :deleteFrom',
        expect.objectContaining({ deleteFrom: expect.any(String) }),
      );
    });

    it('khi fromStartDate = true, câu DELETE phải lọc theo startDate thay vì today', async () => {
      const { ctrl, repos } = makeController();
      const deleteQB = makeQueryBuilder();
      repos.sessionRepo.createQueryBuilder.mockReturnValue(deleteQB);
      const customStartDate = '2026-01-01';
      repos.classRepo.findOneOrFail.mockResolvedValue(
        makeActiveClass({ startDate: customStartDate, finishDate: tomorrow }),
      );
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate(tomorrow)]);
      repos.classStudentRepo.find.mockResolvedValue([]);
      repos.sessionRepo.find.mockResolvedValue([]);

      await (ctrl as any).regenerateFutureSessions('class-1', true);

      expect(deleteQB.delete).toHaveBeenCalled();
      expect(deleteQB.andWhere).toHaveBeenCalledWith('attendance_locked = false');
      expect(deleteQB.andWhere).toHaveBeenCalledWith(
        'status = :status',
        { status: SessionStatus.SCHEDULED },
      );
      expect(deleteQB.andWhere).toHaveBeenCalledWith(
        'date >= :deleteFrom',
        expect.objectContaining({ deleteFrom: customStartDate }),
      );
    });

    it('sau khi xóa, gọi lại generateSessions để tái sinh buổi tương lai', async () => {
      const { ctrl, repos } = makeController();
      repos.sessionRepo.createQueryBuilder.mockReturnValue(makeQueryBuilder());
      repos.classRepo.findOneOrFail.mockResolvedValue(
        makeActiveClass({ startDate: tomorrow, finishDate: tomorrow }),
      );
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate(tomorrow)]);
      repos.classStudentRepo.find.mockResolvedValue([]);
      repos.sessionRepo.find.mockResolvedValue([]);

      const generateSpy = jest.spyOn(ctrl as any, 'generateSessions');

      await (ctrl as any).regenerateFutureSessions('class-1');

      expect(generateSpy).toHaveBeenCalledWith('class-1', false);
    });
  });

  // ─── 6. Điểm danh được tạo cho học sinh Active ───────────────────────────

  describe('Điểm danh (attendance records) khi tạo buổi mới', () => {
    it('tạo bản ghi điểm danh cho tất cả học sinh Active trong lớp', async () => {
      const { ctrl, repos } = makeController();
      repos.classRepo.findOneOrFail.mockResolvedValue(
        makeActiveClass({ startDate: tomorrow, finishDate: tomorrow }),
      );
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate(tomorrow)]);
      repos.classStudentRepo.find.mockResolvedValue([
        { studentId: 'student-A' },
        { studentId: 'student-B' },
        { studentId: 'student-C' },
      ]);
      repos.sessionRepo.find.mockResolvedValue([]);

      await (ctrl as any).generateSessions('class-1');

      // Should save attendance records for the 3 students in transaction manager
      const saveCalls = repos.transactionManager.save.mock.calls;
      const attendanceSaveCall = saveCalls.find((call: any[]) => call[0] === StudentAttendanceOrmEntity);
      expect(attendanceSaveCall).toBeDefined();

      const savedAttendances = attendanceSaveCall[1];
      expect(savedAttendances).toHaveLength(3);
      expect(savedAttendances[0]).toMatchObject({ isPresent: false });
    });

    it('không tạo điểm danh nếu không có học sinh Active', async () => {
      const { ctrl, repos } = makeController();
      repos.classRepo.findOneOrFail.mockResolvedValue(
        makeActiveClass({ startDate: tomorrow, finishDate: tomorrow }),
      );
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate(tomorrow)]);
      repos.classStudentRepo.find.mockResolvedValue([]); // no students
      repos.sessionRepo.find.mockResolvedValue([]);

      await (ctrl as any).generateSessions('class-1');

      const saveCalls = repos.transactionManager.save.mock.calls;
      const attendanceSaveCall = saveCalls.find((call: any[]) => call[0] === StudentAttendanceOrmEntity);
      expect(attendanceSaveCall).toBeUndefined();
    });
  });

  // ─── 7. Ngày lễ (skipHolidays) ───────────────────────────────────────────

  describe('skipHolidays — bỏ qua ngày lễ', () => {
    it('bỏ qua ngày học trùng với ngày lễ khi skipHolidays = true', async () => {
      const { ctrl, repos } = makeController();
      repos.classRepo.findOneOrFail.mockResolvedValue(
        makeActiveClass({ startDate: tomorrow, finishDate: tomorrow, skipHolidays: true }),
      );
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate(tomorrow)]);
      repos.classStudentRepo.find.mockResolvedValue([]);
      repos.sessionRepo.find.mockResolvedValue([]);

      // Inject holiday service mock via controller constructor override
      const getHolidayDates = { execute: jest.fn().mockResolvedValue([tomorrow]) };
      const ctrlWithHoliday = new ClassController(
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
        getHolidayDates as any,
        { execute: jest.fn().mockResolvedValue(undefined) } as any,
        { execute: jest.fn().mockResolvedValue(undefined) } as any,
        { execute: jest.fn() } as any,
        { execute: jest.fn().mockResolvedValue(undefined) } as any,
        repos.dataSource as any, // Inject dataSource
      );

      await (ctrlWithHoliday as any).generateSessions('class-1');

      // Tomorrow is a holiday — session should NOT be created
      expect(repos.transactionManager.save).not.toHaveBeenCalled();
    });

    it('sinh buổi bình thường khi skipHolidays = false dù ngày trùng nghỉ lễ', async () => {
      const { ctrl, repos } = makeController();
      repos.classRepo.findOneOrFail.mockResolvedValue(
        makeActiveClass({ startDate: tomorrow, finishDate: tomorrow, skipHolidays: false }),
      );
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate(tomorrow)]);
      repos.classStudentRepo.find.mockResolvedValue([]);
      repos.sessionRepo.find.mockResolvedValue([]);

      await (ctrl as any).generateSessions('class-1');

      // skipHolidays is false so holidays are irrelevant → session IS created
      expect(repos.transactionManager.save).toHaveBeenCalled();
    });
  });
});
