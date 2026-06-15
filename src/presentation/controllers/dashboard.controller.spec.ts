import { DashboardController } from './dashboard.controller';

describe('DashboardController teacher views', () => {
  const createController = (overrides: Record<string, any> = {}) => {
    const sessionQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const repositories = {
      userRepo: { findById: jest.fn() },
      studentRepo: { findOne: jest.fn() },
      teacherRepo: { findOne: jest.fn() },
      classStudentRepo: { find: jest.fn().mockResolvedValue([]) },
      classRepo: { find: jest.fn().mockResolvedValue([]) },
      classScheduleRepo: { find: jest.fn().mockResolvedValue([]) },
      sessionRepo: {
        find: jest.fn(),
        createQueryBuilder: jest.fn().mockReturnValue(sessionQueryBuilder),
      },
      attendanceRepo: { findOne: jest.fn() },
      teacherWageRepo: { find: jest.fn().mockResolvedValue([]) },
      studentBillRepo: { find: jest.fn() },
      ...overrides,
    };

    const controller = new DashboardController(
      repositories.userRepo as any,
      repositories.studentRepo as any,
      repositories.teacherRepo as any,
      repositories.classStudentRepo as any,
      repositories.classRepo as any,
      repositories.classScheduleRepo as any,
      repositories.sessionRepo as any,
      repositories.attendanceRepo as any,
      repositories.teacherWageRepo as any,
      repositories.studentBillRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return { controller, repositories, sessionQueryBuilder };
  };

  it('returns a numeric salary summary and stable wage DTOs', async () => {
    const teacherRepo = { findOne: jest.fn().mockResolvedValue({ id: 'teacher-1' }) };
    const teacherWageRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'wage-1',
          month: '2026-06',
          totalAmount: '1500000.00',
          paidAmount: '1000000.00',
          status: 'Unpaid',
          paymentDate: null,
          billingStartDate: new Date('2026-06-01'),
          billingEndDate: new Date('2026-06-30'),
          note: 'Tạm ứng',
          period: { id: 'period-1', name: 'Lương tháng 6' },
          items: [
            {
              id: 'item-1',
              classId: 'class-1',
              className: 'A1',
              courseName: 'English',
              levelName: 'Starter',
              sessionsCount: 5,
              rate: '300000.00',
              totalAmount: '1500000.00',
            },
          ],
        },
      ]),
    };
    const { controller } = createController({ teacherRepo, teacherWageRepo });

    const result = await controller.getTeacherSalaryHistory({
      user: { sub: 'user-1' },
    });

    expect(result.summary).toEqual({
      totalPaid: 1000000,
      totalPending: 500000,
      paidPeriods: 0,
      totalPeriods: 1,
    });
    expect(result.wages[0]).toEqual(
      expect.objectContaining({
        totalAmount: 1500000,
        paidAmount: 1000000,
        remainingAmount: 500000,
      }),
    );
    expect(result.wages[0].items[0].rate).toBe(300000);
  });

  it('returns assigned classes and counts only active unique students', async () => {
    const teacherRepo = { findOne: jest.fn().mockResolvedValue({ id: 'teacher-1' }) };
    const classRepo = {
      find: jest
        .fn()
        .mockResolvedValueOnce([{ id: 'class-main' }])
        .mockResolvedValueOnce([
          {
            id: 'class-main',
            classCode: 'CLS-01',
            className: 'Class One',
            status: 'Active',
            mainTeacherId: 'teacher-1',
            course: { name: 'English' },
            courseLevel: { levelName: 'A1' },
            center: { name: 'Center A' },
          },
          {
            id: 'class-session',
            classCode: 'CLS-02',
            className: 'Class Two',
            status: 'Planning',
            mainTeacherId: null,
            course: { name: 'English' },
            courseLevel: { levelName: 'A2' },
            center: { name: 'Center A' },
          },
        ]),
    };
    const classStudentRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'enrollment-1',
          classId: 'class-main',
          studentId: 'student-1',
          status: 'Active',
          joinedDate: '2026-06-01',
          student: {
            id: 'student-1',
            studentId: 'STU-1',
            firstName: 'An',
            lastName: 'Nguyen',
          },
        },
        {
          id: 'enrollment-2',
          classId: 'class-session',
          studentId: 'student-1',
          status: 'Active',
          joinedDate: '2026-06-01',
          student: {
            id: 'student-1',
            studentId: 'STU-1',
            firstName: 'An',
            lastName: 'Nguyen',
          },
        },
        {
          id: 'enrollment-3',
          classId: 'class-session',
          studentId: 'student-2',
          status: 'Dropped',
          joinedDate: '2026-06-01',
          student: {
            id: 'student-2',
            studentId: 'STU-2',
            firstName: 'Binh',
            lastName: 'Tran',
          },
        },
      ]),
    };
    const { controller, sessionQueryBuilder } = createController({
      teacherRepo,
      classRepo,
      classStudentRepo,
    });
    sessionQueryBuilder.getRawMany.mockResolvedValue([{ classId: 'class-session' }]);

    const result = await controller.getTeacherClasses({ user: { sub: 'user-1' } });

    expect(result.summary).toEqual({
      totalClasses: 2,
      activeClasses: 1,
      totalStudents: 1,
    });
    expect(result.classes).toHaveLength(2);
    expect(result.classes[0].isMainTeacher).toBe(true);
    expect(result.classes[1].studentCount).toBe(1);
  });
});
