import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { Role } from '../../domain/value-objects/role.enum';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(
    private readonly userRepository: IUserRepository,
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

  @Get('admin')
  @Roles(Role.ADMIN)
  getAdminData() {
    return {
      message: 'Chào mừng bạn đến với Dashboard của Admin',
      statistics: {
        totalUsers: 45,
        totalTeachers: 8,
        totalStudents: 35,
        classCount: 5,
        systemStatus: 'Hoạt động bình thường',
      },
      auditLogs: [
        { id: 1, action: 'Thêm học sinh mới', target: 'Học sinh Nguyễn Bình Minh', time: new Date() },
        { id: 2, action: 'Cập nhật phân công giảng dạy', target: 'GV Nguyễn Thị Mai', time: new Date() },
      ]
    };
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
  getStudentData(@Request() req: any) {
    return {
      message: 'Chào mừng Học sinh đến với Cổng thông tin học tập',
      studentInfo: {
        id: req.user.sub,
        name: req.user.email,
        role: req.user.role,
      },
      grades: [
        { subject: 'Toán học', score: 9.0, teacher: 'Cô Nguyễn Thị Mai', status: 'Đạt' },
        { subject: 'Ngữ văn', score: 8.5, teacher: 'Thầy Lê Hoàng Minh', status: 'Đạt' },
      ],
      upcomingExams: [
        { subject: 'Toán học', date: '2026-06-18', time: '08:00 AM', type: 'Thi giữa kỳ' }
      ]
    };
  }
}
