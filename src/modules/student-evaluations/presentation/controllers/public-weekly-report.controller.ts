import { Controller, Get, Param, Query } from '@nestjs/common';
import { GetWeeklyStudentReportUseCase } from '../../application/use-cases/get-weekly-student-report.use-case';
import { GetMonthlyStudentReportUseCase } from '../../application/use-cases/get-monthly-student-report.use-case';

@Controller('public/weekly-reports')
export class PublicWeeklyReportController {
  constructor(
    private readonly getWeeklyReportUseCase: GetWeeklyStudentReportUseCase,
    private readonly getMonthlyReportUseCase: GetMonthlyStudentReportUseCase,
  ) {}

  /**
   * API Công Khai (Public - Không cần Token / Auth):
   * Dành cho Phụ huynh truy cập xem Phiếu Báo Cáo Học Tập Tuần / Tháng của con qua liên kết hoặc quét mã QR.
   */
  @Get('student/:studentId')
  async getPublicStudentReport(
    @Param('studentId') studentId: string,
    @Query('type') typeStr?: string,
    @Query('week') weekStr?: string,
    @Query('year') yearStr?: string,
    @Query('month') monthStr?: string,
  ) {
    const isMonthly = typeStr === 'month' || Boolean(monthStr);
    const now = new Date();
    const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();

    if (isMonthly) {
      const month = monthStr ? parseInt(monthStr, 10) : now.getMonth() + 1;
      const result = await this.getMonthlyReportUseCase.execute({
        studentId,
        month: isNaN(month) || month < 1 || month > 12 ? now.getMonth() + 1 : month,
        year: isNaN(year) ? now.getFullYear() : year,
        requestUserId: 'PUBLIC_GUEST',
        userRole: 'PUBLIC',
      });

      return {
        success: true,
        data: this.serializeReport(result.report),
        hasSessions: result.hasSessions,
        message: result.message,
      };
    }

    const { weekNumber, validYear } = this.resolveWeekAndYear(weekStr, yearStr);
    const result = await this.getWeeklyReportUseCase.execute({
      studentId,
      weekNumber,
      year: validYear,
      requestUserId: 'PUBLIC_GUEST',
      userRole: 'PUBLIC',
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

  private resolveWeekAndYear(weekStr?: string, yearStr?: string): { weekNumber: number; validYear: number } {
    const now = new Date();
    const validYear = yearStr ? parseInt(yearStr, 10) : now.getFullYear();

    if (weekStr) {
      const parsedWeek = parseInt(weekStr, 10);
      if (!isNaN(parsedWeek) && parsedWeek >= 1 && parsedWeek <= 53) {
        return { weekNumber: parsedWeek, validYear: isNaN(validYear) ? now.getFullYear() : validYear };
      }
    }

    const target = new Date(now.valueOf());
    const dayNr = (now.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    const currentWeekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);

    return { weekNumber: currentWeekNumber, validYear: isNaN(validYear) ? now.getFullYear() : validYear };
  }
}
