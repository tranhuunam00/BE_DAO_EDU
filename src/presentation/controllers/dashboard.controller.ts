import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { Role } from '../../domain/value-objects/role.enum';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { StudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import { ClassStudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-student.orm-entity';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { StudentAttendanceOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { GetDashboardSummaryUseCase } from '../../application/use-cases/dashboard/get-dashboard-summary.use-case';
import { GetDashboardRevenueUseCase } from '../../application/use-cases/dashboard/get-dashboard-revenue.use-case';
import { GetDashboardActivitiesUseCase } from '../../application/use-cases/dashboard/get-dashboard-activities.use-case';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(
    private readonly userRepository: IUserRepository,
    @InjectRepository(StudentOrmEntity)
    private readonly studentRepo: Repository<StudentOrmEntity>,
    @InjectRepository(ClassStudentOrmEntity)
    private readonly classStudentRepo: Repository<ClassStudentOrmEntity>,
    @InjectRepository(ClassSessionOrmEntity)
    private readonly sessionRepo: Repository<ClassSessionOrmEntity>,
    @InjectRepository(StudentAttendanceOrmEntity)
    private readonly attendanceRepo: Repository<StudentAttendanceOrmEntity>,
    private readonly getSummaryUseCase: GetDashboardSummaryUseCase,
    private readonly getRevenueUseCase: GetDashboardRevenueUseCase,
    private readonly getActivitiesUseCase: GetDashboardActivitiesUseCase,
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

  @Get('teacher')
  @Roles(Role.TEACHER)
  getTeacherData(@Request() req: any) {
    return {
      message: 'Chào mừng Giáo viên đến với Dashboard Học đường',
      teacherInfo: {
        id: req.user.sub,
        name: req.user.email,
        role: req.user.role,
      },
      schedules: [
        { id: 'sch-1', className: 'Lớp 10A1', time: '08:00 - 09:30 AM', subject: 'Toán Đại Số' },
        { id: 'sch-2', className: 'Lớp 10A2', time: '10:00 - 11:30 AM', subject: 'Toán Hình Học' },
      ],
      pendingGradingCount: 15
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
}
