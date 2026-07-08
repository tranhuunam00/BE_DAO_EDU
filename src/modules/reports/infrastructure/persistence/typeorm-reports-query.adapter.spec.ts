import { TypeOrmReportsQueryAdapter } from './typeorm-reports-query.adapter';
import { ReportFilters } from '../../application/ports/reports-query.port';

describe('TypeOrmReportsQueryAdapter getAttendanceByClass', () => {
  it('should correctly calculate totalTuition based on dynamic session rates', async () => {
    // 1. Mock database queries
    const mockQuery = jest.fn();

    mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('cl.id AS "classId"') && sql.includes('COUNT(*)')) {
        // Return class overview
        return [
          {
            classId: 'class-1',
            classCode: 'MATH101',
            className: 'Math 101',
            totalSessions: 2,
            presentCount: 2,
            absentCount: 0,
          },
        ];
      }
      if (sql.includes('cs.id AS "sessionId"') && sql.includes('cs.date AS "date"')) {
        // Return sessions: 1 in June, 1 in July
        return [
          { sessionId: 'sess-june', classId: 'class-1', date: new Date('2026-06-15') },
          { sessionId: 'sess-july', classId: 'class-1', date: new Date('2026-07-15') },
        ];
      }
      if (sql.includes('sa.student_id AS "studentId"') && sql.includes('TO_CHAR')) {
        // Return student attendance: present June and July
        return [
          {
            studentId: 'student-1',
            studentCode: 'STU-001',
            studentName: 'Nguyen Van A',
            mobile: '0123456789',
            sessionId: 'sess-june',
            isPresent: true,
            classId: 'class-1',
            month: '2026-06',
          },
          {
            studentId: 'student-1',
            studentCode: 'STU-001',
            studentName: 'Nguyen Van A',
            mobile: '0123456789',
            sessionId: 'sess-july',
            isPresent: true,
            classId: 'class-1',
            month: '2026-07',
          },
        ];
      }
      if (sql.includes('student_monthly_bill_items bi')) {
        // Return billing items with different rates for June and July
        return [
          {
            classId: 'class-1',
            studentId: 'student-1',
            month: '2026-06',
            rate: 150000,
            totalAmount: 150000,
            paymentStatus: 'Paid',
          },
          {
            classId: 'class-1',
            studentId: 'student-1',
            month: '2026-07',
            rate: 180000,
            totalAmount: 180000,
            paymentStatus: 'Unpaid',
          },
        ];
      }
      if (sql.includes('course_level_pricing p')) {
        // Return default pricing
        return [
          { classId: 'class-1', rate: 120000 },
        ];
      }
      return [];
    });

    const mockDataSource = {
      query: mockQuery,
    };

    const adapter = new TypeOrmReportsQueryAdapter(mockDataSource as any);
    const filters: ReportFilters = {
      centerId: 'center-1',
      classId: 'class-1',
    };

    // 2. Execute
    const result = await adapter.getAttendanceByClass(filters);

    // 3. Verify
    expect(result).toHaveLength(1);
    const classReport = result[0];
    expect(classReport.classId).toBe('class-1');
    expect(classReport.students).toHaveLength(1);

    const studentReport = classReport.students![0];
    expect(studentReport.studentId).toBe('student-1');
    expect(studentReport.presentCount).toBe(2);

    // June rate is 150k, July rate is 180k, student attended both
    // totalTuition should be 150k + 180k = 330k
    expect(studentReport.totalTuition).toBe(330000);

    // Latest month rate should be set to pricePerSession
    expect(studentReport.pricePerSession).toBe(180000);

    // Payment status should keep the worst (Unpaid vs Paid -> Unpaid)
    expect(studentReport.paymentStatus).toBe('Unpaid');

    // Attendance records map check
    expect(studentReport.attendance['sess-june']).toEqual({
      isPresent: true,
      rate: 150000,
    });
    expect(studentReport.attendance['sess-july']).toEqual({
      isPresent: true,
      rate: 180000,
    });
  });
});
