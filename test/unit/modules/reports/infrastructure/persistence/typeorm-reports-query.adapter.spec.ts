import { TypeOrmReportsQueryAdapter } from '../../../../../../src/modules/reports/infrastructure/persistence/typeorm-reports-query.adapter';
import { ReportFilters } from '../../../../../../src/modules/reports/application/ports/reports-query.port';

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
      evaluationScore: null,
      evaluationComment: undefined,
    });
    expect(studentReport.attendance['sess-july']).toEqual({
      isPresent: true,
      rate: 180000,
      evaluationScore: null,
      evaluationComment: undefined,
    });
  });
});

describe('TypeOrmReportsQueryAdapter getNewStudentsList', () => {
  it('should return 1 row per student with birthdate and aggregated classNames', async () => {
    const mockQuery = jest.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('STRING_AGG')) {
        return [
          {
            studentId: 'stu-1',
            studentCode: 'HV-2026-007',
            studentName: 'Bùi Ngọc Linh',
            birthdate: '2010-05-15',
            mobile: '0912000007',
            status: 'Active',
            createdAt: '2026-07-01T08:00:00.000Z',
            classNames: 'Toán 10A1, Lý 10B2',
          },
          {
            studentId: 'stu-2',
            studentCode: 'HV-2026-008',
            studentName: 'Hoàng Phúc Nam',
            birthdate: null,
            mobile: '0912000008',
            status: 'Waiting for class',
            createdAt: '2026-07-02T08:00:00.000Z',
            classNames: null,
          },
        ];
      }
      return [];
    });

    const adapter = new TypeOrmReportsQueryAdapter({ query: mockQuery } as any);
    const result = await adapter.getNewStudentsList({});

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      studentId: 'stu-1',
      studentCode: 'HV-2026-007',
      studentName: 'Bùi Ngọc Linh',
      birthdate: '2010-05-15',
      mobile: '0912000007',
      status: 'Active',
      createdAt: '2026-07-01T08:00:00.000Z',
      classNames: 'Toán 10A1, Lý 10B2',
    });
    expect(result[1].classNames).toBe('—');
  });

  it('PERFORMANCE BENCHMARK: getNewStudentsList should process mapping in under 50ms', async () => {
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      studentId: `stu-${i}`,
      studentCode: `HV-2026-${String(i).padStart(3, '0')}`,
      studentName: `Học sinh ${i}`,
      birthdate: '2012-01-01',
      mobile: '0912345678',
      status: 'Active',
      createdAt: '2026-07-01T00:00:00.000Z',
      classNames: `Lớp A${i % 10}, Lớp B${i % 5}`,
    }));

    const mockQuery = jest.fn().mockResolvedValue(largeDataset);
    const adapter = new TypeOrmReportsQueryAdapter({ query: mockQuery } as any);

    const start = performance.now();
    const result = await adapter.getNewStudentsList({});
    const duration = performance.now() - start;

    expect(result).toHaveLength(1000);
    expect(duration).toBeLessThan(50); // SLA Time Limit < 50ms
  });
});

