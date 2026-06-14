/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClassController } from './class.controller';

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
        create: jest.fn((value) => value),
        save: jest.fn(async (value) => value),
        delete: jest.fn(),
      },
      courseRepo: { findOne: jest.fn() },
      studentRepo: {
        findOne: jest.fn(),
        save: jest.fn(async (value) => value),
      },
      assignmentRepo: {
        createQueryBuilder: jest.fn(() => assignmentQueryBuilder),
      },
      notificationRepo: {
        create: jest.fn((value) => value),
        save: jest.fn(),
      },
    };

    const controller = new ClassController(
      repos.classRepo as any,
      repos.scheduleRepo as any,
      repos.sessionRepo as any,
      repos.classStudentRepo as any,
      repos.attendanceRepo as any,
      repos.courseRepo as any,
      repos.studentRepo as any,
      repos.assignmentRepo as any,
      repos.notificationRepo as any,
    );

    return {
      controller,
      repos,
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
    repos.classRepo.findOneOrFail.mockResolvedValue({
      id: 'class-1',
      status: 'Active',
      startDate: '2026-06-14',
      finishDate: '2026-06-14',
      mainTeacherId: 'teacher-1',
    });
    repos.scheduleRepo.find.mockResolvedValue([
      {
        weekday: 'Sun',
        roomId: 'room-1',
        startTime: '08:00',
        endTime: '09:00',
      },
    ]);
    repos.classStudentRepo.find.mockResolvedValue([
      { studentId: 'student-1' },
      { studentId: 'student-2' },
    ]);
    repos.sessionRepo.findOne.mockResolvedValue(null);

    await (controller as any).generateSessions('class-1');

    expect(repos.sessionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        classId: 'class-1',
        date: '2026-06-14',
        teacherId: 'teacher-1',
        status: 'Scheduled',
      }),
    );
    expect(repos.attendanceRepo.save).toHaveBeenCalledTimes(2);
  });

  it('rejects enrollment when the class does not exist', async () => {
    const { controller, repos } = createController();
    repos.classRepo.findOne.mockResolvedValue(null);
    repos.studentRepo.findOne.mockResolvedValue({ id: 'student-1' });

    await expect(
      controller.addStudent('class-1', { studentId: 'student-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects enrollment when the student does not exist', async () => {
    const { controller, repos } = createController();
    repos.classRepo.findOne.mockResolvedValue({ id: 'class-1', maxSize: 10 });
    repos.studentRepo.findOne.mockResolvedValue(null);

    await expect(
      controller.addStudent('class-1', { studentId: 'student-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns an active enrollment idempotently without duplicate side effects', async () => {
    const { controller, repos } = createController();
    const enrollment = {
      id: 'enrollment-1',
      classId: 'class-1',
      studentId: 'student-1',
      status: 'Active',
    };
    repos.classRepo.findOne.mockResolvedValue({ id: 'class-1', maxSize: 1 });
    repos.studentRepo.findOne.mockResolvedValue({ id: 'student-1' });
    repos.classStudentRepo.findOne.mockResolvedValue(enrollment);

    const result = await controller.addStudent('class-1', {
      studentId: 'student-1',
    });

    expect(result).toBe(enrollment);
    expect(repos.classStudentRepo.count).not.toHaveBeenCalled();
    expect(repos.classStudentRepo.save).not.toHaveBeenCalled();
  });

  it('rejects a new enrollment when the class is full', async () => {
    const { controller, repos } = createController();
    repos.classRepo.findOne.mockResolvedValue({ id: 'class-1', maxSize: 2 });
    repos.studentRepo.findOne.mockResolvedValue({ id: 'student-1' });
    repos.classStudentRepo.findOne.mockResolvedValue(null);
    repos.classStudentRepo.count.mockResolvedValue(2);

    await expect(
      controller.addStudent('class-1', { studentId: 'student-1' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repos.classStudentRepo.save).not.toHaveBeenCalled();
  });

  it('creates a new enrollment and prepares attendance and notifications', async () => {
    const { controller, repos } = createController();
    const student = { id: 'student-1', status: 'Waiting for class' };
    repos.classRepo.findOne.mockResolvedValue({ id: 'class-1', maxSize: 10 });
    repos.studentRepo.findOne.mockResolvedValue(student);
    repos.classStudentRepo.findOne.mockResolvedValue(null);
    const attendance = jest
      .spyOn(controller as any, 'generateAttendanceForStudent')
      .mockResolvedValue(undefined);
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
    expect(student.status).toBe('Studying');
    expect(attendance).toHaveBeenCalledWith('class-1', 'student-1');
    expect(notifications).toHaveBeenCalledWith('class-1', 'student-1');
  });

  it('reactivates a dropped enrollment and restores future attendance', async () => {
    const { controller, repos } = createController();
    const student = { id: 'student-1', status: 'Waiting for class' };
    const enrollment = {
      id: 'enrollment-1',
      classId: 'class-1',
      studentId: 'student-1',
      status: 'Dropped',
    };
    repos.classRepo.findOne.mockResolvedValue({ id: 'class-1', maxSize: 10 });
    repos.studentRepo.findOne.mockResolvedValue(student);
    repos.classStudentRepo.findOne.mockResolvedValue(enrollment);
    const attendance = jest
      .spyOn(controller as any, 'generateAttendanceForStudent')
      .mockResolvedValue(undefined);
    jest
      .spyOn(controller as any, 'notifyStudentAboutOpenAssignments')
      .mockResolvedValue(undefined);

    const result = await controller.addStudent('class-1', {
      studentId: 'student-1',
    });

    expect(result.status).toBe('Active');
    expect(student.status).toBe('Studying');
    expect(attendance).toHaveBeenCalledWith('class-1', 'student-1');
  });

  it('keeps the student studying when another active class remains', async () => {
    const { controller, repos, sessionQueryBuilder } = createController();
    const enrollment = { status: 'Active' };
    repos.classStudentRepo.findOneOrFail.mockResolvedValue(enrollment);
    repos.classStudentRepo.count.mockResolvedValue(1);
    sessionQueryBuilder.getMany.mockResolvedValue([]);

    await controller.removeStudent('class-1', 'student-1');

    expect(enrollment.status).toBe('Dropped');
    expect(repos.studentRepo.save).not.toHaveBeenCalled();
  });

  it('sets waiting status and removes attendance from today onward', async () => {
    const { controller, repos, sessionQueryBuilder } = createController();
    const enrollment = { status: 'Active' };
    const student = { id: 'student-1', status: 'Studying' };
    repos.classStudentRepo.findOneOrFail.mockResolvedValue(enrollment);
    repos.classStudentRepo.count.mockResolvedValue(0);
    repos.studentRepo.findOne.mockResolvedValue(student);
    sessionQueryBuilder.getMany.mockResolvedValue([
      { id: 'today-session' },
      { id: 'future-session' },
    ]);

    await controller.removeStudent('class-1', 'student-1');

    expect(student.status).toBe('Waiting for class');
    expect(sessionQueryBuilder.andWhere).toHaveBeenCalledWith(
      's.date >= :today',
      { today: '2026-06-14' },
    );
    expect(repos.attendanceRepo.delete).toHaveBeenCalledTimes(2);
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
