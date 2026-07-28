import { GetAssignmentReportUseCase } from '../../../../../../src/modules/reports/application/use-cases/get-assignment-report.use-case';
import { ReportsQueryPort } from '../../../../../../src/modules/reports/application/ports/reports-query.port';

describe('GetAssignmentReportUseCase', () => {
  let useCase: GetAssignmentReportUseCase;
  let mockQuery: jest.Mocked<ReportsQueryPort>;

  beforeEach(() => {
    mockQuery = {
      getRevenueSummary: jest.fn(),
      getRevenueByMonth: jest.fn(),
      getRevenueByCenter: jest.fn(),
      getSalarySummary: jest.fn(),
      getSalaryByTeacher: jest.fn(),
      getSalaryByMonth: jest.fn(),
      getAttendanceSummary: jest.fn(),
      getAttendanceByClass: jest.fn(),
      getAttendanceByMonth: jest.fn(),
      getTopAbsentStudents: jest.fn(),
      getAssignmentSummary: jest.fn(),
      getAssignmentByClass: jest.fn(),
    } as any;
    useCase = new GetAssignmentReportUseCase(mockQuery);
  });

  it('should aggregate assignment summary and class breakdown', async () => {
    mockQuery.getAssignmentSummary.mockResolvedValue({
      totalAssigned: 5,
      totalSubmitted: 4,
      totalGraded: 3,
      totalMissing: 1,
      averageScore: 8.5,
    });
    mockQuery.getAssignmentByClass.mockResolvedValue([
      { classId: 'c1', classCode: 'LH1', className: 'Lớp 1', assigned: 5, submitted: 4, graded: 3, missing: 1, averageScore: 8.5 },
    ]);

    const result = await useCase.execute({ month: '2026-06' });

    expect(result.summary.totalAssigned).toBe(5);
    expect(result.summary.averageScore).toBe(8.5);
    expect(result.byClass).toHaveLength(1);
    expect(mockQuery.getAssignmentSummary).toHaveBeenCalledWith({ month: '2026-06' });
  });
});
