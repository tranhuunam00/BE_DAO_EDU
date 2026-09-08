/**
 * Migration Verification Test Suite
 * Kịch bản kiểm thử toàn diện cho Database Migration:
 * Snapshot Tài chính Bất biến (CH-02) & Thù lao GV/Trợ giảng (CH-05).
 */

export interface StudentAttendanceRow {
  id: string;
  studentId: string;
  classSessionId: string;
  billId: string | null;
  billedAmount: number | null;
}

export interface ClassSessionRow {
  id: string;
  classId: string;
  teacherId: string;
  assistantId: string | null;
  wageId: string | null;
  assistantWageId: string | null;
  billedTeacherWage: number | null;
  billedAssistantWage: number | null;
}

export interface StudentBillItemRow {
  id: string;
  billId: string;
  studentId: string;
  classSessionId: string;
  rate: number;
}

export interface TeacherWageItemRow {
  id: string;
  wageId: string;
  teacherId: string;
  classSessionId: string;
  role: 'teacher' | 'assistant';
  rate: number;
}

export class MigrationSimulator {
  /**
   * Mô phỏng SQL Backfill cho student_attendance
   */
  static backfillStudentAttendance(
    attendances: StudentAttendanceRow[],
    billItems: StudentBillItemRow[],
  ): StudentAttendanceRow[] {
    return attendances.map((att) => {
      if (!att.billId) {
        return { ...att, billedAmount: null };
      }
      const item = billItems.find(
        (bi) => bi.billId === att.billId && bi.classSessionId === att.classSessionId && bi.studentId === att.studentId,
      );
      const amount = item !== undefined ? item.rate : null;
      return { ...att, billedAmount: amount };
    });
  }

  /**
   * Mô phỏng SQL Backfill cho class_sessions
   */
  static backfillClassSessions(
    sessions: ClassSessionRow[],
    wageItems: TeacherWageItemRow[],
  ): ClassSessionRow[] {
    return sessions.map((sess) => {
      let billedTeacherWage: number | null = null;
      if (sess.wageId) {
        const item = wageItems.find(
          (wi) =>
            wi.wageId === sess.wageId &&
            wi.classSessionId === sess.id &&
            wi.teacherId === sess.teacherId &&
            wi.role === 'teacher',
        );
        billedTeacherWage = item !== undefined ? item.rate : null;
      }

      let billedAssistantWage: number | null = null;
      if (sess.assistantWageId && sess.assistantId) {
        const item = wageItems.find(
          (wi) =>
            wi.wageId === sess.assistantWageId &&
            wi.classSessionId === sess.id &&
            wi.teacherId === sess.assistantId &&
            wi.role === 'assistant',
        );
        billedAssistantWage = item !== undefined ? item.rate : null;
      }

      return {
        ...sess,
        billedTeacherWage,
        billedAssistantWage,
      };
    });
  }

  /**
   * Mô phỏng PostgreSQL CHECK Constraint:
   * (bill_id IS NULL AND billed_amount IS NULL) OR
   * (bill_id IS NOT NULL AND billed_amount IS NOT NULL AND billed_amount >= 0)
   */
  static validateStudentAttendanceCheckConstraint(row: StudentAttendanceRow): boolean {
    const isBothNull = row.billId === null && row.billedAmount === null;
    const isBothValid =
      row.billId !== null &&
      row.billedAmount !== null &&
      row.billedAmount !== undefined &&
      !isNaN(row.billedAmount) &&
      row.billedAmount >= 0;

    return isBothNull || isBothValid;
  }

  /**
   * Mô phỏng PostgreSQL CHECK Constraint:
   * (wage_id IS NULL AND billed_teacher_wage IS NULL) OR
   * (wage_id IS NOT NULL AND billed_teacher_wage IS NOT NULL AND billed_teacher_wage >= 0)
   */
  static validateClassSessionTeacherWageCheckConstraint(row: ClassSessionRow): boolean {
    const isBothNull = row.wageId === null && row.billedTeacherWage === null;
    const isBothValid =
      row.wageId !== null &&
      row.billedTeacherWage !== null &&
      row.billedTeacherWage !== undefined &&
      !isNaN(row.billedTeacherWage) &&
      row.billedTeacherWage >= 0;

    return isBothNull || isBothValid;
  }

  /**
   * Mô phỏng PostgreSQL CHECK Constraint cho assistant wage
   */
  static validateClassSessionAssistantWageCheckConstraint(row: ClassSessionRow): boolean {
    const isBothNull = row.assistantWageId === null && row.billedAssistantWage === null;
    const isBothValid =
      row.assistantWageId !== null &&
      row.billedAssistantWage !== null &&
      row.billedAssistantWage !== undefined &&
      !isNaN(row.billedAssistantWage) &&
      row.billedAssistantWage >= 0;

    return isBothNull || isBothValid;
  }
}

describe('Database Migration Test Suite - Snapshot CH-02 & Dual-Role CH-05 (10 Cases)', () => {
  // Case M1: Normal Student Attendance Backfill
  it('Case M01: should backfill billedAmount = 150000 from student_monthly_bill_items when billId is present', () => {
    const attendances: StudentAttendanceRow[] = [
      { id: 'att-1', studentId: 'std-1', classSessionId: 'sess-1', billId: 'bill-1', billedAmount: null },
    ];
    const billItems: StudentBillItemRow[] = [
      { id: 'bi-1', billId: 'bill-1', studentId: 'std-1', classSessionId: 'sess-1', rate: 150000 },
    ];

    const result = MigrationSimulator.backfillStudentAttendance(attendances, billItems);
    expect(result[0].billedAmount).toBe(150000);
    expect(MigrationSimulator.validateStudentAttendanceCheckConstraint(result[0])).toBe(true);
  });

  // Case M2: Unbilled Session (billId is null)
  it('Case M02: should leave billedAmount = null when billId is null', () => {
    const attendances: StudentAttendanceRow[] = [
      { id: 'att-2', studentId: 'std-1', classSessionId: 'sess-2', billId: null, billedAmount: null },
    ];
    const billItems: StudentBillItemRow[] = [];

    const result = MigrationSimulator.backfillStudentAttendance(attendances, billItems);
    expect(result[0].billedAmount).toBeNull();
    expect(MigrationSimulator.validateStudentAttendanceCheckConstraint(result[0])).toBe(true);
  });

  // Case M3: Zero Amount (Scholarship / Free class - rate = 0)
  it('Case M03: should backfill billedAmount = 0 when rate is 0 (100% scholarship) and not treat as null', () => {
    const attendances: StudentAttendanceRow[] = [
      { id: 'att-3', studentId: 'std-2', classSessionId: 'sess-1', billId: 'bill-2', billedAmount: null },
    ];
    const billItems: StudentBillItemRow[] = [
      { id: 'bi-2', billId: 'bill-2', studentId: 'std-2', classSessionId: 'sess-1', rate: 0 },
    ];

    const result = MigrationSimulator.backfillStudentAttendance(attendances, billItems);
    expect(result[0].billedAmount).toBe(0);
    expect(result[0].billedAmount).not.toBeNull();
    expect(MigrationSimulator.validateStudentAttendanceCheckConstraint(result[0])).toBe(true);
  });

  // Case M4: Normal Teacher Wage Backfill
  it('Case M04: should backfill billedTeacherWage = 200000 from teacher_monthly_wage_items', () => {
    const sessions: ClassSessionRow[] = [
      {
        id: 'sess-1',
        classId: 'cls-1',
        teacherId: 'tch-1',
        assistantId: null,
        wageId: 'wage-1',
        assistantWageId: null,
        billedTeacherWage: null,
        billedAssistantWage: null,
      },
    ];
    const wageItems: TeacherWageItemRow[] = [
      { id: 'wi-1', wageId: 'wage-1', teacherId: 'tch-1', classSessionId: 'sess-1', role: 'teacher', rate: 200000 },
    ];

    const result = MigrationSimulator.backfillClassSessions(sessions, wageItems);
    expect(result[0].billedTeacherWage).toBe(200000);
    expect(result[0].billedAssistantWage).toBeNull();
    expect(MigrationSimulator.validateClassSessionTeacherWageCheckConstraint(result[0])).toBe(true);
    expect(MigrationSimulator.validateClassSessionAssistantWageCheckConstraint(result[0])).toBe(true);
  });

  // Case M5: Normal Assistant Wage Backfill
  it('Case M05: should backfill billedAssistantWage = 80000 when assistantWageId is present', () => {
    const sessions: ClassSessionRow[] = [
      {
        id: 'sess-1',
        classId: 'cls-1',
        teacherId: 'tch-1',
        assistantId: 'ast-1',
        wageId: null,
        assistantWageId: 'wage-ast-1',
        billedTeacherWage: null,
        billedAssistantWage: null,
      },
    ];
    const wageItems: TeacherWageItemRow[] = [
      { id: 'wi-2', wageId: 'wage-ast-1', teacherId: 'ast-1', classSessionId: 'sess-1', role: 'assistant', rate: 80000 },
    ];

    const result = MigrationSimulator.backfillClassSessions(sessions, wageItems);
    expect(result[0].billedTeacherWage).toBeNull();
    expect(result[0].billedAssistantWage).toBe(80000);
    expect(MigrationSimulator.validateClassSessionTeacherWageCheckConstraint(result[0])).toBe(true);
    expect(MigrationSimulator.validateClassSessionAssistantWageCheckConstraint(result[0])).toBe(true);
  });

  // Case M6: Zero Wage Teacher, No Assistant
  it('Case M06: should backfill billedTeacherWage = 0 when volunteer teacher rate is 0', () => {
    const sessions: ClassSessionRow[] = [
      {
        id: 'sess-2',
        classId: 'cls-1',
        teacherId: 'tch-2',
        assistantId: null,
        wageId: 'wage-2',
        assistantWageId: null,
        billedTeacherWage: null,
        billedAssistantWage: null,
      },
    ];
    const wageItems: TeacherWageItemRow[] = [
      { id: 'wi-3', wageId: 'wage-2', teacherId: 'tch-2', classSessionId: 'sess-2', role: 'teacher', rate: 0 },
    ];

    const result = MigrationSimulator.backfillClassSessions(sessions, wageItems);
    expect(result[0].billedTeacherWage).toBe(0);
    expect(result[0].billedAssistantWage).toBeNull();
    expect(MigrationSimulator.validateClassSessionTeacherWageCheckConstraint(result[0])).toBe(true);
  });

  // Case M7: Dual-Role Teacher & Assistant in same session (CH-05)
  it('Case M07: [CH-05] should accurately map teacher vs assistant rates when teacherId === assistantId', () => {
    const dualRoleTeacherId = 'tch-expert-1';
    const sessions: ClassSessionRow[] = [
      {
        id: 'sess-dual',
        classId: 'cls-1',
        teacherId: dualRoleTeacherId,
        assistantId: dualRoleTeacherId, // Same person acting as both
        wageId: 'wage-main',
        assistantWageId: 'wage-sub',
        billedTeacherWage: null,
        billedAssistantWage: null,
      },
    ];
    const wageItems: TeacherWageItemRow[] = [
      {
        id: 'wi-tch',
        wageId: 'wage-main',
        teacherId: dualRoleTeacherId,
        classSessionId: 'sess-dual',
        role: 'teacher',
        rate: 250000,
      },
      {
        id: 'wi-ast',
        wageId: 'wage-sub',
        teacherId: dualRoleTeacherId,
        classSessionId: 'sess-dual',
        role: 'assistant',
        rate: 100000,
      },
    ];

    const result = MigrationSimulator.backfillClassSessions(sessions, wageItems);
    expect(result[0].billedTeacherWage).toBe(250000);
    expect(result[0].billedAssistantWage).toBe(100000);
    expect(MigrationSimulator.validateClassSessionTeacherWageCheckConstraint(result[0])).toBe(true);
    expect(MigrationSimulator.validateClassSessionAssistantWageCheckConstraint(result[0])).toBe(true);
  });

  // Case M8: DB CHECK Constraint Violation - billId is present but billedAmount is null
  it('Case M08: should violate DB CHECK constraint if billId is not null but billedAmount is null', () => {
    const invalidRow: StudentAttendanceRow = {
      id: 'att-invalid-1',
      studentId: 'std-1',
      classSessionId: 'sess-1',
      billId: 'bill-99',
      billedAmount: null, // Violation!
    };
    expect(MigrationSimulator.validateStudentAttendanceCheckConstraint(invalidRow)).toBe(false);
  });

  // Case M9: DB CHECK Constraint Violation - billId is null but billedAmount is set
  it('Case M09: should violate DB CHECK constraint if billId is null but billedAmount is set (> 0)', () => {
    const invalidRow: StudentAttendanceRow = {
      id: 'att-invalid-2',
      studentId: 'std-1',
      classSessionId: 'sess-1',
      billId: null,
      billedAmount: 150000, // Violation!
    };
    expect(MigrationSimulator.validateStudentAttendanceCheckConstraint(invalidRow)).toBe(false);
  });

  // Case M10: DB CHECK Constraint Violation - Negative amount
  it('Case M10: should violate DB CHECK constraint if billed amount is negative', () => {
    const invalidStudentRow: StudentAttendanceRow = {
      id: 'att-invalid-3',
      studentId: 'std-1',
      classSessionId: 'sess-1',
      billId: 'bill-1',
      billedAmount: -50000, // Negative violation!
    };
    expect(MigrationSimulator.validateStudentAttendanceCheckConstraint(invalidStudentRow)).toBe(false);

    const invalidSessionRow: ClassSessionRow = {
      id: 'sess-invalid',
      classId: 'cls-1',
      teacherId: 'tch-1',
      assistantId: null,
      wageId: 'wage-1',
      assistantWageId: null,
      billedTeacherWage: -100000, // Negative violation!
      billedAssistantWage: null,
    };
    expect(MigrationSimulator.validateClassSessionTeacherWageCheckConstraint(invalidSessionRow)).toBe(false);
  });
});
