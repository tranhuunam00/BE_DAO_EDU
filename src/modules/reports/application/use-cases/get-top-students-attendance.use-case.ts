import { Injectable } from '@nestjs/common';
import { ReportFilters, ReportsQueryPort } from '../ports/reports-query.port';

@Injectable()
export class GetTopStudentsAttendanceUseCase {
  constructor(private readonly query: ReportsQueryPort) {}

  async execute(filters: ReportFilters) {
    const [topPresent, topAbsent] = await Promise.all([
      this.query.getTopPresentStudents(filters),
      this.query.getTopAbsentStudentsRanked(filters),
    ]);

    return { topPresent, topAbsent };
  }
}
