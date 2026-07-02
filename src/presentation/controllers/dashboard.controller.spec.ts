import { DashboardController } from './dashboard.controller';

describe('DashboardController views', () => {
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
      assignmentRepo: { find: jest.fn().mockResolvedValue([]) },
      submissionRepo: { find: jest.fn().mockResolvedValue([]) },
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
      repositories.assignmentRepo as any,
      repositories.submissionRepo as any,
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

  describe('student dashboard view', () => {
    it('correctly calculates attendance, homework statistics, and comments', async () => {
      const studentRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'student-1',
          firstName: 'An',
          lastName: 'Nguyen',
          userId: 'user-student-1',
        }),
      };
      const classStudentRepo = {
        find: jest.fn().mockResolvedValue([{ classId: 'class-1', studentId: 'student-1', status: 'Active' }]),
      };
      
      const mockSessions = [
        {
          id: 'session-1',
          date: '2026-07-01',
          status: 'Completed',
          classEntity: { className: 'Toán' },
        },
        {
          id: 'session-2',
          date: '2026-07-02',
          status: 'Completed',
          classEntity: { className: 'Toán' },
        },
        {
          id: 'session-3',
          date: '2026-07-03',
          status: 'Scheduled',
          classEntity: { className: 'Toán' },
        }
      ];
      
      const sessionQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockSessions),
      };
      
      const sessionRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(sessionQueryBuilder),
      };

      const attendanceRepo = {
        findOne: jest.fn().mockImplementation((options) => {
          const classSessionId = options.where.classSessionId;
          if (classSessionId === 'session-1') {
            return Promise.resolve({ isPresent: true, note: 'Tốt' });
          }
          if (classSessionId === 'session-2') {
            return Promise.resolve({ isPresent: false, reason: 'Ốm' });
          }
          return Promise.resolve(null);
        }),
      };

      const assignmentRepo = {
        find: jest.fn().mockResolvedValue([
          { id: 'assign-1', title: 'Bài tập 1', maxScore: 10, status: 'published' },
          { id: 'assign-2', title: 'Bài tập 2', maxScore: 10, status: 'published' }
        ]),
      };

      const submissionRepo = {
        find: jest.fn().mockResolvedValue([
          { id: 'sub-1', assignmentId: 'assign-1', status: 'graded', score: 9, feedback: 'Giỏi', gradedAt: new Date('2026-07-01T10:00:00Z') }
        ]),
      };

      const { controller } = createController({
        studentRepo,
        classStudentRepo,
        sessionRepo,
        attendanceRepo,
        assignmentRepo,
        submissionRepo,
      });

      const result = await controller.getStudentData({ user: { sub: 'user-student-1' } });

      expect(result.studentInfo.name).toBe('An Nguyen');
      
      // Attendance Stats
      expect(result.stats.attendance.totalSessionsCompleted).toBe(2);
      expect(result.stats.attendance.presentCount).toBe(1);
      expect(result.stats.attendance.absentCount).toBe(1);
      expect(result.stats.attendance.presentRate).toBe(50.0);
      expect(result.stats.attendance.monthly).toHaveLength(1);
      expect(result.stats.attendance.monthly[0]).toEqual({
        month: '07/2026',
        completed: 2,
        present: 1,
        absent: 1,
        rate: 50.0
      });

      // Homework Stats
      expect(result.stats.homework.totalAssignments).toBe(2);
      expect(result.stats.homework.submittedCount).toBe(1);
      expect(result.stats.homework.gradedCount).toBe(1);
      expect(result.stats.homework.missingCount).toBe(1);
      expect(result.stats.homework.averageScore).toBe(9.0);

      // Comments
      expect(result.stats.recentComments).toHaveLength(3); // 1 attendance note, 1 attendance absence reason, 1 assignment feedback
      expect(result.stats.recentComments.some(c => c.comment === 'Tốt')).toBe(true);
      expect(result.stats.recentComments.some(c => c.comment === 'Giỏi')).toBe(true);
      expect(result.stats.recentComments.some(c => c.comment.includes('Ốm'))).toBe(true);
    });
  });
});
