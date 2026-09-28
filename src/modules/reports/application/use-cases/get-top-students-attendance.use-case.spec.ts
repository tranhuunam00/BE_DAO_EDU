/**
 * SPEC: GetTopStudentsAttendanceUseCase
 * TDD RED phase — test se FAIL cho den khi implementation duoc viet.
 *
 * Shared Mock DB: ../../__mocks__/reports.mock-db.ts
 * Khong dinh nghia input rieng trong file nay.
 */

import {
  MOCK_ATTENDANCE,
  MOCK_SESSIONS,
  MOCK_STUDENTS,
  computeTopStudentsFromMock,
  generateLargeMockAttendance,
} from '../../__mocks__/reports.mock-db';

import {
  ReportFilters,
  ReportsQueryPort,
  TopAbsentStudent,
  TopAttendanceStudentRow,
  RevenueSummary,
  RevenueByMonth,
  RevenueByCenterRow,
  SalarySummary,
  SalaryByTeacherRow,
  SalaryByMonth,
  AttendanceSummary,
  AttendanceByClassRow,
  AttendanceByMonth,
  AssignmentSummary,
  AssignmentByClassRow,
  StudentsSummary,
  NewStudentsByMonthRow,
  NewStudentRow,
} from '../ports/reports-query.port';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Stub dung chung — implement dung tu shared mock DB, khong tu dinh nghia data */
class StubReportsQueryPort extends ReportsQueryPort {
  async getTopPresentStudents(filters: ReportFilters): Promise<TopAttendanceStudentRow[]> {
    const rows = computeTopStudentsFromMock(
      MOCK_ATTENDANCE, MOCK_SESSIONS, MOCK_STUDENTS, 'present', filters.classId,
    );
    return rows.filter((r) => r.rank <= 5);
  }

  async getTopAbsentStudentsRanked(filters: ReportFilters): Promise<TopAttendanceStudentRow[]> {
    const rows = computeTopStudentsFromMock(
      MOCK_ATTENDANCE, MOCK_SESSIONS, MOCK_STUDENTS, 'absent', filters.classId,
    );
    return rows.filter((r) => r.rank <= 5);
  }

  // Stubs khong lien quan -- tra ve never throw (dung as any de qua strict typing)
  async getRevenueSummary(_f: ReportFilters):         Promise<RevenueSummary>         { throw new Error('not used'); }
  async getRevenueByMonth(_f: ReportFilters):          Promise<RevenueByMonth[]>        { throw new Error('not used'); }
  async getRevenueByCenter(_f: ReportFilters):         Promise<RevenueByCenterRow[]>    { throw new Error('not used'); }
  async getSalarySummary(_f: ReportFilters):           Promise<SalarySummary>           { throw new Error('not used'); }
  async getSalaryByTeacher(_f: ReportFilters):         Promise<SalaryByTeacherRow[]>    { throw new Error('not used'); }
  async getSalaryByMonth(_f: ReportFilters):           Promise<SalaryByMonth[]>         { throw new Error('not used'); }
  async getAttendanceSummary(_f: ReportFilters):       Promise<AttendanceSummary>       { throw new Error('not used'); }
  async getAttendanceByClass(_f: ReportFilters):       Promise<AttendanceByClassRow[]>  { throw new Error('not used'); }
  async getAttendanceByMonth(_f: ReportFilters):       Promise<AttendanceByMonth[]>     { throw new Error('not used'); }
  async getTopAbsentStudents(_f: ReportFilters):       Promise<TopAbsentStudent[]>      { throw new Error('not used'); }
  async getAssignmentSummary(_f: ReportFilters):       Promise<AssignmentSummary>       { throw new Error('not used'); }
  async getAssignmentByClass(_f: ReportFilters):       Promise<AssignmentByClassRow[]>  { throw new Error('not used'); }
  async getStudentsSummary(_f: ReportFilters):         Promise<StudentsSummary>         { throw new Error('not used'); }
  async getNewStudentsByMonth(_f: ReportFilters):      Promise<NewStudentsByMonthRow[]> { throw new Error('not used'); }
  async getNewStudentsList(_f: ReportFilters):         Promise<NewStudentRow[]>         { throw new Error('not used'); }
  async getClassStudentsStats(_f: ReportFilters):      Promise<any[]>                   { throw new Error('not used'); }
  async getSaleOrdersReport(_f: ReportFilters):        Promise<any[]>                   { throw new Error('not used'); }
  async getStudentAttendanceReport(_f: ReportFilters): Promise<any[]>                   { throw new Error('not used'); }
  async getStudentDebtsReport(_f: ReportFilters):      Promise<any[]>                   { throw new Error('not used'); }
}

// ─── Import Use Case ──────────────────────────────────────────────────────────
import { GetTopStudentsAttendanceUseCase } from './get-top-students-attendance.use-case';

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('GetTopStudentsAttendanceUseCase', () => {
  let useCase: GetTopStudentsAttendanceUseCase;
  let stub: StubReportsQueryPort;

  beforeEach(() => {
    stub    = new StubReportsQueryPort();
    useCase = new GetTopStudentsAttendanceUseCase(stub);
  });

  // 1. Response shape
  it('should return both topPresent and topAbsent in the response', async () => {
    const result = await useCase.execute({});
    expect(result).toHaveProperty('topPresent');
    expect(result).toHaveProperty('topAbsent');
    expect(Array.isArray(result.topPresent)).toBe(true);
    expect(Array.isArray(result.topAbsent)).toBe(true);
  });

  // 2. topPresent thu tu DESC
  it('topPresent should be sorted descending by presentCount', async () => {
    const { topPresent } = await useCase.execute({});
    for (let i = 1; i < topPresent.length; i++) {
      expect(topPresent[i - 1].presentCount).toBeGreaterThanOrEqual(topPresent[i].presentCount);
    }
  });

  // 3. topAbsent thu tu DESC
  it('topAbsent should be sorted descending by absentCount', async () => {
    const { topAbsent } = await useCase.execute({});
    for (let i = 1; i < topAbsent.length; i++) {
      expect(topAbsent[i - 1].absentCount).toBeGreaterThanOrEqual(topAbsent[i].absentCount);
    }
  });

  // 4. TIE: dong hang phai tra ve TAT CA
  it('topPresent should include ALL students tied at rank 1 (stu-1, stu-7, stu-8 all 10/10)', async () => {
    const { topPresent } = await useCase.execute({});
    const rank1 = topPresent.filter((r) => r.rank === 1);
    expect(rank1.length).toBe(3);
    const codes = rank1.map((r) => r.studentCode).sort();
    expect(codes).toEqual(['HS001', 'HS007', 'HS008']);
  });

  // 5. Khong qua rank 5
  it('topPresent should not contain students with rank > 5', async () => {
    const { topPresent } = await useCase.execute({});
    expect(topPresent.every((r) => r.rank <= 5)).toBe(true);
  });

  it('topAbsent should not contain students with rank > 5', async () => {
    const { topAbsent } = await useCase.execute({});
    expect(topAbsent.every((r) => r.rank <= 5)).toBe(true);
  });

  // 6. Inactive bi loai
  it('should exclude inactive students (stu-9) from both lists', async () => {
    const { topPresent, topAbsent } = await useCase.execute({});
    const allIds = [...topPresent, ...topAbsent].map((r) => r.studentId);
    expect(allIds).not.toContain('stu-9');
  });

  // 7. Shape cua tung row
  it('each row should have all required fields', async () => {
    const { topPresent, topAbsent } = await useCase.execute({});
    const requiredFields: (keyof TopAttendanceStudentRow)[] = [
      'studentId', 'studentCode', 'fullName',
      'presentCount', 'absentCount', 'totalSessions',
      'attendanceRate', 'rank',
    ];
    for (const row of [...topPresent, ...topAbsent]) {
      for (const field of requiredFields) {
        expect(row).toHaveProperty(field);
      }
    }
  });

  // 8. attendanceRate chinh xac
  it('attendanceRate should equal presentCount/totalSessions * 100 (1 decimal)', async () => {
    const { topPresent } = await useCase.execute({});
    for (const row of topPresent) {
      const expected = row.totalSessions > 0
        ? Number(((row.presentCount / row.totalSessions) * 100).toFixed(1))
        : 0;
      expect(row.attendanceRate).toBe(expected);
    }
  });

  // 9. Filter theo classId
  it('when filtered by classId cls-1, totalSessions <= 5 (cls-1 has 5 sessions)', async () => {
    const { topPresent } = await useCase.execute({ classId: 'cls-1' });
    for (const row of topPresent) {
      expect(row.totalSessions).toBeLessThanOrEqual(5);
    }
  });

  // 10. PERFORMANCE BENCHMARK
  it('computes top present/absent for 10,000 attendance rows under 200ms SLA (Performance Benchmark)', async () => {
    const { students, sessions, attendance } = generateLargeMockAttendance(200, 50);

    const largeStub = new (class extends StubReportsQueryPort {
      async getTopPresentStudents(): Promise<TopAttendanceStudentRow[]> {
        return computeTopStudentsFromMock(
          attendance as any, sessions as any, students as any, 'present',
        ).filter((r) => r.rank <= 5);
      }
      async getTopAbsentStudentsRanked(): Promise<TopAttendanceStudentRow[]> {
        return computeTopStudentsFromMock(
          attendance as any, sessions as any, students as any, 'absent',
        ).filter((r) => r.rank <= 5);
      }
    })();

    const largeUseCase = new GetTopStudentsAttendanceUseCase(largeStub);

    const startTime = performance.now();
    const result    = await largeUseCase.execute({});
    const duration  = performance.now() - startTime;

    expect(result.topPresent.length).toBeGreaterThan(0);
    expect(result.topAbsent.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(200); // SLA: 200ms
  });
});
