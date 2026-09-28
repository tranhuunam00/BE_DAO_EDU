import {
  IStudentReportApprovalRepositoryPort,
  ReportType,
  StudentReportApprovalRecord,
} from '../ports/student-report-approval-repository.port';

export interface ToggleReportApprovalInput {
  studentId: string;
  reportType: ReportType;
  periodNumber: number;
  year: number;
  isApproved: boolean;
  userId: string;
  commendation?: string | null;
  suggestion?: string | null;
}

export class ToggleReportApprovalUseCase {
  constructor(private readonly repository: IStudentReportApprovalRepositoryPort) {}

  async execute(input: ToggleReportApprovalInput): Promise<StudentReportApprovalRecord> {
    if (!input.studentId || !input.studentId.trim()) {
      throw new Error('studentId không được để trống');
    }
    if (input.reportType === 'week' && (input.periodNumber < 1 || input.periodNumber > 53)) {
      throw new Error('Số tuần không hợp lệ (1 - 53)');
    }
    if (input.reportType === 'month' && (input.periodNumber < 1 || input.periodNumber > 12)) {
      throw new Error('Số tháng không hợp lệ (1 - 12)');
    }
    if (!input.userId || !input.userId.trim()) {
      throw new Error('userId người thực hiện không được để trống');
    }

    const now = new Date();

    return await this.repository.saveApproval({
      studentId: input.studentId,
      reportType: input.reportType,
      periodNumber: input.periodNumber,
      year: input.year,
      isApproved: input.isApproved,
      approvedByUserId: input.isApproved ? input.userId : null,
      approvedAt: input.isApproved ? now : null,
      commendation: input.commendation,
      suggestion: input.suggestion,
    });
  }
}
