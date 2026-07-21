/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClassController } from '../../../../src/presentation/controllers/class.controller';
import { AcademicError } from '../../../../src/modules/academics/domain/errors/academic.error';

describe('ClassController enrollment and schedule edge cases', () => {
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
    const assignmentQueryBuilder = createQueryBuilder();
    const repos = {
      classRepo: {
        findOne: jest.fn(),
        findOneOrFail: jest.fn(),
        create: jest.fn((value) => value),
        save: jest.fn(async (value) => value),
        createQueryBuilder: jest.fn(() => createQueryBuilder()),
      },
      scheduleRepo: {
        find: jest.fn().mockResolvedValue([]),
        create: jest.fn((value) => value),
        save: jest.fn(async (value) => value),
        delete: jest.fn(),
      },
      sessionRepo: {
        findOne: jest.fn(),
        findOneOrFail: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        find: jest.fn().mockResolvedValue([]),
        create: jest.fn((value) => value),
        save: jest.fn(async (value) => ({ id: 'session-1', ...value })),
        createQueryBuilder: jest.fn(() => sessionQueryBuilder),
      },
      classStudentRepo: {
        findOne: jest.fn(),
        findOneOrFail: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn((value) => value),
        save: jest.fn(async (value) => ({ id: 'enrollment-1', ...value })),
      },
      attendanceRepo: {
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
        create: jest.fn((value) => value),
        save: jest.fn(async (value) => value),
        delete: jest.fn(),
      },
      courseRepo: { findOne: jest.fn() },
      studentRepo: {
        findOne: jest.fn(),
        save: jest.fn(async (value) => value),
      },
      teacherRepo: {
        findOne: jest.fn(),
      },
      assignmentRepo: {
        createQueryBuilder: jest.fn(() => assignmentQueryBuilder),
      },
      notificationRepo: {
        create: jest.fn((value) => value),
        save: jest.fn(),
      },
      dataSource: {
        transaction: jest.fn(async (cb: (manager: any) => Promise<any>) => {
          const manager = {
            save: jest.fn(async (_Entity: any, data: any) => {
              if (Array.isArray(data)) return data.map((d: any) => ({ id: 'session-1', ...d }));
              return { id: 'session-1', ...data };
            }),
            create: jest.fn((_Entity: any, data: any) => data),
          };
          return cb(manager);
        }),
      },
    };
    const academics = {
      checkRecurring: { execute: jest.fn().mockResolvedValue(undefined) },
      checkSession: { execute: jest.fn().mockResolvedValue(undefined) },
      enrollStudent: { execute: jest.fn() },
      removeStudent: { execute: jest.fn().mockResolvedValue(undefined) },
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
      repos.dataSource as any,
    );

    return {
      controller,
      repos,
      academics,
      sessionQueryBuilder,
    };
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-14T08:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    {
      name: 'an empty schedule',
      schedules: [],
    },
    {
      name: 'an invalid weekday',
      schedules: [{ weekday: 'Monday', startTime: '08:00', endTime: '09:00' }],
    },
    {
      name: 'an invalid time',
      schedules: [{ weekday: 'Mon', startTime: '25:00', endTime: '26:00' }],
    },
    {
      name: 'a non-positive time range',
      schedules: [{ weekday: 'Mon', startTime: '09:00', endTime: '09:00' }],
    },
    {
      name: 'overlapping slots',
      schedules: [
        { weekday: 'Mon', startTime: '08:00', endTime: '09:30' },
        { weekday: 'Mon', startTime: '09:00', endTime: '10:00' },
      ],
    },
  ])('rejects $name when updating schedules', async ({ schedules }) => {
    const { controller, repos } = createController();
    repos.classRepo.findOneOrFail.mockResolvedValue({
      id: 'class-1',
      status: 'Planning',
      courseId: null,
      startDate: null,
      finishDate: null,
    });

    await expect(
      controller.update('class-1', { schedules } as any),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repos.scheduleRepo.delete).not.toHaveBeenCalled();
  });

  it('regenerates sessions when a planning class becomes active', async () => {
    const { controller, repos } = createController();
    const classEntity = {
      id: 'class-1',
      status: 'Planning',
      courseId: null,
      startDate: '2026-06-15',
      finishDate: '2026-06-30',
    };
    repos.classRepo.findOneOrFail.mockResolvedValue(classEntity);
    jest.spyOn(controller, 'findOne').mockResolvedValue(classEntity as any);
    const regenerate = jest
      .spyOn(controller as any, 'regenerateFutureSessions')
      .mockResolvedValue(undefined);

    await controller.update('class-1', { status: 'Active' });

    expect(regenerate).toHaveBeenCalledWith('class-1');
  });

  it('rejects a class whose finish date is before its start date', async () => {
    const { controller } = createController();

    await expect(
      controller.create({
        courseId: 'course-1',
        courseLevelId: 'level-1',
        classCode: 'A1',
        className: 'Class A1',
        startDate: '2026-06-20',
        finishDate: '2026-06-19',
        schedules: [
          { weekday: 'Mon', startTime: '08:00', endTime: '09:00' },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('replaces schedules and regenerates an active class', async () => {
    const { controller, repos } = createController();
    const classEntity = {
      id: 'class-1',
      status: 'Active',
      courseId: null,
      startDate: '2026-06-15',
      finishDate: '2026-06-30',
    };
    repos.classRepo.findOneOrFail.mockResolvedValue(classEntity);
    jest.spyOn(controller, 'findOne').mockResolvedValue(classEntity as any);
    const regenerate = jest
      .spyOn(controller as any, 'regenerateFutureSessions')
      .mockResolvedValue(undefined);
    const schedules = [
      { weekday: 'Tue', startTime: '09:00', endTime: '10:30' },
    ];

    await controller.update('class-1', { schedules });

    expect(repos.scheduleRepo.delete).toHaveBeenCalledWith({
      classId: 'class-1',
    });
    expect(repos.scheduleRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        classId: 'class-1',
        weekday: 'Tue',
        startTime: '09:00',
        endTime: '10:30',
      }),
    );
    expect(regenerate).toHaveBeenCalledWith('class-1');
  });

  it('does not generate sessions for an inactive class', async () => {
    const { controller, repos } = createController();
    repos.classRepo.findOneOrFail.mockResolvedValue({
      id: 'class-1',
      status: 'Planning',
      startDate: '2026-06-15',
      finishDate: '2026-06-30',
    });
    repos.scheduleRepo.find.mockResolvedValue([
      { weekday: 'Mon', startTime: '08:00', endTime: '09:00' },
    ]);

    await (controller as any).generateSessions('class-1');

    expect(repos.sessionRepo.save).not.toHaveBeenCalled();
  });

  it('generates a scheduled session and attendance for every active student', async () => {
    const { controller, repos } = createController();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const weekdayKeys = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const tomorrowWeekday = weekdayKeys[tomorrow.getUTCDay()];

    repos.classRepo.findOneOrFail.mockResolvedValue({
      id: 'class-1',
      status: 'Active',
      startDate: tomorrowStr,
      finishDate: tomorrowStr,
      mainTeacherId: 'teacher-1',
      skipHolidays: false,
    });
    repos.scheduleRepo.find.mockResolvedValue([
      { weekday: tomorrowWeekday, roomId: 'room-1', startTime: '08:00', endTime: '09:00' },
    ]);
    repos.classStudentRepo.find.mockResolvedValue([
      { studentId: 'student-1', joinedDate: '2026-06-14' },
      { studentId: 'student-2', joinedDate: '2026-06-14' },
    ]);
    // No existing sessions (preload returns empty)
    repos.sessionRepo.find.mockResolvedValue([]);

    await (controller as any).generateSessions('class-1');

    // All DB writes now go through dataSource.transaction
    const txCallback = repos.dataSource.transaction.mock.calls[0]?.[0];
    expect(txCallback).toBeDefined();

    // Inspect the manager passed to the transaction
    const capturedManager = { saves: [] as any[] };
    const manager = {
      save: jest.fn(async (_Entity: any, data: any) => {
        capturedManager.saves.push(data);
        if (Array.isArray(data)) return data.map((d: any) => ({ id: 'session-1', ...d }));
        return { id: 'session-1', ...data };
      }),
      create: jest.fn((_Entity: any, data: any) => data),
    };
    await txCallback(manager);

    // First save = session bulk insert
    const sessionSave = capturedManager.saves.find((s) => Array.isArray(s) && s[0]?.date === tomorrowStr);
    expect(sessionSave).toBeDefined();
    expect(sessionSave[0]).toMatchObject({ classId: 'class-1', teacherId: 'teacher-1', status: 'Scheduled' });

    // Second save = attendance bulk insert (2 students)
    const attendanceSave = capturedManager.saves.find((s) => Array.isArray(s) && s.some((a: any) => a.isPresent === false));
    expect(attendanceSave).toHaveLength(2);
  });

  it('rejects enrollment when the class does not exist', async () => {
    const { controller, academics } = createController();
    academics.enrollStudent.execute.mockRejectedValue(
      new AcademicError('CLASS_NOT_FOUND', 'Class not found.'),
    );

    await expect(
      controller.addStudent('class-1', { studentId: 'student-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects enrollment when the student does not exist', async () => {
    const { controller, academics } = createController();
    academics.enrollStudent.execute.mockRejectedValue(
      new AcademicError('STUDENT_NOT_FOUND', 'Student not found.'),
    );

    await expect(
      controller.addStudent('class-1', { studentId: 'student-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns an active enrollment idempotently without duplicate side effects', async () => {
    const { controller, academics } = createController();
    const enrollment = {
      id: 'enrollment-1',
      classId: 'class-1',
      studentId: 'student-1',
      status: 'Active',
    };
    academics.enrollStudent.execute.mockResolvedValue(enrollment);
    jest
      .spyOn(controller as any, 'notifyStudentAboutOpenAssignments')
      .mockResolvedValue(undefined);

    const result = await controller.addStudent('class-1', {
      studentId: 'student-1',
    });

    expect(result).toBe(enrollment);
    expect(academics.enrollStudent.execute).toHaveBeenCalledTimes(1);
  });

  it('rejects a new enrollment when the class is full', async () => {
    const { controller, academics } = createController();
    academics.enrollStudent.execute.mockRejectedValue(
      new AcademicError('CLASS_FULL', 'Class is full.'),
    );

    await expect(
      controller.addStudent('class-1', { studentId: 'student-1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a new enrollment and prepares attendance and notifications', async () => {
    const { controller, academics } = createController();
    academics.enrollStudent.execute.mockResolvedValue({
      id: 'enrollment-1',
      classId: 'class-1',
      studentId: 'student-1',
      status: 'Active',
      joinedDate: '2026-06-14',
      reactivated: false,
    });
    const notifications = jest
      .spyOn(controller as any, 'notifyStudentAboutOpenAssignments')
      .mockResolvedValue(undefined);

    const result = await controller.addStudent('class-1', {
      studentId: 'student-1',
    });

    expect(result).toEqual(
      expect.objectContaining({
        classId: 'class-1',
        studentId: 'student-1',
        status: 'Active',
      }),
    );
    expect(notifications).toHaveBeenCalledWith('class-1', 'student-1');
  });

  it('reactivates a dropped enrollment and restores future attendance', async () => {
    const { controller, academics } = createController();
    academics.enrollStudent.execute.mockResolvedValue({
      id: 'enrollment-1',
      classId: 'class-1',
      studentId: 'student-1',
      status: 'Active',
      joinedDate: '2026-06-14',
      reactivated: true,
    });
    jest
      .spyOn(controller as any, 'notifyStudentAboutOpenAssignments')
      .mockResolvedValue(undefined);

    const result = await controller.addStudent('class-1', {
      studentId: 'student-1',
    });

    expect(result.status).toBe('Active');
    expect(result.reactivated).toBe(true);
  });

  it('delegates removal to the transactional use case', async () => {
    const { controller, academics } = createController();
    await controller.removeStudent('class-1', 'student-1');

    expect(academics.removeStudent.execute).toHaveBeenCalledWith(
      'class-1',
      'student-1',
    );
  });

  it('rejects changes to a locked session', async () => {
    const { controller, repos } = createController();
    repos.sessionRepo.findOneOrFail = jest.fn().mockResolvedValue({
      id: 'session-1',
      classId: 'class-1',
      date: '2026-06-15',
      startTime: '08:00',
      endTime: '09:00',
      attendanceLocked: true,
    });

    await expect(
      controller.updateSession('session-1', { roomId: 'room-2' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repos.sessionRepo.save).not.toHaveBeenCalled();
  });

  it('rejects an invalid time range for a session', async () => {
    const { controller, repos } = createController();
    repos.sessionRepo.findOneOrFail = jest.fn().mockResolvedValue({
      id: 'session-1',
      classId: 'class-1',
      date: '2026-06-15',
      startTime: '08:00',
      endTime: '09:00',
      attendanceLocked: false,
    });

    await expect(
      controller.updateSession('session-1', {
        startTime: '10:00',
        endTime: '09:00',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('applies changes to all future unlocked sessions', async () => {
    const { controller, repos, sessionQueryBuilder } = createController();
    const selectedSession = {
      id: 'session-1',
      classId: 'class-1',
      date: '2026-06-15',
      startTime: '08:00',
      endTime: '09:00',
      attendanceLocked: false,
    };
    const futureSessions = [
      { ...selectedSession },
      { ...selectedSession, id: 'session-2', date: '2026-06-22' },
    ];
    repos.sessionRepo.findOneOrFail = jest
      .fn()
      .mockResolvedValue(selectedSession);
    sessionQueryBuilder.getMany.mockResolvedValue(futureSessions);

    await controller.updateSession('session-1', {
      scope: 'all-future',
      startTime: '09:00',
      endTime: '10:30',
      roomId: 'room-2',
      teacherId: 'teacher-2',
      status: 'Rescheduled',
    });

    expect(repos.sessionRepo.save).toHaveBeenCalledTimes(2);
    expect(futureSessions[1]).toEqual(
      expect.objectContaining({
        startTime: '09:00',
        endTime: '10:30',
        roomId: 'room-2',
        teacherId: 'teacher-2',
        status: 'Rescheduled',
      }),
    );
  });

  it('rejects applying one absolute date to all future sessions', async () => {
    const { controller, repos } = createController();
    repos.sessionRepo.findOneOrFail = jest.fn().mockResolvedValue({
      id: 'session-1',
      classId: 'class-1',
      date: '2026-06-15',
      startTime: '08:00',
      endTime: '09:00',
      attendanceLocked: false,
    });

    await expect(
      controller.updateSession('session-1', {
        scope: 'all-future',
        date: '2026-06-20',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('ClassController.overrideAttendance', () => {
  const createController = () => {
    const repos = {
      classRepo: { findOne: jest.fn(), findOneOrFail: jest.fn(), create: jest.fn(v => v), save: jest.fn(async v => v), createQueryBuilder: jest.fn() },
      scheduleRepo: { find: jest.fn().mockResolvedValue([]), create: jest.fn(v => v), save: jest.fn(async v => v), delete: jest.fn() },
      sessionRepo: { findOne: jest.fn(), findOneOrFail: jest.fn(), count: jest.fn().mockResolvedValue(0), create: jest.fn(v => v), save: jest.fn(async v => ({ id: 'session-1', ...v })), createQueryBuilder: jest.fn(() => ({ where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), leftJoinAndSelect: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([]) })) },
      classStudentRepo: { findOne: jest.fn(), find: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(v => v), save: jest.fn(async v => v), findOneOrFail: jest.fn() },
      attendanceRepo: {
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
        create: jest.fn(v => v),
        save: jest.fn(async v => v),
        delete: jest.fn(),
      },
      courseRepo: { findOne: jest.fn() },
      studentRepo: { findOne: jest.fn(), save: jest.fn(async v => v) },
      teacherRepo: { findOne: jest.fn() },
      assignmentRepo: { createQueryBuilder: jest.fn(() => ({ where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), leftJoinAndSelect: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([]) })) },
      notificationRepo: { create: jest.fn(v => v), save: jest.fn() },
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
      { execute: jest.fn().mockResolvedValue(undefined) } as any,
      { execute: jest.fn().mockResolvedValue(undefined) } as any,
      { execute: jest.fn() } as any,
      { execute: jest.fn().mockResolvedValue(undefined) } as any,
    );

    return { controller, repos };
  };

  const attendancePayload = {
    attendance: [
      { studentId: 'student-1', isPresent: true },
      { studentId: 'student-2', isPresent: false, reason: 'Sick' },
    ],
  };

  it('rejects override when session is NOT locked (not completed yet)', async () => {
    const { controller, repos } = createController();
    repos.sessionRepo.findOneOrFail.mockResolvedValue({
      id: 'session-1',
      attendanceLocked: false, // Buổi chưa chốt
    });

    await expect(
      controller.overrideAttendance('session-1', attendancePayload),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects override when ANY attendance record has already been billed (billId is not null)', async () => {
    const { controller, repos } = createController();
    repos.sessionRepo.findOneOrFail.mockResolvedValue({
      id: 'session-1',
      attendanceLocked: true,
    });
    // One of the existing records has already been put into a billing invoice
    repos.attendanceRepo.find.mockResolvedValue([
      { id: 'att-1', studentId: 'student-1', billId: 'bill-123' }, // đã tính tiền
      { id: 'att-2', studentId: 'student-2', billId: null },
    ]);

    await expect(
      controller.overrideAttendance('session-1', attendancePayload),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('successfully saves updated attendance when session is locked and no records have been billed', async () => {
    const { controller, repos } = createController();
    repos.sessionRepo.findOneOrFail.mockResolvedValue({
      id: 'session-1',
      attendanceLocked: true,
    });
    // No billed records
    repos.attendanceRepo.find.mockResolvedValue([
      { id: 'att-1', studentId: 'student-1', billId: null, isPresent: false },
      { id: 'att-2', studentId: 'student-2', billId: null, isPresent: true },
    ]);
    repos.attendanceRepo.findOne
      .mockResolvedValueOnce({ id: 'att-1', studentId: 'student-1', billId: null, isPresent: false })
      .mockResolvedValueOnce({ id: 'att-2', studentId: 'student-2', billId: null, isPresent: true });

    const result = await controller.overrideAttendance('session-1', attendancePayload);

    expect(result).toEqual({ message: expect.stringContaining('thành công') });
    // Should save each changed record
    expect(repos.attendanceRepo.save).toHaveBeenCalledTimes(2);
    // Verify student-1's isPresent is now true (was false in old record, now overridden to true)
    expect(repos.attendanceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: 'student-1', isPresent: true }),
    );
    // Verify student-2's isPresent is now false (was true in old record, now overridden to false) with reason
    expect(repos.attendanceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: 'student-2', isPresent: false, reason: 'Sick' }),
    );
  });

  it('creates a new attendance record if one did not previously exist for a student', async () => {
    const { controller, repos } = createController();
    repos.sessionRepo.findOneOrFail.mockResolvedValue({
      id: 'session-1',
      attendanceLocked: true,
    });
    repos.attendanceRepo.find.mockResolvedValue([]); // No existing records for session
    repos.attendanceRepo.findOne.mockResolvedValue(null); // Record doesn't exist for student yet

    await controller.overrideAttendance('session-1', {
      attendance: [{ studentId: 'student-new', isPresent: true }],
    });

    expect(repos.attendanceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        classSessionId: 'session-1',
        studentId: 'student-new',
      }),
    );
    expect(repos.attendanceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: 'student-new', isPresent: true }),
    );
  });

  describe('Teaching Assistant (TA) authorization and conflict checks', () => {
    it('blocks updateSession if user is a teacher but not the main teacher of the class', async () => {
      const { controller, repos } = createController();
      const session = {
        id: 'session-1',
        classId: 'class-1',
        date: '2099-12-31',
        startTime: '08:00',
        endTime: '09:30',
        attendanceLocked: false,
      };
      repos.sessionRepo.findOneOrFail.mockResolvedValue(session);
      repos.teacherRepo.findOne.mockResolvedValue({ id: 'teacher-other' });
      repos.classRepo.findOne.mockResolvedValue({ id: 'class-1', mainTeacherId: 'teacher-main' });

      const req = { user: { role: 'TEACHER', sub: 'user-other' } };
      await expect(
        controller.updateSession('session-1', { startTime: '10:00', endTime: '11:30' }, req),
      ).rejects.toThrow('Chỉ admin hoặc giáo viên chính của lớp mới được phép thay đổi lịch học/phân công.');
    });

    it('allows updateSession if user is the main teacher of the class', async () => {
      const { controller, repos } = createController();
      const session = {
        id: 'session-1',
        classId: 'class-1',
        date: '2099-12-31',
        startTime: '08:00',
        endTime: '09:30',
        attendanceLocked: false,
      };
      repos.sessionRepo.findOneOrFail.mockResolvedValue(session);
      repos.teacherRepo.findOne.mockResolvedValue({ id: 'teacher-main' });
      repos.classRepo.findOne.mockResolvedValue({ id: 'class-1', mainTeacherId: 'teacher-main' });

      const req = { user: { role: 'TEACHER', sub: 'user-main' } };
      const response = await controller.updateSession('session-1', { startTime: '10:00', endTime: '11:30' }, req);
      expect(response).toEqual({ message: 'Cập nhật buổi học thành công' });
    });

    it('rejects updateSession if teacher and assistant are the same person', async () => {
      const { controller, repos } = createController();
      const session = {
        id: 'session-1',
        classId: 'class-1',
        date: '2099-12-31',
        startTime: '08:00',
        endTime: '09:30',
        attendanceLocked: false,
        teacherId: 'teacher-same',
      };
      repos.sessionRepo.findOneOrFail.mockResolvedValue(session);

      await expect(
        controller.updateSession('session-1', { assistantId: 'teacher-same' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows validateAttendancePermission for session assistant', async () => {
      const { controller, repos } = createController();
      const session = {
        id: 'session-1',
        classId: 'class-1',
        date: '2099-12-31',
        startTime: '08:00',
        endTime: '09:30',
        attendanceLocked: false,
        teacherId: 'teacher-main',
        assistantId: 'teacher-ta',
        classEntity: { id: 'class-1', mainTeacherId: 'teacher-main' },
      };
      repos.sessionRepo.findOneOrFail.mockResolvedValue(session);
      repos.teacherRepo.findOne.mockResolvedValue({ id: 'teacher-ta' });

      const req = { user: { role: 'TEACHER', sub: 'user-ta' } };
      repos.classStudentRepo.find.mockResolvedValue([]);
      repos.attendanceRepo.find.mockResolvedValue([]);
      const response = await controller.saveAttendance(req, 'session-1', { attendance: [] });
      expect(response).toEqual({ message: expect.stringContaining('thành công') });
    });

    it('blocks validateAttendancePermission for unrelated teachers', async () => {
      const { controller, repos } = createController();
      const session = {
        id: 'session-1',
        classId: 'class-1',
        date: '2099-12-31',
        startTime: '08:00',
        endTime: '09:30',
        attendanceLocked: false,
        teacherId: 'teacher-main',
        assistantId: 'teacher-ta',
        classEntity: { id: 'class-1', mainTeacherId: 'teacher-main' },
      };
      repos.sessionRepo.findOneOrFail.mockResolvedValue(session);
      repos.teacherRepo.findOne.mockResolvedValue({ id: 'teacher-unrelated' });

      const req = { user: { role: 'TEACHER', sub: 'user-unrelated' } };
      await expect(
        controller.saveAttendance(req, 'session-1', { attendance: [] }),
      ).rejects.toThrow('Bạn không phải giáo viên được phân công giảng dạy cho buổi học này.');
    });
  });

  describe('ClassController session evaluations', () => {
    it('allows updating evaluations with valid scores (e.g. 8.25) and comment', async () => {
      const { controller, repos } = createController();
      const session = {
        id: 'session-1',
        classId: 'class-1',
        date: '2099-12-31',
        startTime: '08:00',
        endTime: '09:30',
        attendanceLocked: true, // evaluations can be updated even when locked
        teacherId: 'teacher-main',
        classEntity: { id: 'class-1', mainTeacherId: 'teacher-main' },
      };
      repos.sessionRepo.findOneOrFail.mockResolvedValue(session);
      repos.teacherRepo.findOne.mockResolvedValue({ id: 'teacher-main' });
      repos.classStudentRepo.find.mockResolvedValue([
        { studentId: 'student-1' }
      ]);
      repos.attendanceRepo.findOne.mockResolvedValue({
        id: 'attendance-1',
        studentId: 'student-1',
        classSessionId: 'session-1',
      });

      const req = { user: { role: 'TEACHER', sub: 'user-main' } };
      const body = {
        evaluations: [
          { studentId: 'student-1', evaluationScore: '8.25', evaluationComment: 'Good!' }
        ]
      };

      const res = await controller.saveEvaluations(req, 'session-1', body as any);
      expect(res).toEqual({ message: 'Đã cập nhật đánh giá học sinh thành công' });
      expect(repos.attendanceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          evaluationScore: '8.25',
          evaluationComment: 'Good!',
        })
      );
    });

    it('throws BadRequestException for invalid non-numeric score', async () => {
      const { controller, repos } = createController();
      const session = {
        id: 'session-1',
        classId: 'class-1',
        date: '2099-12-31',
        startTime: '08:00',
        endTime: '09:30',
        attendanceLocked: false,
        teacherId: 'teacher-main',
        classEntity: { id: 'class-1', mainTeacherId: 'teacher-main' },
      };
      repos.sessionRepo.findOneOrFail.mockResolvedValue(session);
      repos.teacherRepo.findOne.mockResolvedValue({ id: 'teacher-main' });
      repos.classStudentRepo.find.mockResolvedValue([
        { studentId: 'student-1' }
      ]);

      const req = { user: { role: 'TEACHER', sub: 'user-main' } };
      const body = {
        evaluations: [
          { studentId: 'student-1', evaluationScore: 'invalid', evaluationComment: 'Invalid score' }
        ]
      };

      await expect(
        controller.saveEvaluations(req, 'session-1', body as any)
      ).rejects.toThrow('Điểm đánh giá phải là số từ 0 đến 10.');
    });

    it('throws BadRequestException for score greater than 10', async () => {
      const { controller, repos } = createController();
      const session = {
        id: 'session-1',
        classId: 'class-1',
        date: '2099-12-31',
        startTime: '08:00',
        endTime: '09:30',
        attendanceLocked: false,
        teacherId: 'teacher-main',
        classEntity: { id: 'class-1', mainTeacherId: 'teacher-main' },
      };
      repos.sessionRepo.findOneOrFail.mockResolvedValue(session);
      repos.teacherRepo.findOne.mockResolvedValue({ id: 'teacher-main' });
      repos.classStudentRepo.find.mockResolvedValue([
        { studentId: 'student-1' }
      ]);

      const req = { user: { role: 'TEACHER', sub: 'user-main' } };
      const body = {
        evaluations: [
          { studentId: 'student-1', evaluationScore: '10.5', evaluationComment: 'Invalid score' }
        ]
      };

      await expect(
        controller.saveEvaluations(req, 'session-1', body as any)
      ).rejects.toThrow('Điểm đánh giá phải là số từ 0 đến 10.');
    });

    it('throws BadRequestException for non-enrolled students', async () => {
      const { controller, repos } = createController();
      const session = {
        id: 'session-1',
        classId: 'class-1',
        date: '2099-12-31',
        startTime: '08:00',
        endTime: '09:30',
        attendanceLocked: false,
        teacherId: 'teacher-main',
        classEntity: { id: 'class-1', mainTeacherId: 'teacher-main' },
      };
      repos.sessionRepo.findOneOrFail.mockResolvedValue(session);
      repos.teacherRepo.findOne.mockResolvedValue({ id: 'teacher-main' });
      repos.classStudentRepo.find.mockResolvedValue([
        { studentId: 'student-1' }
      ]);

      const req = { user: { role: 'TEACHER', sub: 'user-main' } };
      const body = {
        evaluations: [
          { studentId: 'student-2', evaluationScore: 9.0, evaluationComment: 'Not enrolled' }
        ]
      };

      await expect(
        controller.saveEvaluations(req, 'session-1', body)
      ).rejects.toThrow('Học sinh với ID student-2 không thuộc lớp học này.');
    });
  });
});

