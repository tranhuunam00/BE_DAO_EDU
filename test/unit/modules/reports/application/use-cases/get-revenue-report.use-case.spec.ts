import { GetRevenueReportUseCase } from '../../../../../../src/modules/reports/application/use-cases/get-revenue-report.use-case';
import { ReportsQueryPort } from '../../../../../../src/modules/reports/application/ports/reports-query.port';

describe('GetRevenueReportUseCase', () => {
  let useCase: GetRevenueReportUseCase;
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
    useCase = new GetRevenueReportUseCase(mockQuery);
  });

  it('should aggregate revenue summary, monthly and center data', async () => {
    mockQuery.getRevenueSummary.mockResolvedValue({
      totalExpected: 5000000,
      totalPaid: 3500000,
      totalDebt: 1500000,
      collectionRate: 70,
    });
    mockQuery.getRevenueByMonth.mockResolvedValue([
      { month: '2026-06', expected: 5000000, paid: 3500000 },
    ]);
    mockQuery.getRevenueByCenter.mockResolvedValue([
      { centerId: 'c1', centerName: 'Hà Nội', expected: 3000000, paid: 2000000 },
      { centerId: 'c2', centerName: 'HCM', expected: 2000000, paid: 1500000 },
    ]);

    const result = await useCase.execute({ month: '2026-06' });

    expect(result.summary.totalExpected).toBe(5000000);
    expect(result.summary.collectionRate).toBe(70);
    expect(result.byMonth).toHaveLength(1);
    expect(result.byCenter).toHaveLength(2);
    expect(mockQuery.getRevenueSummary).toHaveBeenCalledWith({ month: '2026-06' });
  });

  it('should pass filters to all query methods', async () => {
    mockQuery.getRevenueSummary.mockResolvedValue({ totalExpected: 0, totalPaid: 0, totalDebt: 0, collectionRate: 0 });
    mockQuery.getRevenueByMonth.mockResolvedValue([]);
    mockQuery.getRevenueByCenter.mockResolvedValue([]);

    const filters = { month: '2026-05', centerId: 'center-123' };
    await useCase.execute(filters);

    expect(mockQuery.getRevenueSummary).toHaveBeenCalledWith(filters);
    expect(mockQuery.getRevenueByMonth).toHaveBeenCalledWith(filters);
    expect(mockQuery.getRevenueByCenter).toHaveBeenCalledWith(filters);
  });
});
