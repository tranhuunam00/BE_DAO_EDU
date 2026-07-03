import { Injectable } from '@nestjs/common';
import { ReportFilters, ReportsQueryPort } from '../ports/reports-query.port';

@Injectable()
export class GetSalaryReportUseCase {
  constructor(private readonly query: ReportsQueryPort) {}

  async execute(filters: ReportFilters) {
    const [summary, byTeacher, byMonth] = await Promise.all([
      this.query.getSalarySummary(filters),
      this.query.getSalaryByTeacher(filters),
      this.query.getSalaryByMonth(filters),
    ]);

    return { summary, byTeacher, byMonth };
  }
}
