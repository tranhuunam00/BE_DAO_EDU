import { GetStudentsReportUseCase } from '../../../../../../src/modules/reports/application/use-cases/get-students-report.use-case';
import { ReportsQueryPort } from '../../../../../../src/modules/reports/application/ports/reports-query.port';

describe('GetStudentsReportUseCase', () => {
  let useCase: GetStudentsReportUseCase;
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
      getStudentsSummary: jest.fn(),
      getNewStudentsByMonth: jest.fn(),
      getNewStudentsList: jest.fn(),
    } as any;
    useCase = new GetStudentsReportUseCase(mockQuery);
  });

  it('should aggregate students summary, new students count by month, and new students list', async () => {
    mockQuery.getStudentsSummary.mockResolvedValue({
      totalStudents: 100,
      activeStudents: 90,
      newStudentsThisMonth: 10,
    });
    mockQuery.getNewStudentsByMonth.mockResolvedValue([
      { month: '2026-06', count: 10 },
      { month: '2026-05', count: 8 },
    ]);
    mockQuery.getNewStudentsList.mockResolvedValue([
      { studentId: 's1', studentCode: 'HS1', studentName: 'Học sinh 1', mobile: '0900000001', status: 'Active', createdAt: '2026-06-15' },
    ]);

    const result = await useCase.execute({ month: '2026-06' });

    expect(result.summary.totalStudents).toBe(100);
    expect(result.summary.newStudentsThisMonth).toBe(10);
    expect(result.byMonth).toHaveLength(2);
    expect(result.newList).toHaveLength(1);
    expect(mockQuery.getStudentsSummary).toHaveBeenCalledWith({ month: '2026-06' });
  });
});
