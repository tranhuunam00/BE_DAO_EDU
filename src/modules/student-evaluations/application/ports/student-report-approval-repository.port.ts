export type ReportType = 'week' | 'month';

export interface StudentReportApprovalRecord {
  id: string;
  studentId: string;
  reportType: ReportType;
  periodNumber: number;
  year: number;
  isApproved: boolean;
  approvedByUserId?: string | null;
  approvedByName?: string | null;
  approvedAt?: Date | null;
  sentToZaloAt?: Date | null;
  commendation?: string | null;
  suggestion?: string | null;
}

export interface IStudentReportApprovalRepositoryPort {
  findApproval(
    studentId: string,
    reportType: ReportType,
    periodNumber: number,
    year: number,
  ): Promise<StudentReportApprovalRecord | null>;

  saveApproval(
    data: Omit<StudentReportApprovalRecord, 'id'> & { id?: string },
  ): Promise<StudentReportApprovalRecord>;

  findApprovalsByStudents(
    studentIds: string[],
    reportType: ReportType,
    periodNumber: number,
    year: number,
  ): Promise<Map<string, StudentReportApprovalRecord>>;
}
