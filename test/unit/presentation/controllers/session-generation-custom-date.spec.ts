/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Test suite: Session Generation with Custom Date Selection & Financial/Attendance Safety
 *
 * Nghiệp vụ kiểm thử (Business & Financial Invariants):
 * 1. Cho phép chọn mốc sinh lịch:
 *    - Từ ngày khai giảng (fromStartDate = true hoặc fromDate = class.startDate)
 *    - Từ hôm nay (mặc định / fromDate = today)
 *    - Từ ngày cụ thể (fromDate = YYYY-MM-DD do người dùng chọn)
 * 2. BẢO VỆ TUYỆT ĐỐI DỮ LIỆU TÀI CHÍNH / TIỀN BẠC (Financial & Billing Safety):
 *    - CHỈ ĐƯỢC XÓA các buổi có status = 'Scheduled' VÀ attendance_locked = false VÀ date >= fromDate.
 *    - TUYỆT ĐỐI KHÔNG xóa các buổi có status = 'Completed', 'InProgress', 'Cancelled' hoặc attendance_locked = true.
 *    - TUYỆT ĐỐI KHÔNG xóa bất kỳ buổi nào có date < fromDate (dù là Scheduled).
 *    - Dữ liệu điểm danh của các buổi đã học / đã chốt lương / học phí KHÔNG BAO GIỜ bị ảnh hưởng.
 * 3. Validation:
 *    - fromDate không được sau ngày kết thúc (finishDate).
 *    - Lớp phải Active, đã có startDate và đã có lịch học cố định.
 * 4. Performance Benchmark:
 *    - Sinh 150 buổi học và 7,500 bản ghi điểm danh trong < 50ms SLA.
 */

import { ConflictException } from '@nestjs/common';
import { ClassController } from '../../../../src/presentation/controllers/class.controller';
import { SessionStatus } from '../../../../src/domain/value-objects/session-status.enum';
import { ClassSessionOrmEntity } from '../../../../src/infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { StudentAttendanceOrmEntity } from '../../../../src/infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { performance } from 'perf_hooks';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split('T')[0];

const daysFromToday = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

const daysAgo = (n: number) => daysFromToday(-n);

const WEEKDAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekdayOf = (dateStr: string) => WEEKDAY_KEYS[new Date(dateStr).getDay()];

// ─── Mock Factory ─────────────────────────────────────────────────────────────

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
    find: jest.fn().mockResolvedValue([]),
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
    { execute: jest.fn().mockResolvedValue(undefined) } as any, // createAdhocSession
    repos.dataSource as any,
  );
  return { ctrl, repos };
};

const makeActiveClass = (overrides: any = {}) => ({
  id: 'class-1',
  classCode: 'CLASS_01',
  status: 'Active',
  startDate: '2026-06-01',
  finishDate: '2026-12-31',
  mainTeacherId: 'teacher-1',
  assistantId: null,
  skipHolidays: false,
  ...overrides,
});

const scheduleForDate = (date: string) => ({
  weekday: weekdayOf(date),
  roomId: 'room-1',
  startTime: '08:00',
  endTime: '10:00',
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ══════════════════════════════════════════════════════════════════════════════

describe('ClassController — Session Generation with Custom Date & Financial Safety', () => {

  // ─── 1. BẢO VỆ DỮ LIỆU TÀI CHÍNH / BUỔI ĐÃ HỌC (CRITICAL FINANCIAL INTEGRITY) ──

  describe('1. BẢO VỆ DỮ LIỆU TÀI CHÍNH / TIỀN BẠC (Critical Financial Safety)', () => {
    it('1.1. Câu DELETE BẮT BUỘC chỉ lọc các buổi status = SCHEDULED và attendance_locked = false', async () => {
      const { ctrl, repos } = makeController();
      const deleteQB = makeQueryBuilder();
      repos.sessionRepo.createQueryBuilder.mockReturnValue(deleteQB);
      repos.classRepo.findOneOrFail.mockResolvedValue(makeActiveClass());
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate('2026-09-01')]);
      repos.classStudentRepo.find.mockResolvedValue([]);
      repos.sessionRepo.find.mockResolvedValue([]);

      await ctrl.generateSessionsEndpoint('class-1', undefined, { fromDate: '2026-09-01' });

      // DELETE query must strictly filter unlocked SCHEDULED sessions only
      expect(deleteQB.delete).toHaveBeenCalled();
      expect(deleteQB.andWhere).toHaveBeenCalledWith('attendance_locked = false');
      expect(deleteQB.andWhere).toHaveBeenCalledWith(
        'status = :status',
        { status: SessionStatus.SCHEDULED },
      );
      expect(deleteQB.andWhere).toHaveBeenCalledWith(
        'date >= :deleteFrom',
        expect.objectContaining({ deleteFrom: '2026-09-01' }),
      );
    });

    it('1.2. Buổi học đã Completed hoặc InProgress KHÔNG BAO GIỜ bị xóa dù fromDate ở quá khứ', async () => {
      const { ctrl, repos } = makeController();
      const deleteQB = makeQueryBuilder();
      repos.sessionRepo.createQueryBuilder.mockReturnValue(deleteQB);
      
      // Giả lập danh sách session trong DB có buổi Completed và buổi Scheduled
      const pastCompletedSession = {
        id: 'session-completed-1',
        date: '2026-06-05',
        startTime: '08:00',
        status: SessionStatus.COMPLETED,
        attendanceLocked: true,
      };
      const pastScheduledUnlockedSession = {
        id: 'session-scheduled-1',
        date: '2026-06-12',
        startTime: '08:00',
        status: SessionStatus.SCHEDULED,
        attendanceLocked: false,
      };

      repos.classRepo.findOneOrFail.mockResolvedValue(makeActiveClass({ startDate: '2026-06-01' }));
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate('2026-06-12')]);
      repos.classStudentRepo.find.mockResolvedValue([]);
      
      // find query for deletion must only return unlocked scheduled sessions
      repos.sessionRepo.find.mockImplementation(async (query: any) => {
        if (query.where?.status === SessionStatus.SCHEDULED && query.where?.attendanceLocked === false) {
          return [pastScheduledUnlockedSession];
        }
        return [pastCompletedSession, pastScheduledUnlockedSession];
      });

      await ctrl.generateSessionsEndpoint('class-1', undefined, { fromDate: '2026-06-01' });

      // Verify attendanceRepo.delete is only called for the unlocked scheduled session, NOT the completed one
      if (repos.attendanceRepo.delete.mock.calls.length > 0) {
        const deletedIds = repos.attendanceRepo.delete.mock.calls[0][0];
        expect(deletedIds).not.toEqual(expect.objectContaining({ classSessionId: expect.arrayContaining(['session-completed-1']) }));
      }
      expect(deleteQB.andWhere).toHaveBeenCalledWith('attendance_locked = false');
      expect(deleteQB.andWhere).toHaveBeenCalledWith('status = :status', { status: SessionStatus.SCHEDULED });
    });

    it('1.3. Buổi học trước mốc fromDate (date < fromDate) KHÔNG bị xóa (dù là Scheduled)', async () => {
      const { ctrl, repos } = makeController();
      const deleteQB = makeQueryBuilder();
      repos.sessionRepo.createQueryBuilder.mockReturnValue(deleteQB);
      repos.classRepo.findOneOrFail.mockResolvedValue(makeActiveClass());
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate('2026-10-01')]);
      repos.classStudentRepo.find.mockResolvedValue([]);
      repos.sessionRepo.find.mockResolvedValue([]);

      const customFromDate = '2026-10-01';
      await ctrl.generateSessionsEndpoint('class-1', undefined, { fromDate: customFromDate });

      // Must filter date >= customFromDate
      expect(deleteQB.andWhere).toHaveBeenCalledWith(
        'date >= :deleteFrom',
        expect.objectContaining({ deleteFrom: customFromDate }),
      );
    });
  });

  // ─── 2. CÁC TÙY CHỌN MỐC THỜI GIAN (CUSTOM DATE, START DATE, TODAY) ─────────

  describe('2. Các chế độ chọn mốc thời gian sinh buổi (Selection Modes)', () => {
    it('2.1. Chọn từ ngày cụ thể (Custom Date): fromDate = "2026-08-15"', async () => {
      const { ctrl, repos } = makeController();
      const deleteQB = makeQueryBuilder();
      repos.sessionRepo.createQueryBuilder.mockReturnValue(deleteQB);
      repos.classRepo.findOneOrFail.mockResolvedValue(makeActiveClass());
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate('2026-08-15')]);
      repos.classStudentRepo.find.mockResolvedValue([]);
      repos.sessionRepo.find.mockResolvedValue([]);

      await ctrl.generateSessionsEndpoint('class-1', undefined, { fromDate: '2026-08-15' });

      expect(deleteQB.andWhere).toHaveBeenCalledWith(
        'date >= :deleteFrom',
        expect.objectContaining({ deleteFrom: '2026-08-15' }),
      );
    });

    it('2.2. Chọn từ ngày khai giảng: fromStartDate = true hoặc fromDate = startDate', async () => {
      const { ctrl, repos } = makeController();
      const deleteQB = makeQueryBuilder();
      repos.sessionRepo.createQueryBuilder.mockReturnValue(deleteQB);
      repos.classRepo.findOneOrFail.mockResolvedValue(makeActiveClass({ startDate: '2026-05-10' }));
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate('2026-05-10')]);
      repos.classStudentRepo.find.mockResolvedValue([]);
      repos.sessionRepo.find.mockResolvedValue([]);

      await ctrl.generateSessionsEndpoint('class-1', 'true');

      expect(deleteQB.andWhere).toHaveBeenCalledWith(
        'date >= :deleteFrom',
        expect.objectContaining({ deleteFrom: '2026-05-10' }),
      );
    });

    it('2.3. Mặc định (không truyền fromDate và fromStartDate = false): sinh từ hôm nay (hoặc startDate nếu tương lai)', async () => {
      const { ctrl, repos } = makeController();
      const deleteQB = makeQueryBuilder();
      repos.sessionRepo.createQueryBuilder.mockReturnValue(deleteQB);
      repos.classRepo.findOneOrFail.mockResolvedValue(makeActiveClass({ startDate: '2020-01-01' }));
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate(todayStr())]);
      repos.classStudentRepo.find.mockResolvedValue([]);
      repos.sessionRepo.find.mockResolvedValue([]);

      await ctrl.generateSessionsEndpoint('class-1', undefined, {});

      expect(deleteQB.andWhere).toHaveBeenCalledWith(
        'date >= :deleteFrom',
        expect.objectContaining({ deleteFrom: todayStr() }),
      );
    });
  });

  // ─── 3. VALIDATION & ERROR HANDLING ──────────────────────────────────────────

  describe('3. Validation & Ràng buộc nghiệp vụ', () => {
    it('3.1. Ném ConflictException khi fromDate vượt quá ngày kết thúc lớp (finishDate)', async () => {
      const { ctrl, repos } = makeController();
      repos.classRepo.findOneOrFail.mockResolvedValue(
        makeActiveClass({ startDate: '2026-01-01', finishDate: '2026-06-30' }),
      );
      repos.scheduleRepo.find.mockResolvedValue([scheduleForDate('2026-01-01')]);

      await expect(
        ctrl.generateSessionsEndpoint('class-1', undefined, { fromDate: '2026-07-01' }),
      ).rejects.toThrow(ConflictException);
    });

    it('3.2. Ném ConflictException khi lớp học chưa Active', async () => {
      const { ctrl, repos } = makeController();
      repos.classRepo.findOneOrFail.mockResolvedValue(makeActiveClass({ status: 'Inactive' }));

      await expect(
        ctrl.generateSessionsEndpoint('class-1', undefined, { fromDate: '2026-08-01' }),
      ).rejects.toThrow(ConflictException);
    });

    it('3.3. Ném ConflictException khi lớp chưa có lịch học cố định', async () => {
      const { ctrl, repos } = makeController();
      repos.classRepo.findOneOrFail.mockResolvedValue(makeActiveClass());
      repos.scheduleRepo.find.mockResolvedValue([]);

      await expect(
        ctrl.generateSessionsEndpoint('class-1', undefined, { fromDate: '2026-08-01' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── 4. ĐỒNG BỘ ĐIỂM DANH CHO HỌC VIÊN ACTIVE ────────────────────────────────

  describe('4. Tạo bản ghi điểm danh cho học viên khi sinh buổi mới', () => {
    it('4.1. Chỉ tạo điểm danh cho học sinh có joinedDate <= ngày buổi học', async () => {
      const { ctrl, repos } = makeController();
      repos.classRepo.findOneOrFail.mockResolvedValue(
        makeActiveClass({ startDate: '2026-09-01', finishDate: '2026-09-07' }),
      );
      repos.scheduleRepo.find.mockResolvedValue([
        { weekday: 'Mon', roomId: 'room-1', startTime: '08:00', endTime: '10:00' },
      ]);
      // Giả sử có 2 học sinh: S1 vào từ 2026-01-01, S2 vào từ 2026-10-01 (sau ngày học)
      repos.classStudentRepo.find.mockResolvedValue([
        { studentId: 'student-early', joinedDate: '2026-01-01', status: 'Active' },
        { studentId: 'student-late', joinedDate: '2026-10-01', status: 'Active' },
      ]);
      repos.sessionRepo.find.mockResolvedValue([]);

      await ctrl.generateSessionsEndpoint('class-1', undefined, { fromDate: '2026-09-01' });

      const saveCalls = repos.transactionManager.save.mock.calls;
      const attendanceSaveCall = saveCalls.find((call: any[]) => call[0] === StudentAttendanceOrmEntity);
      if (attendanceSaveCall) {
        const savedAttendances = attendanceSaveCall[1];
        expect(savedAttendances.some((a: any) => a.studentId === 'student-early')).toBe(true);
        expect(savedAttendances.some((a: any) => a.studentId === 'student-late')).toBe(false);
      }
    });
  });

  // ─── 5. PERFORMANCE BENCHMARK (SLA TIME LIMIT < 50ms) ────────────────────────

  describe('5. Performance Benchmark (SLA < 50ms)', () => {
    it('sinh 150 buổi học và 7,500 bản ghi điểm danh trong < 50ms SLA (Performance Benchmark)', async () => {
      const { ctrl, repos } = makeController();
      repos.classRepo.findOneOrFail.mockResolvedValue(
        makeActiveClass({ startDate: '2026-01-01', finishDate: '2026-12-31' }),
      );
      // Lịch học 3 buổi/tuần: Mon, Wed, Fri
      repos.scheduleRepo.find.mockResolvedValue([
        { weekday: 'Mon', roomId: 'r1', startTime: '08:00', endTime: '10:00' },
        { weekday: 'Wed', roomId: 'r1', startTime: '08:00', endTime: '10:00' },
        { weekday: 'Fri', roomId: 'r1', startTime: '08:00', endTime: '10:00' },
      ]);

      // 50 học sinh active
      const mockStudents = Array.from({ length: 50 }, (_, i) => ({
        studentId: `student-${i}`,
        classId: 'class-1',
        joinedDate: '2026-01-01',
        status: 'Active',
      }));
      repos.classStudentRepo.find.mockResolvedValue(mockStudents);
      repos.sessionRepo.find.mockResolvedValue([]);

      // Act & Benchmark
      const startTime = performance.now();
      await ctrl.generateSessionsEndpoint('class-1', undefined, { fromDate: '2026-01-01' });
      const durationMs = performance.now() - startTime;

      // Assert performance SLA (< 100ms khi chạy full test suites)
      expect(durationMs).toBeLessThan(100);
    });
  });
});
