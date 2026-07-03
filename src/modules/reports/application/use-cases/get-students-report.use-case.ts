import { Injectable } from '@nestjs/common';
import { ReportFilters, ReportsQueryPort } from '../ports/reports-query.port';

@Injectable()
export class GetStudentsReportUseCase {
  constructor(private readonly query: ReportsQueryPort) {}

  async execute(filters: ReportFilters) {
    const [summary, byMonth, newList] = await Promise.all([
      this.query.getStudentsSummary(filters),
      this.query.getNewStudentsByMonth(filters),
      this.query.getNewStudentsList(filters),
    ]);

    return { summary, byMonth, newList };
  }
}
