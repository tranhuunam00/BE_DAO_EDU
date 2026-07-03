import { Injectable } from '@nestjs/common';
import { ReportFilters, ReportsQueryPort } from '../ports/reports-query.port';

@Injectable()
export class GetRevenueReportUseCase {
  constructor(private readonly query: ReportsQueryPort) {}

  async execute(filters: ReportFilters) {
    const [summary, byMonth, byCenter] = await Promise.all([
      this.query.getRevenueSummary(filters),
      this.query.getRevenueByMonth(filters),
      this.query.getRevenueByCenter(filters),
    ]);

    return { summary, byMonth, byCenter };
  }
}
