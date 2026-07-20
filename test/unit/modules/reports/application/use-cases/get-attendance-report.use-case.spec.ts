import { GetAttendanceReportUseCase } from '../../../../../../src/modules/reports/application/use-cases/get-attendance-report.use-case';
import { ReportsQueryPort } from '../../../../../../src/modules/reports/application/ports/reports-query.port';

describe('GetAttendanceReportUseCase', () => {
  let useCase: GetAttendanceReportUseCase;
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
    useCase = new GetAttendanceReportUseCase(mockQuery);
  });

  it('should aggregate attendance summary, class, monthly trend and top absent students', async () => {
    mockQuery.getAttendanceSummary.mockResolvedValue({
      totalSessions: 10,
      totalPresent: 8,
      totalAbsent: 2,
      attendanceRate: 80,
    });
    mockQuery.getAttendanceByClass.mockResolvedValue([
      { classId: 'c1', classCode: 'LH1', className: 'Lớp 1', totalSessions: 10, presentCount: 8, absentCount: 2, rate: 80 },
    ]);
    mockQuery.getAttendanceByMonth.mockResolvedValue([
      { month: '2026-06', rate: 80, present: 8, absent: 2 },
    ]);
    mockQuery.getTopAbsentStudents.mockResolvedValue([
      { studentId: 's1', studentCode: 'HS1', studentName: 'Học sinh 1', absentCount: 2, totalSessions: 10, rate: 20 },
    ]);

    const result = await useCase.execute({ month: '2026-06' });

    expect(result.summary.totalSessions).toBe(10);
    expect(result.summary.attendanceRate).toBe(80);
    expect(result.byClass).toHaveLength(1);
    expect(result.byMonth).toHaveLength(1);
    expect(result.topAbsent).toHaveLength(1);
    expect(mockQuery.getAttendanceSummary).toHaveBeenCalledWith({ month: '2026-06' });
  });
});
