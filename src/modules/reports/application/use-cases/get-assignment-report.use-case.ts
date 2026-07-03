import { Injectable } from '@nestjs/common';
import { ReportFilters, ReportsQueryPort } from '../ports/reports-query.port';

@Injectable()
export class GetAssignmentReportUseCase {
  constructor(private readonly query: ReportsQueryPort) {}

  async execute(filters: ReportFilters) {
    const [summary, byClass] = await Promise.all([
      this.query.getAssignmentSummary(filters),
      this.query.getAssignmentByClass(filters),
    ]);

    return { summary, byClass };
  }
}
