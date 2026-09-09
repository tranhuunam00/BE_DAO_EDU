import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Headers,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../../../infrastructure/security/roles.guard';
import { Roles } from '../../../../infrastructure/security/roles.decorator';
import { Role } from '../../../../domain/value-objects/role.enum';
import { GetWeeklyStudentReportUseCase } from '../../application/use-cases/get-weekly-student-report.use-case';
import { GetClassWeeklyReportsUseCase } from '../../application/use-cases/get-class-weekly-reports.use-case';
import { StudentOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student.orm-entity';

@Controller('weekly-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WeeklyStudentReportController {
  constructor(
    private readonly getWeeklyReportUseCase: GetWeeklyStudentReportUseCase,
    private readonly getClassWeeklyReportsUseCase: GetClassWeeklyReportsUseCase,
    @InjectRepository(StudentOrmEntity)
    private readonly studentRepo: Repository<StudentOrmEntity>,
  ) {}

  /**
   * 1. API DÀNH CHO PHỤ HUYNH / HỌC SINH (STUDENT)
   * Tự động lấy báo cáo của học sinh thuộc tài khoản đang đăng nhập
   * Hỗ trợ header 'x-student-id' khi tài khoản có nhiều con
   */
  @Get('my-report')
  @Roles(Role.STUDENT)
  async getMyReport(
    @Req() req: any,
    @Headers('x-student-id') headerStudentId?: string,
    @Query('week') weekStr?: string,
    @Query('year') yearStr?: string,
  ) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new ForbiddenException('Không xác định được danh tính người dùng');
    }

    // 1. Xác định studentId (Nếu có header x-student-id thì kiểm tra quyền sở hữu, nếu không lấy con đầu tiên)
    let targetStudentId = headerStudentId;
    if (targetStudentId) {
      const owned = await this.studentRepo.findOne({
        where: { id: targetStudentId, userId },
      });
      if (!owned) {
        throw new ForbiddenException('Bạn không có quyền truy cập báo cáo của học sinh này.');
      }
    } else {
      const defaultStudent = await this.studentRepo.findOne({
        where: { userId },
      });
      if (!defaultStudent) {
        throw new NotFoundException('Tài khoản này chưa được liên kết với học sinh nào');
      }
      targetStudentId = defaultStudent.id;
    }

    const { weekNumber, year } = this.resolveWeekAndYear(weekStr, yearStr);

    const result = await this.getWeeklyReportUseCase.execute({
      studentId: targetStudentId,
      weekNumber,
      year,
      requestUserId: userId,
      userRole: 'STUDENT',
    });

    return {
      success: true,
      data: this.serializeReport(result.report),
      hasSessions: result.hasSessions,
      message: result.message,
    };
  }

  /**
   * 2. API DÀNH CHO GIÁO VIÊN & ADMIN: XEM TỔNG HỢP SQI CẢ LỚP HỌC
   */
  @Get('class/:classId')
  @Roles(Role.ADMIN, Role.TEACHER)
  async getClassWeeklyReports(
    @Param('classId') classId: string,
    @Req() req: any,
    @Query('week') weekStr?: string,
    @Query('year') yearStr?: string,
  ) {
    const { weekNumber, year } = this.resolveWeekAndYear(weekStr, yearStr);

    const result = await this.getClassWeeklyReportsUseCase.execute({
      classId,
      weekNumber,
      year,
      requestUserId: req.user?.sub,
      userRole: req.user?.role,
    });

    return {
      success: true,
      data: result,
    };
  }

  /**
   * 3. API DÀNH CHO GIÁO VIÊN & ADMIN: XEM CHI TIẾT BÁO CÁO CỦA 1 HỌC SINH
   */
  @Get('student/:studentId')
  @Roles(Role.ADMIN, Role.TEACHER)
  async getStudentWeeklyReport(
    @Param('studentId') studentId: string,
    @Req() req: any,
    @Query('week') weekStr?: string,
    @Query('year') yearStr?: string,
  ) {
    const { weekNumber, year } = this.resolveWeekAndYear(weekStr, yearStr);

    const result = await this.getWeeklyReportUseCase.execute({
      studentId,
      weekNumber,
      year,
      requestUserId: req.user?.sub,
      userRole: req.user?.role,
    });

    return {
      success: true,
      data: this.serializeReport(result.report),
      hasSessions: result.hasSessions,
      message: result.message,
    };
  }

  private serializeReport(report: any): any {
    if (!report) return null;
    return typeof report.toJSON === 'function' ? report.toJSON() : report;
  }

  private resolveWeekAndYear(weekStr?: string, yearStr?: string): { weekNumber: number; year: number } {
    const now = new Date();
    const currentYear = yearStr ? parseInt(yearStr, 10) : now.getFullYear();

    if (weekStr) {
      const parsedWeek = parseInt(weekStr, 10);
      if (!isNaN(parsedWeek) && parsedWeek >= 1 && parsedWeek <= 53) {
        return { weekNumber: parsedWeek, year: currentYear };
      }
    }

    // Mặc định tuần hiện tại theo ISO
    const target = new Date(now.valueOf());
    const dayNr = (now.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    const currentWeekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);

    return { weekNumber: currentWeekNumber, year: currentYear };
  }
}
