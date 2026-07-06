import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { Role } from '../../domain/value-objects/role.enum';
import { SessionStatus } from '../../domain/value-objects/session-status.enum';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { StudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import { TeacherOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher.orm-entity';
import { ClassStudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-student.orm-entity';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { StudentAttendanceOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { TeacherMonthlyWageOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher-monthly-wage.orm-entity';
import { StudentMonthlyBillOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-monthly-bill.orm-entity';
import { ClassOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class.orm-entity';
import { ClassScheduleOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-schedule.orm-entity';
import { GetDashboardSummaryUseCase } from '../../application/use-cases/dashboard/get-dashboard-summary.use-case';
import { GetDashboardRevenueUseCase } from '../../application/use-cases/dashboard/get-dashboard-revenue.use-case';
import { GetDashboardActivitiesUseCase } from '../../application/use-cases/dashboard/get-dashboard-activities.use-case';
import { GetAdminOperationsUseCase } from '../../modules/dashboard/application/use-cases/get-admin-operations.use-case';
import { GetAdminAnomaliesUseCase } from '../../modules/dashboard/application/use-cases/get-admin-anomalies.use-case';
import { GetAdminUnlockedSessionsUseCase } from '../../modules/dashboard/application/use-cases/get-admin-unlocked-sessions.use-case';
import { AssignmentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/assignment.orm-entity';
import { AssignmentSubmissionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/assignment-submission.orm-entity';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(
    private readonly userRepository: IUserRepository,
    @InjectRepository(StudentOrmEntity)
    private readonly studentRepo: Repository<StudentOrmEntity>,
    @InjectRepository(TeacherOrmEntity)
    private readonly teacherRepo: Repository<TeacherOrmEntity>,
    @InjectRepository(ClassStudentOrmEntity)
    private readonly classStudentRepo: Repository<ClassStudentOrmEntity>,
    @InjectRepository(ClassOrmEntity)
    private readonly classRepo: Repository<ClassOrmEntity>,
    @InjectRepository(ClassScheduleOrmEntity)
    private readonly classScheduleRepo: Repository<ClassScheduleOrmEntity>,
    @InjectRepository(ClassSessionOrmEntity)
    private readonly sessionRepo: Repository<ClassSessionOrmEntity>,
    @InjectRepository(StudentAttendanceOrmEntity)
    private readonly attendanceRepo: Repository<StudentAttendanceOrmEntity>,
    @InjectRepository(TeacherMonthlyWageOrmEntity)
    private readonly teacherWageRepo: Repository<TeacherMonthlyWageOrmEntity>,
    @InjectRepository(StudentMonthlyBillOrmEntity)
    private readonly studentBillRepo: Repository<StudentMonthlyBillOrmEntity>,
    @InjectRepository(AssignmentOrmEntity)
    private readonly assignmentRepo: Repository<AssignmentOrmEntity>,
    @InjectRepository(AssignmentSubmissionOrmEntity)
    private readonly submissionRepo: Repository<AssignmentSubmissionOrmEntity>,
    private readonly getSummaryUseCase: GetDashboardSummaryUseCase,
    private readonly getRevenueUseCase: GetDashboardRevenueUseCase,
    private readonly getActivitiesUseCase: GetDashboardActivitiesUseCase,
    private readonly getAdminOperationsUseCase: GetAdminOperationsUseCase,
    private readonly getAdminAnomaliesUseCase: GetAdminAnomaliesUseCase,
    private readonly getAdminUnlockedSessionsUseCase: GetAdminUnlockedSessionsUseCase,
  ) {}

  @Get('profile')
  async getProfile(@Request() req: any) {
    const user = await this.userRepository.findById(req.user.sub);
    if (user) {
      delete (user as any).passwordHash;
      delete (user as any).refreshTokenHash;
    }
    return {
      message: 'Lấy thông tin cá nhân thành công',
      user,
    };
  }

  @Get('admin/summary')
  @Roles(Role.ADMIN)
  async getAdminSummary() {
    return this.getSummaryUseCase.execute();
  }

  @Get('admin/revenue')
  @Roles(Role.ADMIN)
  async getAdminRevenue() {
    return this.getRevenueUseCase.execute();
  }

  @Get('admin/activities')
  @Roles(Role.ADMIN)
  async getAdminActivities() {
    return this.getActivitiesUseCase.execute();
  }

  @Get('admin/operations')
  @Roles(Role.ADMIN)
  getAdminOperations() {
    return this.getAdminOperationsUseCase.execute();
  }

  @Get('admin/anomalies')
  @Roles(Role.ADMIN)
  getAdminAnomalies() {
    return this.getAdminAnomaliesUseCase.execute();
  }

  @Get('admin/unlocked-sessions')
  @Roles(Role.ADMIN)
  getAdminUnlockedSessions() {
    return this.getAdminUnlockedSessionsUseCase.execute();
  }

  @Get('teacher')
  @Roles(Role.TEACHER)
  async getTeacherData(@Request() req: any) {
    const teacher = await this.teacherRepo.findOne({
      where: { userId: req.user.sub },
    });

    if (!teacher) {
      return {
        message: 'Chào mừng Giáo viên đến với Dashboard',
        teacherInfo: { id: req.user.sub, name: req.user.email, role: req.user.role },
        sessions: [],
        pendingGradingCount: 0,
      };
    }

    // Find all class sessions for this teacher (either as main teacher or assistant)
    const sessions = await this.sessionRepo.find({
      where: [
        { teacherId: teacher.id },
        { assistantId: teacher.id },
      ],
      relations: { classEntity: true, room: true },
      order: { date: 'ASC', startTime: 'ASC' },
    });

    const formattedSessions = sessions.map(s => {
      // Determine past/future status for UI
      const sessionDateTime = new Date(`${s.date}T${s.startTime}`);
      const isPast = sessionDateTime < new Date();

      let attendanceColor = 'blue';
      if (s.status === SessionStatus.COMPLETED || s.attendanceLocked) {
        attendanceColor = 'green';
      } else if (isPast) {
        attendanceColor = 'red';
      }

      return {
        id: s.id,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        classCode: s.classEntity?.classCode || '',
        className: s.classEntity?.className || '',
        roomName: s.room?.name || 'Chưa xếp phòng',
        status: s.status,
        attendanceLocked: s.attendanceLocked,
        isPast: isPast,
        attendanceColor: attendanceColor
      };
    });

    const pendingGradingCountRes = await this.submissionRepo.query(
      `SELECT COUNT(sub.id)::int AS count
       FROM assignment_submissions sub
       JOIN assignments a ON a.id = sub.assignment_id
       JOIN classes cl ON cl.id = a.class_id
       WHERE sub.status = 'submitted' AND (
         cl.main_teacher_id = $1 OR
         cl.id IN (
           SELECT class_id FROM class_sessions WHERE teacher_id = $1 OR assistant_id = $1
         )
       )`,
      [teacher.id],
    );
    const pendingGradingCount = Number(pendingGradingCountRes[0]?.count ?? 0);

    return {
      message: 'Chào mừng Giáo viên đến với Dashboard',
      teacherInfo: {
        id: teacher.id,
        name: `${teacher.lastName} ${teacher.firstName}`.trim(),
        role: req.user.role,
        avatar: teacher.avatar,
      },
      sessions: formattedSessions,
      pendingGradingCount
    };
  }

  @Get('teacher/salary-history')
  @Roles(Role.TEACHER)
  async getTeacherSalaryHistory(@Request() req: any) {
    const teacher = await this.teacherRepo.findOne({
      where: { userId: req.user.sub },
    });

    if (!teacher) {
      return {
        summary: { totalPaid: 0, totalPending: 0, paidPeriods: 0, totalPeriods: 0 },
        wages: [],
      };
    }

    const wages = await this.teacherWageRepo.find({
      where: { teacherId: teacher.id },
      relations: { items: true, period: true },
      order: { month: 'DESC' },
    });

    const formattedWages = wages.map((wage) => ({
      id: wage.id,
      month: wage.month,
      totalAmount: Number(wage.totalAmount || 0),
      paidAmount: Number(wage.paidAmount || 0),
      remainingAmount: Math.max(
        Number(wage.totalAmount || 0) - Number(wage.paidAmount || 0),
        0,
      ),
      status: wage.status,
      paymentDate: wage.paymentDate,
      billingStartDate: wage.billingStartDate,
      billingEndDate: wage.billingEndDate,
      note: wage.note,
      period: wage.period
        ? {
            id: wage.period.id,
            name: wage.period.name,
            startDate: wage.period.startDate,
            endDate: wage.period.endDate,
          }
        : null,
      items: (wage.items || []).map((item) => ({
        id: item.id,
        classId: item.classId,
        className: item.className,
        courseName: item.courseName,
        levelName: item.levelName,
        sessionsCount: item.sessionsCount,
        rate: Number(item.rate || 0),
        totalAmount: Number(item.totalAmount || 0),
      })),
    }));

    return {
      summary: {
        totalPaid: formattedWages.reduce((sum, wage) => sum + wage.paidAmount, 0),
        totalPending: formattedWages.reduce((sum, wage) => sum + wage.remainingAmount, 0),
        paidPeriods: formattedWages.filter((wage) => wage.status === 'Paid').length,
        totalPeriods: formattedWages.length,
      },
      wages: formattedWages,
    };
  }

  @Get('teacher/classes')
  @Roles(Role.TEACHER)
  async getTeacherClasses(@Request() req: any) {
    const teacher = await this.teacherRepo.findOne({
      where: { userId: req.user.sub },
    });

    if (!teacher) {
      return {
        summary: { totalClasses: 0, activeClasses: 0, totalStudents: 0 },
        classes: [],
      };
    }

    const sessionClasses = await this.sessionRepo
      .createQueryBuilder('session')
      .select('DISTINCT session.classId', 'classId')
      .where('session.teacherId = :teacherId OR session.assistantId = :teacherId', { teacherId: teacher.id })
      .getRawMany<{ classId: string }>();

    const classIds = new Set(sessionClasses.map((row) => row.classId));
    const mainTeacherClasses = await this.classRepo.find({
      where: { mainTeacherId: teacher.id },
      select: { id: true },
    });
    mainTeacherClasses.forEach((classEntity) => classIds.add(classEntity.id));

    if (classIds.size === 0) {
      return {
        summary: { totalClasses: 0, activeClasses: 0, totalStudents: 0 },
        classes: [],
      };
    }

    const ids = Array.from(classIds);
    const [classes, schedules, enrollments] = await Promise.all([
      this.classRepo.find({
        where: { id: In(ids) },
        relations: { course: true, courseLevel: true, center: true },
        order: { createdAt: 'DESC' },
      }),
      this.classScheduleRepo.find({
        where: { classId: In(ids) },
        relations: { room: true },
        order: { weekday: 'ASC', startTime: 'ASC' },
      }),
      this.classStudentRepo.find({
        where: { classId: In(ids) },
        relations: { student: true },
        order: { joinedDate: 'ASC' },
      }),
    ]);

    const formattedClasses = classes.map((classEntity) => {
      const classEnrollments = enrollments.filter(
        (enrollment) => enrollment.classId === classEntity.id,
      );
      const activeStudents = classEnrollments.filter(
        (enrollment) => enrollment.status === 'Active',
      );

      return {
        id: classEntity.id,
        classCode: classEntity.classCode,
        className: classEntity.className,
        status: classEntity.status,
        startDate: classEntity.startDate,
        finishDate: classEntity.finishDate,
        maxSize: classEntity.maxSize,
        courseName: classEntity.course?.name || '',
        levelName: classEntity.courseLevel?.levelName || '',
        centerName: classEntity.center?.name || '',
        isMainTeacher: classEntity.mainTeacherId === teacher.id,
        studentCount: activeStudents.length,
        schedules: schedules
          .filter((schedule) => schedule.classId === classEntity.id)
          .map((schedule) => ({
            id: schedule.id,
            weekday: schedule.weekday,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            roomName: schedule.room?.name || 'Chưa xếp phòng',
          })),
        students: classEnrollments.map((enrollment) => ({
          enrollmentId: enrollment.id,
          enrollmentStatus: enrollment.status,
          joinedDate: enrollment.joinedDate,
          id: enrollment.student.id,
          studentId: enrollment.student.studentId,
          firstName: enrollment.student.firstName,
          lastName: enrollment.student.lastName,
          nickName: enrollment.student.nickName,
          gender: enrollment.student.gender,
          birthdate: enrollment.student.birthdate,
          mobile: enrollment.student.mobile,
          email: enrollment.student.email,
          avatar: enrollment.student.avatar,
          status: enrollment.student.status,
        })),
      };
    });

    const uniqueActiveStudentIds = new Set(
      enrollments
        .filter((enrollment) => enrollment.status === 'Active')
        .map((enrollment) => enrollment.studentId),
    );

    return {
      summary: {
        totalClasses: formattedClasses.length,
        activeClasses: formattedClasses.filter((item) => item.status === 'Active').length,
        totalStudents: uniqueActiveStudentIds.size,
      },
      classes: formattedClasses,
    };
  }

  @Get('student')
  @Roles(Role.STUDENT)
  async getStudentData(@Request() req: any) {
    // 1. Find the student profile using the user's ID
    const student = await this.studentRepo.findOne({
      where: { userId: req.user.sub },
      relations: { user: true },
    });

    if (!student) {
      return {
        message: 'Chào mừng Học sinh đến với Cổng thông tin học tập',
        studentInfo: { id: req.user.sub, name: req.user.email, role: req.user.role },
        grades: [],
        upcomingExams: [],
        sessions: [],
        stats: {
          attendance: { totalSessionsCompleted: 0, presentCount: 0, absentCount: 0, presentRate: 0, monthly: [] },
          homework: { totalAssignments: 0, submittedCount: 0, gradedCount: 0, pendingCount: 0, missingCount: 0, averageScore: 0 },
          recentComments: [],
        },
      };
    }

    // 2. Find classes this student is enrolled in (Active)
    const classStudents = await this.classStudentRepo.find({
      where: { studentId: student.id, status: 'Active' },
    });
    const classIds = classStudents.map((cs) => cs.classId);

    // Map classId to joinedDate for filtering sessions
    const classStudentMap = new Map<string, string>();
    for (const cs of classStudents) {
      classStudentMap.set(cs.classId, cs.joinedDate);
    }

    let sessionsList: any[] = [];

    if (classIds.length > 0) {
      // 3. Find all sessions of those classes
      const sessions = await this.sessionRepo
        .createQueryBuilder('s')
        .leftJoinAndSelect('s.classEntity', 'c')
        .leftJoinAndSelect('s.room', 'r')
        .leftJoinAndSelect('s.teacher', 't')
        .where('s.class_id IN (:...classIds)', { classIds })
        .orderBy('s.date', 'ASC')
        .addOrderBy('s.start_time', 'ASC')
        .getMany();

      // Filter sessions that occur on or after the student's joinedDate for that class
      const eligibleSessions = sessions.filter((session) => {
        const joinedDate = classStudentMap.get(session.classId);
        return joinedDate ? session.date >= joinedDate : false;
      });

      // 4. Map each session with student attendance status
      sessionsList = await Promise.all(
        eligibleSessions.map(async (session) => {
          const attendance = await this.attendanceRepo.findOne({
            where: { classSessionId: session.id, studentId: student.id },
          });

          // Determine color based on session and attendance status:
          // - Chưa diễn ra: color: Blue (xanh nước biển)
          // - Diễn ra rồi có tham gia: color: Green (xanh lá cây)
          // - Diễn ra rồi không tham gia: color: Red (đỏ)
          // - Chưa điểm danh (đối với buổi đã hoặc đang diễn ra nhưng chưa có bản ghi điểm danh): color: Gray (xám)
          let attendanceColor = 'blue'; // blue (Scheduled)
          let attendanceText = 'Chưa diễn ra';
          const hasAttendanceRecord = !!attendance;

          if (hasAttendanceRecord) {
            if (attendance.isPresent) {
              attendanceColor = 'green';
              attendanceText = 'Có tham gia';
            } else {
              attendanceColor = 'red';
              attendanceText = 'Vắng mặt';
            }
          } else if (session.status === SessionStatus.COMPLETED || session.status === SessionStatus.IN_PROGRESS) {
            attendanceColor = 'gray';
            attendanceText = 'Chưa điểm danh';
          }

          return {
            id: session.id,
            className: session.classEntity?.className || 'Lớp học',
            classCode: session.classEntity?.classCode || '',
            date: session.date,
            startTime: session.startTime,
            endTime: session.endTime,
            roomName: session.room?.name || 'Chưa xếp phòng',
            teacherName: session.teacher ? `${session.teacher.firstName} ${session.teacher.lastName}` : 'Chưa gán',
            status: session.status,
            attendanceColor,
            attendanceText,
            isPresent: attendance ? attendance.isPresent : false,
            note: attendance ? attendance.note : null,
            reason: attendance ? attendance.reason : null,
            hasAttendanceRecord,
          };
        }),
      );
    }

    // 5. Calculate attendance statistics (only count sessions with actual attendance records)
    const completedSessions = sessionsList.filter((s) => s.status === SessionStatus.COMPLETED && s.hasAttendanceRecord);
    const totalSessionsCompleted = completedSessions.length;
    const presentCount = completedSessions.filter((s) => s.isPresent).length;
    const absentCount = totalSessionsCompleted - presentCount;
    const presentRate = totalSessionsCompleted > 0 ? Number(((presentCount / totalSessionsCompleted) * 100).toFixed(1)) : 0;

    // Monthly attendance breakdown (initialize with the current month to ensure it is always shown)
    const currentDate = new Date();
    const currentMonthYear = `${String(currentDate.getMonth() + 1).padStart(2, '0')}/${currentDate.getFullYear()}`;
    const monthlyAttendance: Record<string, { completed: number; present: number; absent: number }> = {
      [currentMonthYear]: { completed: 0, present: 0, absent: 0 }
    };
    for (const s of completedSessions) {
      const dateParts = s.date.split('-');
      if (dateParts.length >= 2) {
        const monthYear = `${dateParts[1]}/${dateParts[0]}`; // e.g. "07/2026"
        if (!monthlyAttendance[monthYear]) {
          monthlyAttendance[monthYear] = { completed: 0, present: 0, absent: 0 };
        }
        monthlyAttendance[monthYear].completed++;
        if (s.isPresent) {
          monthlyAttendance[monthYear].present++;
        } else {
          monthlyAttendance[monthYear].absent++;
        }
      }
    }
    const monthlyAttendanceList = Object.entries(monthlyAttendance)
      .map(([month, stats]) => ({
        month,
        ...stats,
        rate: stats.completed > 0 ? Number(((stats.present / stats.completed) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => {
        const [mA, yA] = a.month.split('/');
        const [mB, yB] = b.month.split('/');
        return `${yB}-${mB}`.localeCompare(`${yA}-${mA}`); // Sort newest month first
      });

    // 6. Calculate homework/assignment statistics
    let totalAssignments = 0;
    let submittedCount = 0;
    let gradedCount = 0;
    let pendingCount = 0;
    let missingCount = 0;
    let averageScore = 0;
    let submissions: any[] = [];
    let assignments: any[] = [];

    if (classIds.length > 0) {
      assignments = await this.assignmentRepo.find({
        where: { classId: In(classIds), status: 'published' },
      });
      totalAssignments = assignments.length;

      if (totalAssignments > 0) {
        submissions = await this.submissionRepo.find({
          where: {
            assignmentId: In(assignments.map((a) => a.id)),
            studentId: student.id,
          },
        });
        submittedCount = submissions.length;
        gradedCount = submissions.filter((sub) => sub.status === 'graded').length;
        pendingCount = submittedCount - gradedCount;
        missingCount = Math.max(0, totalAssignments - submittedCount);

        const gradedSubmissions = submissions.filter((sub) => sub.status === 'graded' && sub.score !== null);
        if (gradedSubmissions.length > 0) {
          const totalScore = gradedSubmissions.reduce((sum, sub) => sum + Number(sub.score), 0);
          averageScore = Number((totalScore / gradedSubmissions.length).toFixed(1));
        }
      }
    }

    // 7. Compile recent comments
    const recentComments: any[] = [];

    // From attendance notes & reasons
    for (const s of completedSessions) {
      if (s.note || (!s.isPresent && s.reason)) {
        recentComments.push({
          date: s.date,
          type: 'attendance',
          title: `Điểm danh lớp ${s.className}`,
          comment: s.note || `Vắng mặt (Lý do: ${s.reason || 'Không rõ'})`,
        });
      }
    }

    // From assignment graded feedback
    for (const sub of submissions) {
      if (sub.status === 'graded' && sub.feedback) {
        const assignment = assignments.find((a) => a.id === sub.assignmentId);
        recentComments.push({
          date: sub.gradedAt ? new Date(sub.gradedAt).toISOString().split('T')[0] : (sub.submittedAt ? new Date(sub.submittedAt).toISOString().split('T')[0] : ''),
          type: 'assignment',
          title: `Bài tập: ${assignment?.title || 'Bài tập'}`,
          comment: sub.feedback,
          score: sub.score !== null ? Number(sub.score) : null,
          maxScore: assignment ? Number(assignment.maxScore) : 10,
        });
      }
    }

    // Sort by date descending
    recentComments.sort((a, b) => b.date.localeCompare(a.date));
    const topComments = recentComments.slice(0, 10);

    return {
      message: 'Chào mừng Học sinh đến với Cổng thông tin học tập',
      studentInfo: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        role: req.user.role,
      },
      classesCount: classIds.length,
      grades: [],
      upcomingExams: [],
      sessions: sessionsList,
      stats: {
        attendance: {
          totalSessionsCompleted,
          presentCount,
          absentCount,
          presentRate,
          monthly: monthlyAttendanceList,
        },
        homework: {
          totalAssignments,
          submittedCount,
          gradedCount,
          pendingCount,
          missingCount,
          averageScore,
        },
        recentComments: topComments,
      },
    };
  }

  @Get('student/tuition-history')
  @Roles(Role.STUDENT)
  async getStudentTuitionHistory(@Request() req: any) {
    const student = await this.studentRepo.findOne({
      where: { userId: req.user.sub },
    });

    if (!student) {
      return [];
    }

    const bills = await this.studentBillRepo.find({
      where: { studentId: student.id },
      relations: { items: true, period: true },
      order: { month: 'DESC' },
    });

    return bills;
  }
}
