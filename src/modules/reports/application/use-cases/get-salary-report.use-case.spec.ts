import { GetSalaryReportUseCase } from './get-salary-report.use-case';
import { ReportsQueryPort } from '../ports/reports-query.port';

describe('GetSalaryReportUseCase', () => {
  let useCase: GetSalaryReportUseCase;
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
    useCase = new GetSalaryReportUseCase(mockQuery);
  });

  it('should aggregate salary summary, teacher breakdown, and monthly trend', async () => {
    mockQuery.getSalarySummary.mockResolvedValue({
      totalMainTeacher: 10000000,
      totalTA: 3000000,
      totalExpense: 13000000,
      totalPaid: 10000000,
      totalUnpaid: 3000000,
    });
    mockQuery.getSalaryByTeacher.mockResolvedValue([
      { teacherId: 't1', teacherCode: 'GV1', teacherName: 'Giáo viên 1', type: 'Teacher', sessions: 10, totalAmount: 10000000, paidAmount: 10000000, status: 'Paid' },
      { teacherId: 't2', teacherCode: 'GV2', teacherName: 'Trợ giảng 1', type: 'Teaching Assistant', sessions: 5, totalAmount: 3000000, paidAmount: 0, status: 'Unpaid' },
    ]);
    mockQuery.getSalaryByMonth.mockResolvedValue([
      { month: '2026-06', mainTeacher: 10000000, ta: 3000000 },
    ]);

    const result = await useCase.execute({ month: '2026-06' });

    expect(result.summary.totalExpense).toBe(13000000);
    expect(result.byTeacher).toHaveLength(2);
    expect(result.byMonth).toHaveLength(1);
    expect(mockQuery.getSalarySummary).toHaveBeenCalledWith({ month: '2026-06' });
  });
});
