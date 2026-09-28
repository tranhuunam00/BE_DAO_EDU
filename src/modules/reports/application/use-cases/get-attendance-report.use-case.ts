import { Injectable } from '@nestjs/common';
import { ReportFilters, ReportsQueryPort } from '../ports/reports-query.port';

@Injectable()
export class GetAttendanceReportUseCase {
  constructor(private readonly query: ReportsQueryPort) {}

  async execute(filters: ReportFilters) {
    const [summary, byClass, byMonth, topAbsent, topPresent, topAbsentRanked] = await Promise.all([
      this.query.getAttendanceSummary(filters),
      this.query.getAttendanceByClass(filters),
      this.query.getAttendanceByMonth(filters),
      this.query.getTopAbsentStudents(filters),       // legacy — giu lai de khong breaking
      this.query.getTopPresentStudents(filters),      // top 5 di hoc nhieu (DENSE_RANK)
      this.query.getTopAbsentStudentsRanked(filters), // top 5 di hoc it (DENSE_RANK)
    ]);

    return { summary, byClass, byMonth, topAbsent, topPresent, topAbsentRanked };
  }
}
