import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { Role } from '../../domain/value-objects/role.enum';
import { ReportFilters, ReportsQueryPort } from '../../modules/reports/application/ports/reports-query.port';
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
    private readonly reportsQuery: ReportsQueryPort,
  ) {}

  private parseFilters(
    month?: string,
    centerId?: string,
    classId?: string,
    classIds?: string,
    classStatus?: string,
  ): ReportFilters {
    return {
      month,
      centerId,
      classId,
      classIds: classIds ? classIds.split(',').filter(Boolean) : undefined,
      classStatus,
    };
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Báo cáo doanh thu học phí' })
  getRevenue(
    @Query('month') month?: string,
    @Query('centerId') centerId?: string,
    @Query('classId') classId?: string,
    @Query('classIds') classIds?: string,
    @Query('classStatus') classStatus?: string,
  ) {
    return this.revenueReport.execute(this.parseFilters(month, centerId, classId, classIds, classStatus));
  }

  @Get('salary')
  @ApiOperation({ summary: 'Báo cáo chi phí lương giáo viên' })
  getSalary(
    @Query('month') month?: string,
    @Query('centerId') centerId?: string,
    @Query('classId') classId?: string,
    @Query('classIds') classIds?: string,
    @Query('classStatus') classStatus?: string,
  ) {
    return this.salaryReport.execute(this.parseFilters(month, centerId, classId, classIds, classStatus));
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Báo cáo điểm danh' })
  getAttendance(
    @Query('month') month?: string,
    @Query('centerId') centerId?: string,
    @Query('classId') classId?: string,
    @Query('classIds') classIds?: string,
    @Query('classStatus') classStatus?: string,
  ) {
    return this.attendanceReport.execute(this.parseFilters(month, centerId, classId, classIds, classStatus));
  }

  @Get('assignments')
  @ApiOperation({ summary: 'Báo cáo bài tập' })
  getAssignments(
    @Query('month') month?: string,
    @Query('centerId') centerId?: string,
    @Query('classId') classId?: string,
    @Query('classIds') classIds?: string,
    @Query('classStatus') classStatus?: string,
  ) {
    return this.assignmentReport.execute(this.parseFilters(month, centerId, classId, classIds, classStatus));
  }

  @Get('students')
  @ApiOperation({ summary: 'Báo cáo học viên mới' })
  getStudents(
    @Query('month') month?: string,
    @Query('centerId') centerId?: string,
    @Query('classId') classId?: string,
    @Query('classIds') classIds?: string,
    @Query('classStatus') classStatus?: string,
  ) {
    return this.studentsReport.execute(this.parseFilters(month, centerId, classId, classIds, classStatus));
  }

  @Get('class-students-stats')
  @ApiOperation({ summary: 'Thống kê học viên theo lớp' })
  getClassStudentsStats(
    @Query('centerId') centerId?: string,
    @Query('classId') classId?: string,
    @Query('classIds') classIds?: string,
    @Query('classStatus') classStatus?: string,
  ) {
    return this.reportsQuery.getClassStudentsStats(this.parseFilters(undefined, centerId, classId, classIds, classStatus));
  }

  @Get('sale-orders')
  @ApiOperation({ summary: 'Báo cáo SALE ORDER' })
  getSaleOrders(
    @Query('month') month?: string,
    @Query('centerId') centerId?: string,
    @Query('classId') classId?: string,
    @Query('classIds') classIds?: string,
    @Query('classStatus') classStatus?: string,
  ) {
    return this.reportsQuery.getSaleOrdersReport(this.parseFilters(month, centerId, classId, classIds, classStatus));
  }

  @Get('class-attendance')
  @ApiOperation({ summary: 'BC điểm danh theo lớp' })
  getClassAttendance(
    @Query('month') month?: string,
    @Query('centerId') centerId?: string,
    @Query('classId') classId?: string,
    @Query('classIds') classIds?: string,
    @Query('classStatus') classStatus?: string,
  ) {
    return this.reportsQuery.getAttendanceByClass(this.parseFilters(month, centerId, classId, classIds, classStatus));
  }

  @Get('student-attendance')
  @ApiOperation({ summary: 'BC điểm danh theo học viên' })
  getStudentAttendance(
    @Query('month') month?: string,
    @Query('centerId') centerId?: string,
    @Query('classId') classId?: string,
    @Query('classIds') classIds?: string,
    @Query('classStatus') classStatus?: string,
  ) {
    return this.reportsQuery.getStudentAttendanceReport(this.parseFilters(month, centerId, classId, classIds, classStatus));
  }

  @Get('student-debts')
  @ApiOperation({ summary: 'BC theo dõi công nợ học viên' })
  getStudentDebts(
    @Query('month') month?: string,
    @Query('centerId') centerId?: string,
    @Query('classId') classId?: string,
    @Query('classIds') classIds?: string,
    @Query('classStatus') classStatus?: string,
  ) {
    return this.reportsQuery.getStudentDebtsReport(this.parseFilters(month, centerId, classId, classIds, classStatus));
  }
}
