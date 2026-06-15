import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { Role } from '../../domain/value-objects/role.enum';
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
    private readonly getSummaryUseCase: GetDashboardSummaryUseCase,
    private readonly getRevenueUseCase: GetDashboardRevenueUseCase,
    private readonly getActivitiesUseCase: GetDashboardActivitiesUseCase,
    private readonly getAdminOperationsUseCase: GetAdminOperationsUseCase,
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

    // Find all class sessions for this teacher
    const sessions = await this.sessionRepo.find({
      where: { teacherId: teacher.id },
      relations: { classEntity: true, room: true },
      order: { date: 'ASC', startTime: 'ASC' },
    });

    const formattedSessions = sessions.map(s => {
      // Determine past/future status for UI
      const sessionDateTime = new Date(`${s.date}T${s.startTime}`);
      const isPast = sessionDateTime < new Date();

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
        isPast: isPast
      };
    });

    return {
      message: 'Chào mừng Giáo viên đến với Dashboard',
      teacherInfo: {
        id: teacher.id,
        name: `${teacher.lastName} ${teacher.firstName}`.trim(),
        role: req.user.role,
        avatar: teacher.avatar,
      },
      sessions: formattedSessions,
      pendingGradingCount: 0 // Will be implemented in Phase 2
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
      .where('session.teacherId = :teacherId', { teacherId: teacher.id })
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
      };
    }

    // 2. Find classes this student is enrolled in (Active)
    const classStudents = await this.classStudentRepo.find({
      where: { studentId: student.id, status: 'Active' },
    });
    const classIds = classStudents.map((cs) => cs.classId);

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

      // 4. Map each session with student attendance status
      sessionsList = await Promise.all(
        sessions.map(async (session) => {
          const attendance = await this.attendanceRepo.findOne({
            where: { classSessionId: session.id, studentId: student.id },
          });

          // Determine color based on session and attendance status:
          // - Chưa diễn ra: color: Blue (xanh nước biển)
          // - Diễn ra rồi có tham gia: color: Green (xanh lá cây)
          // - Diễn ra rồi không tham gia: color: Red (đỏ)
          let attendanceColor = 'blue'; // blue (Scheduled)
          let attendanceText = 'Chưa diễn ra';

          if (session.status === 'Completed' || session.status === 'In-Progress') {
            if (attendance && attendance.isPresent) {
              attendanceColor = 'green';
              attendanceText = 'Có tham gia';
            } else {
              attendanceColor = 'red';
              attendanceText = 'Vắng mặt';
            }
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
          };
        }),
      );
    }

    return {
      message: 'Chào mừng Học sinh đến với Cổng thông tin học tập',
      studentInfo: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        role: req.user.role,
      },
      grades: [
        { subject: 'Toán học', score: 9.0, teacher: 'Cô Nguyễn Thị Mai', status: 'Đạt' },
        { subject: 'Ngữ văn', score: 8.5, teacher: 'Thầy Lê Hoàng Minh', status: 'Đạt' },
      ],
      upcomingExams: [
        { subject: 'Toán học', date: '2026-06-18', time: '08:00 AM', type: 'Thi giữa kỳ' }
      ],
      sessions: sessionsList,
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
