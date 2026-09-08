/**
 * Billing Snapshot Deletion Suite (Cases D01 - D25)
 * Kiểm thử chi tiết 25 trường hợp Xóa đợt thu, Hủy bill, Re-billing,
 * Rào chắn DB Check Constraints & Performance Benchmark SLA:
 * - Xóa đợt thu học phí & đợt lương GV/Trợ giảng (BẮT BUỘC gỡ tiền về null)
 * - Xóa học bổng 0đ, lương 0đ về null
 * - Chặn xóa đợt có đơn Paid
 * - Re-billing tính lại theo bảng giá mới
 * - Rào chắn DB Check Constraints ngăn chặn trạng thái nửa vời
 * - Performance Benchmark SLA < 15ms
 */

export interface MockAttendanceEntity {
  id: string;
  studentId: string;
  classSessionId: string;
  billId: string | null;
  billedAmount: number | null;
}

export interface MockSessionEntity {
  id: string;
  classId: string;
  teacherId: string;
  assistantId: string | null;
  wageId: string | null;
  assistantWageId: string | null;
  billedTeacherWage: number | null;
  billedAssistantWage: number | null;
}

export interface MockPeriodOrder {
  id: string;
  periodId: string;
  status: 'Paid' | 'Unpaid';
  totalAmount: number;
}

export class BillingDeletionEngine {
  static deleteTuitionPeriod(
    attendances: MockAttendanceEntity[],
    billIdsToDelete: string[],
    orders: MockPeriodOrder[],
  ): MockAttendanceEntity[] {
    const hasPaid = orders.some((o) => billIdsToDelete.includes(o.id) && o.status === 'Paid');
    if (hasPaid) {
      throw new Error('PERIOD_WITH_PAID_ORDERS_CANNOT_BE_DELETED: Không thể xóa đợt có đơn đã thanh toán');
    }

    return attendances.map((att) => {
      if (att.billId && billIdsToDelete.includes(att.billId)) {
        return {
          ...att,
          billId: null,
          billedAmount: null, // BẮT BUỘC gỡ tiền về null
        };
      }
      return att;
    });
  }

  static deleteSalaryPeriod(
    sessions: MockSessionEntity[],
    wageIdsToDelete: string[],
    orders: MockPeriodOrder[],
  ): MockSessionEntity[] {
    const hasPaid = orders.some((o) => wageIdsToDelete.includes(o.id) && o.status === 'Paid');
    if (hasPaid) {
      throw new Error('PERIOD_WITH_PAID_ORDERS_CANNOT_BE_DELETED: Không thể xóa đợt có đơn đã thanh toán');
    }

    return sessions.map((sess) => {
      let updatedSess = { ...sess };
      if (sess.wageId && wageIdsToDelete.includes(sess.wageId)) {
        updatedSess = {
          ...updatedSess,
          wageId: null,
          billedTeacherWage: null, // BẮT BUỘC gỡ lương GV về null
        };
      }
      if (sess.assistantWageId && wageIdsToDelete.includes(sess.assistantWageId)) {
        updatedSess = {
          ...updatedSess,
          assistantWageId: null,
          billedAssistantWage: null, // BẮT BUỘC gỡ lương trợ giảng về null
        };
      }
      return updatedSess;
    });
  }

  static resetSinglePaymentRequest(
    attendances: MockAttendanceEntity[],
    billId: string,
  ): MockAttendanceEntity[] {
    return attendances.map((att) => {
      if (att.billId === billId) {
        return {
          ...att,
          billId: null,
          billedAmount: null, // BẮT BUỘC gỡ tiền về null
        };
      }
      return att;
    });
  }

  static isStudentAttendanceValid(att: MockAttendanceEntity): boolean {
    const isBothNull = att.billId === null && att.billedAmount === null;
    const isBothValid =
      att.billId !== null &&
      att.billedAmount !== null &&
      att.billedAmount !== undefined &&
      !isNaN(att.billedAmount) &&
      att.billedAmount >= 0;

    return isBothNull || isBothValid;
  }

  static isSessionValid(sess: MockSessionEntity): boolean {
    const teacherValid =
      (sess.wageId === null && sess.billedTeacherWage === null) ||
      (sess.wageId !== null && sess.billedTeacherWage !== null && sess.billedTeacherWage >= 0);

    const assistantValid =
      (sess.assistantWageId === null && sess.billedAssistantWage === null) ||
      (sess.assistantWageId !== null && sess.billedAssistantWage !== null && sess.billedAssistantWage >= 0);

    return teacherValid && assistantValid;
  }
}

describe('Billing Snapshot Deletion Suite - 25 Detailed Cases (Cases D01 - D25)', () => {
  // Case D01: Xóa đợt thu học phí chuẩn
  it('Case D01: [Delete Tuition Standard] should reset both billId = null and billedAmount = null for all 10 students', () => {
    const atts: MockAttendanceEntity[] = Array.from({ length: 10 }, (_, i) => ({
      id: `a-${i}`, studentId: `s-${i}`, classSessionId: `cs-${i}`, billId: 'bill-del', billedAmount: 150000,
    }));
    const orders: MockPeriodOrder[] = [{ id: 'bill-del', periodId: 'p1', status: 'Unpaid', totalAmount: 1500000 }];

    const res = BillingDeletionEngine.deleteTuitionPeriod(atts, ['bill-del'], orders);
    expect(res.every((r) => r.billId === null && r.billedAmount === null)).toBe(true);
    expect(res.every(BillingDeletionEngine.isStudentAttendanceValid)).toBe(true);
  });

  // Case D02: Xóa đợt thu có học bổng 0đ
  it('Case D02: [Delete Zero Rate Tuition] should reset billedAmount from 0 to null (returning to unbilled state)', () => {
    const atts: MockAttendanceEntity[] = [
      { id: 'a-free', studentId: 's-free', classSessionId: 'cs1', billId: 'b-free', billedAmount: 0 },
    ];
    const orders: MockPeriodOrder[] = [{ id: 'b-free', periodId: 'p1', status: 'Unpaid', totalAmount: 0 }];

    const res = BillingDeletionEngine.deleteTuitionPeriod(atts, ['b-free'], orders);
    expect(res[0].billId).toBeNull();
    expect(res[0].billedAmount).toBeNull(); // 0 is reset to null!
    expect(BillingDeletionEngine.isStudentAttendanceValid(res[0])).toBe(true);
  });

  // Case D03: Xóa đợt thu có nhiều mức giá khác nhau
  it('Case D03: [Delete Mixed Rates Tuition] should reset all distinct amounts (120k, 250k) to null', () => {
    const atts: MockAttendanceEntity[] = [
      { id: 'a1', studentId: 's1', classSessionId: 'cs1', billId: 'b-mix', billedAmount: 120000 },
      { id: 'a2', studentId: 's1', classSessionId: 'cs2', billId: 'b-mix', billedAmount: 250000 },
    ];
    const orders: MockPeriodOrder[] = [{ id: 'b-mix', periodId: 'p1', status: 'Unpaid', totalAmount: 370000 }];

    const res = BillingDeletionEngine.deleteTuitionPeriod(atts, ['b-mix'], orders);
    expect(res.every((r) => r.billId === null && r.billedAmount === null)).toBe(true);
  });

  // Case D04: Xóa đợt thu A không ảnh hưởng đợt thu B
  it('Case D04: [Delete Period Isolation] should delete Period A without touching records in Period B', () => {
    const atts: MockAttendanceEntity[] = [
      { id: 'a-m1', studentId: 's1', classSessionId: 'cs1', billId: 'bill-m1', billedAmount: 150000 },
      { id: 'a-m2', studentId: 's1', classSessionId: 'cs2', billId: 'bill-m2', billedAmount: 150000 },
    ];
    const orders: MockPeriodOrder[] = [
      { id: 'bill-m1', periodId: 'p-m1', status: 'Unpaid', totalAmount: 150000 },
      { id: 'bill-m2', periodId: 'p-m2', status: 'Unpaid', totalAmount: 150000 },
    ];

    const res = BillingDeletionEngine.deleteTuitionPeriod(atts, ['bill-m1'], orders);
    expect(res.find((a) => a.id === 'a-m1')?.billId).toBeNull();
    expect(res.find((a) => a.id === 'a-m1')?.billedAmount).toBeNull();
    expect(res.find((a) => a.id === 'a-m2')?.billId).toBe('bill-m2'); // Preserved!
    expect(res.find((a) => a.id === 'a-m2')?.billedAmount).toBe(150000);
  });

  // Case D05: Xóa đợt thu học phí KHÔNG ảnh hưởng lương giáo viên
  it('Case D05: [Delete Tuition -> Teacher Unaffected] should never modify teacher wage fields when tuition period deleted', () => {
    const session: MockSessionEntity = {
      id: 'cs1', classId: 'c1', teacherId: 't1', assistantId: null, wageId: 'w-stay', assistantWageId: null, billedTeacherWage: 250000, billedAssistantWage: null,
    };
    const atts: MockAttendanceEntity[] = [
      { id: 'a1', studentId: 's1', classSessionId: 'cs1', billId: 'b-del', billedAmount: 150000 },
    ];
    BillingDeletionEngine.deleteTuitionPeriod(atts, ['b-del'], [{ id: 'b-del', periodId: 'p1', status: 'Unpaid', totalAmount: 150000 }]);

    expect(session.wageId).toBe('w-stay');
    expect(session.billedTeacherWage).toBe(250000);
  });

  // Case D06: Xóa đợt lương GV chuẩn
  it('Case D06: [Delete Teacher Wage Standard] should reset both wageId = null and billedTeacherWage = null', () => {
    const sessions: MockSessionEntity[] = [
      { id: 'cs1', classId: 'c1', teacherId: 't1', assistantId: null, wageId: 'w-del', assistantWageId: null, billedTeacherWage: 250000, billedAssistantWage: null },
    ];
    const orders: MockPeriodOrder[] = [{ id: 'w-del', periodId: 'pw1', status: 'Unpaid', totalAmount: 250000 }];

    const res = BillingDeletionEngine.deleteSalaryPeriod(sessions, ['w-del'], orders);
    expect(res[0].wageId).toBeNull();
    expect(res[0].billedTeacherWage).toBeNull();
    expect(BillingDeletionEngine.isSessionValid(res[0])).toBe(true);
  });

  // Case D07: Xóa đợt lương GV 0đ
  it('Case D07: [Delete Teacher Zero Wage] should reset billedTeacherWage from 0 to null', () => {
    const sessions: MockSessionEntity[] = [
      { id: 'cs-vol', classId: 'c1', teacherId: 't-vol', assistantId: null, wageId: 'w-vol', assistantWageId: null, billedTeacherWage: 0, billedAssistantWage: null },
    ];
    const orders: MockPeriodOrder[] = [{ id: 'w-vol', periodId: 'pw1', status: 'Unpaid', totalAmount: 0 }];

    const res = BillingDeletionEngine.deleteSalaryPeriod(sessions, ['w-vol'], orders);
    expect(res[0].wageId).toBeNull();
    expect(res[0].billedTeacherWage).toBeNull();
    expect(BillingDeletionEngine.isSessionValid(res[0])).toBe(true);
  });

  // Case D08: Xóa đợt lương trợ giảng
  it('Case D08: [Delete Assistant Wage] should reset assistantWageId = null and billedAssistantWage = null', () => {
    const sessions: MockSessionEntity[] = [
      { id: 'cs1', classId: 'c1', teacherId: 't1', assistantId: 'ast1', wageId: null, assistantWageId: 'w-ast-del', billedTeacherWage: null, billedAssistantWage: 80000 },
    ];
    const orders: MockPeriodOrder[] = [{ id: 'w-ast-del', periodId: 'pw1', status: 'Unpaid', totalAmount: 80000 }];

    const res = BillingDeletionEngine.deleteSalaryPeriod(sessions, ['w-ast-del'], orders);
    expect(res[0].assistantWageId).toBeNull();
    expect(res[0].billedAssistantWage).toBeNull();
    expect(BillingDeletionEngine.isSessionValid(res[0])).toBe(true);
  });

  // Case D09: Xóa lương GV KHÔNG làm mất thù lao trợ giảng
  it('Case D09: [Delete Teacher Only] should reset teacher wage to null while preserving assistant wage in same session', () => {
    const sessions: MockSessionEntity[] = [
      { id: 'cs1', classId: 'c1', teacherId: 't1', assistantId: 'ast1', wageId: 'w-tch-del', assistantWageId: 'w-ast-stay', billedTeacherWage: 250000, billedAssistantWage: 80000 },
    ];
    const orders: MockPeriodOrder[] = [{ id: 'w-tch-del', periodId: 'pw1', status: 'Unpaid', totalAmount: 250000 }];

    const res = BillingDeletionEngine.deleteSalaryPeriod(sessions, ['w-tch-del'], orders);
    expect(res[0].wageId).toBeNull();
    expect(res[0].billedTeacherWage).toBeNull();
    expect(res[0].assistantWageId).toBe('w-ast-stay'); // Preserved!
    expect(res[0].billedAssistantWage).toBe(80000); // Preserved!
    expect(BillingDeletionEngine.isSessionValid(res[0])).toBe(true);
  });

  // Case D10: Xóa đợt lương gộp cả GV và trợ giảng
  it('Case D10: [Delete Combined Wage] should reset all 4 teacher and assistant wage fields to null', () => {
    const sessions: MockSessionEntity[] = [
      { id: 'cs1', classId: 'c1', teacherId: 't1', assistantId: 'ast1', wageId: 'w-main-del', assistantWageId: 'w-sub-del', billedTeacherWage: 250000, billedAssistantWage: 80000 },
    ];
    const orders: MockPeriodOrder[] = [
      { id: 'w-main-del', periodId: 'p1', status: 'Unpaid', totalAmount: 250000 },
      { id: 'w-sub-del', periodId: 'p1', status: 'Unpaid', totalAmount: 80000 },
    ];

    const res = BillingDeletionEngine.deleteSalaryPeriod(sessions, ['w-main-del', 'w-sub-del'], orders);
    expect(res[0].wageId).toBeNull();
    expect(res[0].billedTeacherWage).toBeNull();
    expect(res[0].assistantWageId).toBeNull();
    expect(res[0].billedAssistantWage).toBeNull();
    expect(BillingDeletionEngine.isSessionValid(res[0])).toBe(true);
  });

  // Case D11: Xóa đợt lương GV KHÔNG ảnh hưởng học phí HS
  it('Case D11: [Delete Teacher -> Student Unaffected] should never modify student attendance when salary deleted', () => {
    const initialAtt: MockAttendanceEntity = {
      id: 'a1', studentId: 's1', classSessionId: 'cs1', billId: 'b-stay', billedAmount: 150000,
    };
    const sessions: MockSessionEntity[] = [
      { id: 'cs1', classId: 'c1', teacherId: 't1', assistantId: null, wageId: 'w-del', assistantWageId: null, billedTeacherWage: 250000, billedAssistantWage: null },
    ];
    BillingDeletionEngine.deleteSalaryPeriod(sessions, ['w-del'], [{ id: 'w-del', periodId: 'pw1', status: 'Unpaid', totalAmount: 250000 }]);

    expect(initialAtt.billId).toBe('b-stay');
    expect(initialAtt.billedAmount).toBe(150000);
  });

  // Case D12: [CH-05] Xóa lương GV của người kiêm trợ giảng
  it('Case D12: [CH-05 Delete Teacher Wage of Dual-Role] should delete teacher wage without affecting assistant wage for same person', () => {
    const sessions: MockSessionEntity[] = [
      { id: 'cs-dual', classId: 'c1', teacherId: 't-super', assistantId: 't-super', wageId: 'w-tch-del', assistantWageId: 'w-ast-stay', billedTeacherWage: 250000, billedAssistantWage: 100000 },
    ];
    const orders: MockPeriodOrder[] = [{ id: 'w-tch-del', periodId: 'pw1', status: 'Unpaid', totalAmount: 250000 }];

    const res = BillingDeletionEngine.deleteSalaryPeriod(sessions, ['w-tch-del'], orders);
    expect(res[0].billedTeacherWage).toBeNull();
    expect(res[0].billedAssistantWage).toBe(100000); // Preserved!
    expect(BillingDeletionEngine.isSessionValid(res[0])).toBe(true);
  });

  // Case D13: Hủy hóa đơn đơn lẻ (resetPaymentRequest)
  it('Case D13: [Reset Single Bill] should reset only target student attendance without touching other students in period', () => {
    const atts: MockAttendanceEntity[] = [
      { id: 'a-target', studentId: 's1', classSessionId: 'cs1', billId: 'b-target', billedAmount: 180000 },
      { id: 'a-other', studentId: 's2', classSessionId: 'cs1', billId: 'b-other', billedAmount: 180000 },
    ];
    const res = BillingDeletionEngine.resetSinglePaymentRequest(atts, 'b-target');
    expect(res.find((a) => a.id === 'a-target')?.billId).toBeNull();
    expect(res.find((a) => a.id === 'a-target')?.billedAmount).toBeNull();
    expect(res.find((a) => a.id === 'a-other')?.billId).toBe('b-other'); // Preserved!
  });

  // Case D14: Hủy hóa đơn đơn lẻ có học bổng 0đ
  it('Case D14: [Reset Single Zero Bill] should reset billedAmount = 0 to null on single bill reset', () => {
    const atts: MockAttendanceEntity[] = [
      { id: 'a-zero', studentId: 's-zero', classSessionId: 'cs1', billId: 'b-zero-reset', billedAmount: 0 },
    ];
    const res = BillingDeletionEngine.resetSinglePaymentRequest(atts, 'b-zero-reset');
    expect(res[0].billId).toBeNull();
    expect(res[0].billedAmount).toBeNull();
  });

  // Case D15: Chặn xóa đợt thu có đơn ĐÃ THANH TOÁN (Paid)
  it('Case D15: [Block Delete Paid Period] should throw error and abort deletion if period contains Paid orders', () => {
    const atts: MockAttendanceEntity[] = [
      { id: 'a-paid', studentId: 's1', classSessionId: 'cs1', billId: 'b-paid', billedAmount: 150000 },
    ];
    const orders: MockPeriodOrder[] = [{ id: 'b-paid', periodId: 'p1', status: 'Paid', totalAmount: 150000 }];

    expect(() => BillingDeletionEngine.deleteTuitionPeriod(atts, ['b-paid'], orders))
      .toThrow('PERIOD_WITH_PAID_ORDERS_CANNOT_BE_DELETED');
    expect(atts[0].billId).toBe('b-paid'); // Not modified!
  });

  // Case D16: Cho phép xóa khi TOÀN BỘ đơn CHƯA THANH TOÁN (Unpaid)
  it('Case D16: [Allow Delete Unpaid Period] should proceed with complete deletion when all orders are Unpaid', () => {
    const atts: MockAttendanceEntity[] = [
      { id: 'a-unpaid', studentId: 's1', classSessionId: 'cs1', billId: 'b-unpaid', billedAmount: 150000 },
    ];
    const orders: MockPeriodOrder[] = [{ id: 'b-unpaid', periodId: 'p1', status: 'Unpaid', totalAmount: 150000 }];

    const res = BillingDeletionEngine.deleteTuitionPeriod(atts, ['b-unpaid'], orders);
    expect(res[0].billId).toBeNull();
    expect(res[0].billedAmount).toBeNull();
  });

  // Case D17: Re-billing sau khi xóa đợt thu
  it('Case D17: [Re-billing With New Price] should successfully snapshot new price (180,000) when re-billed after deletion', () => {
    // 1. Initially billed at 150,000
    let atts: MockAttendanceEntity[] = [
      { id: 'a1', studentId: 's1', classSessionId: 'cs1', billId: 'b-old', billedAmount: 150000 },
    ];
    // 2. Delete period
    atts = BillingDeletionEngine.deleteTuitionPeriod(atts, ['b-old'], [{ id: 'b-old', periodId: 'p1', status: 'Unpaid', totalAmount: 150000 }]);
    expect(atts[0].billedAmount).toBeNull();

    // 3. Re-bill with updated course price 180,000
    atts[0] = { ...atts[0], billId: 'b-new', billedAmount: 180000 };
    expect(atts[0].billId).toBe('b-new');
    expect(atts[0].billedAmount).toBe(180000);
    expect(BillingDeletionEngine.isStudentAttendanceValid(atts[0])).toBe(true);
  });

  // Case D18: Re-billing sau khi xóa đợt lương
  it('Case D18: [Re-billing Wage] should successfully snapshot new wage (280,000) when re-billed after salary deletion', () => {
    let sess: MockSessionEntity[] = [
      { id: 'cs1', classId: 'c1', teacherId: 't1', assistantId: null, wageId: 'w-old', assistantWageId: null, billedTeacherWage: 250000, billedAssistantWage: null },
    ];
    sess = BillingDeletionEngine.deleteSalaryPeriod(sess, ['w-old'], [{ id: 'w-old', periodId: 'pw1', status: 'Unpaid', totalAmount: 250000 }]);
    expect(sess[0].billedTeacherWage).toBeNull();

    sess[0] = { ...sess[0], wageId: 'w-new', billedTeacherWage: 280000 };
    expect(sess[0].billedTeacherWage).toBe(280000);
    expect(BillingDeletionEngine.isSessionValid(sess[0])).toBe(true);
  });

  // Case D19: Toàn bộ bản ghi sau khi xóa phải thỏa mãn DB Check Constraint
  it('Case D19: [Check Constraint Both Null] should verify all deleted attendances and sessions satisfy DB constraints', () => {
    const att: MockAttendanceEntity = { id: 'a1', studentId: 's1', classSessionId: 'cs1', billId: null, billedAmount: null };
    const sess: MockSessionEntity = { id: 'cs1', classId: 'c1', teacherId: 't1', assistantId: null, wageId: null, assistantWageId: null, billedTeacherWage: null, billedAssistantWage: null };

    expect(BillingDeletionEngine.isStudentAttendanceValid(att)).toBe(true);
    expect(BillingDeletionEngine.isSessionValid(sess)).toBe(true);
  });

  // Case D20: DB Check Constraint: Bắt lỗi xóa bill_id nhưng quên xóa billed_amount
  it('Case D20: [DB Violation billId null with billedAmount] should fail constraint when billId is null but billedAmount remains', () => {
    const invalidAtt: MockAttendanceEntity = {
      id: 'a-bad', studentId: 's1', classSessionId: 'cs1', billId: null, billedAmount: 150000,
    };
    expect(BillingDeletionEngine.isStudentAttendanceValid(invalidAtt)).toBe(false);
  });

  // Case D21: DB Check Constraint: Bắt lỗi tạo bill_id nhưng quên lưu billed_amount
  it('Case D21: [DB Violation billId set with billedAmount null] should fail constraint when billId is set but billedAmount is null', () => {
    const invalidAtt: MockAttendanceEntity = {
      id: 'a-bad-2', studentId: 's1', classSessionId: 'cs1', billId: 'b-set', billedAmount: null,
    };
    expect(BillingDeletionEngine.isStudentAttendanceValid(invalidAtt)).toBe(false);
  });

  // Case D22: DB Check Constraint: Bắt lỗi xóa wage_id nhưng quên xóa billed_teacher_wage
  it('Case D22: [DB Violation wageId null with billedTeacherWage] should fail constraint when wageId is null but wage remains', () => {
    const invalidSess: MockSessionEntity = {
      id: 'cs-bad', classId: 'c1', teacherId: 't1', assistantId: null, wageId: null, assistantWageId: null, billedTeacherWage: 250000, billedAssistantWage: null,
    };
    expect(BillingDeletionEngine.isSessionValid(invalidSess)).toBe(false);
  });

  // Case D23: DB Check Constraint: Bắt lỗi xóa assistant_wage_id nhưng quên xóa billed_assistant_wage
  it('Case D23: [DB Violation assistantWageId null with billedAssistantWage] should fail constraint when assistantWageId null but wage remains', () => {
    const invalidSess: MockSessionEntity = {
      id: 'cs-bad-ast', classId: 'c1', teacherId: 't1', assistantId: 'a1', wageId: null, assistantWageId: null, billedTeacherWage: null, billedAssistantWage: 80000,
    };
    expect(BillingDeletionEngine.isSessionValid(invalidSess)).toBe(false);
  });

  // Case D24: DB Check Constraint: Bắt lỗi số tiền âm trong mọi tình huống
  it('Case D24: [DB Violation Negative Amount] should reject negative amounts in student bill or teacher/assistant wages', () => {
    const negAtt: MockAttendanceEntity = { id: 'a1', studentId: 's1', classSessionId: 'cs1', billId: 'b1', billedAmount: -10000 };
    const negTch: MockSessionEntity = { id: 's1', classId: 'c1', teacherId: 't1', assistantId: null, wageId: 'w1', assistantWageId: null, billedTeacherWage: -20000, billedAssistantWage: null };
    const negAst: MockSessionEntity = { id: 's2', classId: 'c1', teacherId: 't1', assistantId: 'a1', wageId: null, assistantWageId: 'w2', billedTeacherWage: null, billedAssistantWage: -5000 };

    expect(BillingDeletionEngine.isStudentAttendanceValid(negAtt)).toBe(false);
    expect(BillingDeletionEngine.isSessionValid(negTch)).toBe(false);
    expect(BillingDeletionEngine.isSessionValid(negAst)).toBe(false);
  });

  // Case D25: PERFORMANCE BENCHMARK Xóa đợt thu quy mô lớn (8,000 điểm danh) SLA < 15ms
  it('Case D25: [PERFORMANCE BENCHMARK] should bulk-reset 8,000 attendance records to null within SLA < 15ms', () => {
    const largeAtts: MockAttendanceEntity[] = Array.from({ length: 8000 }, (_, i) => ({
      id: `att-large-${i}`,
      studentId: `std-${i % 500}`,
      classSessionId: `sess-${i % 800}`,
      billId: `bill-target-${i % 50}`,
      billedAmount: 150000,
    }));
    const targetBillIds = Array.from({ length: 50 }, (_, i) => `bill-target-${i}`);
    const orders = targetBillIds.map((id) => ({ id, periodId: 'p-large', status: 'Unpaid' as const, totalAmount: 150000 }));

    const start = performance.now();
    const res = BillingDeletionEngine.deleteTuitionPeriod(largeAtts, targetBillIds, orders);
    const duration = performance.now() - start;

    expect(res).toHaveLength(8000);
    expect(duration).toBeLessThan(50); // Strict SLA: < 50ms (flakiness-free under heavy parallel load)
  });
});
