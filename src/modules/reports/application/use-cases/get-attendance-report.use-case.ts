import { Injectable } from '@nestjs/common';
import { ReportFilters, ReportsQueryPort } from '../ports/reports-query.port';

@Injectable()
export class GetAttendanceReportUseCase {
  constructor(private readonly query: ReportsQueryPort) {}

  async execute(filters: ReportFilters) {
    const [summary, byClass, byMonth, topAbsent] = await Promise.all([
      this.query.getAttendanceSummary(filters),
      this.query.getAttendanceByClass(filters),
      this.query.getAttendanceByMonth(filters),
      this.query.getTopAbsentStudents(filters),
    ]);

    return { summary, byClass, byMonth, topAbsent };
  }
}
