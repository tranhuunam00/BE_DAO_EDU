import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { Role } from '../../domain/value-objects/role.enum';
import { ReportFilters } from '../../modules/reports/application/ports/reports-query.port';
import { GetRevenueReportUseCase } from '../../modules/reports/application/use-cases/get-revenue-report.use-case';
import { GetSalaryReportUseCase } from '../../modules/reports/application/use-cases/get-salary-report.use-case';
import { GetAttendanceReportUseCase } from '../../modules/reports/application/use-cases/get-attendance-report.use-case';
import { GetAssignmentReportUseCase } from '../../modules/reports/application/use-cases/get-assignment-report.use-case';
import { GetStudentsReportUseCase } from '../../modules/reports/application/use-cases/get-students-report.use-case';

@ApiTags('Báo cáo (Reports)')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ReportController {
  constructor(
    private readonly revenueReport: GetRevenueReportUseCase,
    private readonly salaryReport: GetSalaryReportUseCase,
    private readonly attendanceReport: GetAttendanceReportUseCase,
    private readonly assignmentReport: GetAssignmentReportUseCase,
    private readonly studentsReport: GetStudentsReportUseCase,
  ) {}

  @Get('revenue')
  @ApiOperation({ summary: 'Báo cáo doanh thu học phí' })
  getRevenue(
    @Query('month') month?: string,
    @Query('centerId') centerId?: string,
    @Query('classId') classId?: string,
  ) {
    const filters: ReportFilters = { month, centerId, classId };
    return this.revenueReport.execute(filters);
  }

  @Get('salary')
  @ApiOperation({ summary: 'Báo cáo chi phí lương giáo viên' })
  getSalary(
    @Query('month') month?: string,
    @Query('centerId') centerId?: string,
  ) {
    const filters: ReportFilters = { month, centerId };
    return this.salaryReport.execute(filters);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Báo cáo điểm danh' })
  getAttendance(
    @Query('month') month?: string,
    @Query('centerId') centerId?: string,
    @Query('classId') classId?: string,
  ) {
    const filters: ReportFilters = { month, centerId, classId };
    return this.attendanceReport.execute(filters);
  }

  @Get('assignments')
  @ApiOperation({ summary: 'Báo cáo bài tập' })
  getAssignments(
    @Query('month') month?: string,
    @Query('centerId') centerId?: string,
    @Query('classId') classId?: string,
  ) {
    const filters: ReportFilters = { month, centerId, classId };
    return this.assignmentReport.execute(filters);
  }

  @Get('students')
  @ApiOperation({ summary: 'Báo cáo học viên mới' })
  getStudents(
    @Query('month') month?: string,
    @Query('centerId') centerId?: string,
    @Query('classId') classId?: string,
  ) {
    const filters: ReportFilters = { month, centerId, classId };
    return this.studentsReport.execute(filters);
  }
}
