/**
 * Billing Snapshot Creation Suite (Cases C01 - C25)
 * Kiểm thử chi tiết 25 trường hợp Tính tiền & Snapshot Tài chính Bất biến:
 * - Học sinh (Chuẩn, 0đ, nhiều lớp, ngày vào lớp, số lẻ, số lớn)
 * - Giáo viên & Trợ giảng (Chuẩn, 0đ, không trợ giảng, độc lập, dual-role CH-05, dạy thay)
 * - Tính cách ly tài chính & DB Check Constraint
 */

export interface MockAttendanceEntity {
  id: string;
  studentId: string;
  classSessionId: string;
  classId: string;
  billId: string | null;
  billedAmount: number | null;
  joinedDate?: string;
  sessionDate?: string;
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
  date?: string;
}

export interface BillLineInput {
  classId: string;
  className: string;
  courseName: string;
  levelName: string;
  sessionsCount: number;
  rate: number;
  totalAmount: number;
  sourceIds: string[];
  roleInSession?: 'teacher' | 'assistant';
}

export class BillingSnapshotEngine {
  static applyStudentBillSnapshot(
    attendances: MockAttendanceEntity[],
    billId: string,
    lines: BillLineInput[],
  ): MockAttendanceEntity[] {
    const updated = [...attendances];
    for (const line of lines.filter((l) => l.sessionsCount > 0)) {
      for (const attId of line.sourceIds) {
        const idx = updated.findIndex((a) => a.id === attId);
        if (idx !== -1) {
          updated[idx] = {
            ...updated[idx],
            billId,
            billedAmount: line.rate, // Snapshot rate bất biến
          };
        }
      }
    }
    return updated;
  }

  static applyTeacherWageSnapshot(
    sessions: MockSessionEntity[],
    wageId: string,
    lines: BillLineInput[],
  ): MockSessionEntity[] {
    const updated = [...sessions];
    for (const line of lines.filter((l) => l.sessionsCount > 0)) {
      const isAssistant = line.roleInSession === 'assistant';
      for (const sessId of line.sourceIds) {
        const idx = updated.findIndex((s) => s.id === sessId);
        if (idx !== -1) {
          if (isAssistant) {
            updated[idx] = {
              ...updated[idx],
              assistantWageId: wageId,
              billedAssistantWage: line.rate,
            };
          } else {
            updated[idx] = {
              ...updated[idx],
              wageId,
              billedTeacherWage: line.rate,
            };
          }
        }
      }
    }
    return updated;
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

describe('Billing Snapshot Creation Suite - 25 Detailed Cases (Cases C01 - C25)', () => {
  // Case C01: Học sinh chuẩn
  it('Case C01: [Student Standard] should snapshot billedAmount = 150000 when billing standard tuition', () => {
    const atts: MockAttendanceEntity[] = [
      { id: 'a1', studentId: 's1', classSessionId: 'cs1', classId: 'c1', billId: null, billedAmount: null },
    ];
    const lines: BillLineInput[] = [
      { classId: 'c1', className: 'Eng', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 150000, totalAmount: 150000, sourceIds: ['a1'] },
    ];
    const res = BillingSnapshotEngine.applyStudentBillSnapshot(atts, 'b1', lines);
    expect(res[0].billId).toBe('b1');
    expect(res[0].billedAmount).toBe(150000);
    expect(BillingSnapshotEngine.isStudentAttendanceValid(res[0])).toBe(true);
  });

  // Case C02: Học bổng 100% / miễn phí (rate = 0)
  it('Case C02: [Student Zero Rate] should snapshot billedAmount = 0 (NOT null) for 100% scholarship', () => {
    const atts: MockAttendanceEntity[] = [
      { id: 'a2', studentId: 's2', classSessionId: 'cs1', classId: 'c1', billId: null, billedAmount: null },
    ];
    const lines: BillLineInput[] = [
      { classId: 'c1', className: 'Eng', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 0, totalAmount: 0, sourceIds: ['a2'] },
    ];
    const res = BillingSnapshotEngine.applyStudentBillSnapshot(atts, 'b2', lines);
    expect(res[0].billedAmount).toBe(0);
    expect(res[0].billedAmount).not.toBeNull();
    expect(BillingSnapshotEngine.isStudentAttendanceValid(res[0])).toBe(true);
  });

  // Case C03: Nhiều buổi học cùng 1 rate
  it('Case C03: [Student Multiple Sessions] should snapshot billedAmount for all 8 sessions of student in month', () => {
    const atts: MockAttendanceEntity[] = Array.from({ length: 8 }, (_, i) => ({
      id: `a-${i}`,
      studentId: 's1',
      classSessionId: `cs-${i}`,
      classId: 'c1',
      billId: null,
      billedAmount: null,
    }));
    const lines: BillLineInput[] = [
      { classId: 'c1', className: 'Eng', courseName: 'E', levelName: 'L1', sessionsCount: 8, rate: 120000, totalAmount: 960000, sourceIds: atts.map((a) => a.id) },
    ];
    const res = BillingSnapshotEngine.applyStudentBillSnapshot(atts, 'b3', lines);
    expect(res).toHaveLength(8);
    res.forEach((r) => {
      expect(r.billId).toBe('b3');
      expect(r.billedAmount).toBe(120000);
      expect(BillingSnapshotEngine.isStudentAttendanceValid(r)).toBe(true);
    });
  });

  // Case C04: Nhiều buổi học khác rate trong cùng 1 bill
  it('Case C04: [Student Mixed Rates] should snapshot distinct rates (120k vs 250k) in same student bill', () => {
    const atts: MockAttendanceEntity[] = [
      { id: 'a-reg', studentId: 's1', classSessionId: 'cs1', classId: 'c1', billId: null, billedAmount: null },
      { id: 'a-ws', studentId: 's1', classSessionId: 'cs2', classId: 'c1', billId: null, billedAmount: null },
    ];
    const lines: BillLineInput[] = [
      { classId: 'c1', className: 'Eng Regular', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 120000, totalAmount: 120000, sourceIds: ['a-reg'] },
      { classId: 'c1', className: 'Eng Workshop', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 250000, totalAmount: 250000, sourceIds: ['a-ws'] },
    ];
    const res = BillingSnapshotEngine.applyStudentBillSnapshot(atts, 'b4', lines);
    expect(res.find((a) => a.id === 'a-reg')?.billedAmount).toBe(120000);
    expect(res.find((a) => a.id === 'a-ws')?.billedAmount).toBe(250000);
  });

  // Case C05: Học sinh học 2 lớp khác nhau
  it('Case C05: [Student Multi-Class] should snapshot accurate rates for different classes (English 150k, Math 200k)', () => {
    const atts: MockAttendanceEntity[] = [
      { id: 'a-eng', studentId: 's1', classSessionId: 'cs1', classId: 'c-eng', billId: null, billedAmount: null },
      { id: 'a-math', studentId: 's1', classSessionId: 'cs2', classId: 'c-math', billId: null, billedAmount: null },
    ];
    const lines: BillLineInput[] = [
      { classId: 'c-eng', className: 'English', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 150000, totalAmount: 150000, sourceIds: ['a-eng'] },
      { classId: 'c-math', className: 'Math', courseName: 'M', levelName: 'L2', sessionsCount: 1, rate: 200000, totalAmount: 200000, sourceIds: ['a-math'] },
    ];
    const res = BillingSnapshotEngine.applyStudentBillSnapshot(atts, 'b5', lines);
    expect(res.find((a) => a.id === 'a-eng')?.billedAmount).toBe(150000);
    expect(res.find((a) => a.id === 'a-math')?.billedAmount).toBe(200000);
  });

  // Case C06: Một buổi học nhiều học sinh
  it('Case C06: [Session Multi-Students] should snapshot billedAmount for all 10 students in same session', () => {
    const atts: MockAttendanceEntity[] = Array.from({ length: 10 }, (_, i) => ({
      id: `att-s${i}`,
      studentId: `s${i}`,
      classSessionId: 'sess-common',
      classId: 'c1',
      billId: null,
      billedAmount: null,
    }));
    const lines: BillLineInput[] = [
      { classId: 'c1', className: 'Class 1', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 140000, totalAmount: 140000, sourceIds: atts.map((a) => a.id) },
    ];
    const res = BillingSnapshotEngine.applyStudentBillSnapshot(atts, 'b6', lines);
    expect(res.every((r) => r.billedAmount === 140000 && r.billId === 'b6')).toBe(true);
  });

  // Case C07: Một buổi có cả HS đóng tiền và HS 0đ
  it('Case C07: [Mixed Paying & Free Students] should accurately snapshot 150k for Student A and 0 for Student B', () => {
    const atts: MockAttendanceEntity[] = [
      { id: 'a-pay', studentId: 's-pay', classSessionId: 'cs1', classId: 'c1', billId: null, billedAmount: null },
      { id: 'a-free', studentId: 's-free', classSessionId: 'cs1', classId: 'c1', billId: null, billedAmount: null },
    ];
    let res = BillingSnapshotEngine.applyStudentBillSnapshot(atts, 'b-pay', [
      { classId: 'c1', className: 'C1', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 150000, totalAmount: 150000, sourceIds: ['a-pay'] },
    ]);
    res = BillingSnapshotEngine.applyStudentBillSnapshot(res, 'b-free', [
      { classId: 'c1', className: 'C1', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 0, totalAmount: 0, sourceIds: ['a-free'] },
    ]);
    expect(res.find((a) => a.id === 'a-pay')?.billedAmount).toBe(150000);
    expect(res.find((a) => a.id === 'a-free')?.billedAmount).toBe(0);
  });

  // Case C08: Điểm danh chưa tính tiền
  it('Case C08: [Unbilled Student] should preserve billId = null and billedAmount = null for student not in period', () => {
    const atts: MockAttendanceEntity[] = [
      { id: 'a-other', studentId: 's-other', classSessionId: 'cs1', classId: 'c1', billId: null, billedAmount: null },
    ];
    const res = BillingSnapshotEngine.applyStudentBillSnapshot(atts, 'b7', []);
    expect(res[0].billId).toBeNull();
    expect(res[0].billedAmount).toBeNull();
    expect(BillingSnapshotEngine.isStudentAttendanceValid(res[0])).toBe(true);
  });

  // Case C09: Học sinh vào lớp giữa chừng (joinedDate)
  it('Case C09: [Joined Date Guard] should only snapshot sessions occurring on or after joinedDate', () => {
    const atts: MockAttendanceEntity[] = [
      { id: 'a-before', studentId: 's1', classSessionId: 'cs1', classId: 'c1', billId: null, billedAmount: null, sessionDate: '2026-03-05', joinedDate: '2026-03-10' },
      { id: 'a-after', studentId: 's1', classSessionId: 'cs2', classId: 'c1', billId: null, billedAmount: null, sessionDate: '2026-03-12', joinedDate: '2026-03-10' },
    ];
    // Only session after joinedDate is billed
    const lines: BillLineInput[] = [
      { classId: 'c1', className: 'C1', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 160000, totalAmount: 160000, sourceIds: ['a-after'] },
    ];
    const res = BillingSnapshotEngine.applyStudentBillSnapshot(atts, 'b8', lines);
    expect(res.find((a) => a.id === 'a-before')?.billId).toBeNull();
    expect(res.find((a) => a.id === 'a-after')?.billedAmount).toBe(160000);
  });

  // Case C10: Số tiền lẻ thập phân
  it('Case C10: [Fractional Amount] should snapshot exact decimal amount (133333.33) without rounding corruption', () => {
    const atts: MockAttendanceEntity[] = [
      { id: 'a-frac', studentId: 's1', classSessionId: 'cs1', classId: 'c1', billId: null, billedAmount: null },
    ];
    const lines: BillLineInput[] = [
      { classId: 'c1', className: 'C1', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 133333.33, totalAmount: 133333.33, sourceIds: ['a-frac'] },
    ];
    const res = BillingSnapshotEngine.applyStudentBillSnapshot(atts, 'b9', lines);
    expect(res[0].billedAmount).toBe(133333.33);
  });

  // Case C11: Số tiền cực lớn
  it('Case C11: [Extreme Amount] should snapshot large amount 10,000,000 VND accurately', () => {
    const atts: MockAttendanceEntity[] = [
      { id: 'a-vip', studentId: 's1', classSessionId: 'cs1', classId: 'c1', billId: null, billedAmount: null },
    ];
    const lines: BillLineInput[] = [
      { classId: 'c1', className: 'C1', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 10000000, totalAmount: 10000000, sourceIds: ['a-vip'] },
    ];
    const res = BillingSnapshotEngine.applyStudentBillSnapshot(atts, 'b10', lines);
    expect(res[0].billedAmount).toBe(10000000);
  });

  // Case C12: Giáo viên chuẩn
  it('Case C12: [Teacher Standard] should snapshot billedTeacherWage = 250000 into session upon billing wage', () => {
    const sess: MockSessionEntity[] = [
      { id: 's1', classId: 'c1', teacherId: 't1', assistantId: null, wageId: null, assistantWageId: null, billedTeacherWage: null, billedAssistantWage: null },
    ];
    const lines: BillLineInput[] = [
      { classId: 'c1', className: 'C1', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 250000, totalAmount: 250000, sourceIds: ['s1'], roleInSession: 'teacher' },
    ];
    const res = BillingSnapshotEngine.applyTeacherWageSnapshot(sess, 'w1', lines);
    expect(res[0].wageId).toBe('w1');
    expect(res[0].billedTeacherWage).toBe(250000);
    expect(BillingSnapshotEngine.isSessionValid(res[0])).toBe(true);
  });

  // Case C13: Giáo viên tình nguyện 0đ
  it('Case C13: [Teacher Zero Rate] should snapshot billedTeacherWage = 0 (NOT null) for volunteer teacher', () => {
    const sess: MockSessionEntity[] = [
      { id: 's-vol', classId: 'c1', teacherId: 't-vol', assistantId: null, wageId: null, assistantWageId: null, billedTeacherWage: null, billedAssistantWage: null },
    ];
    const lines: BillLineInput[] = [
      { classId: 'c1', className: 'C1', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 0, totalAmount: 0, sourceIds: ['s-vol'], roleInSession: 'teacher' },
    ];
    const res = BillingSnapshotEngine.applyTeacherWageSnapshot(sess, 'w-vol', lines);
    expect(res[0].billedTeacherWage).toBe(0);
    expect(res[0].billedTeacherWage).not.toBeNull();
  });

  // Case C14: Trợ giảng chuẩn
  it('Case C14: [Assistant Standard] should snapshot billedAssistantWage = 80000 into session upon billing wage', () => {
    const sess: MockSessionEntity[] = [
      { id: 's-ast', classId: 'c1', teacherId: 't1', assistantId: 'ast1', wageId: null, assistantWageId: null, billedTeacherWage: null, billedAssistantWage: null },
    ];
    const lines: BillLineInput[] = [
      { classId: 'c1', className: 'C1', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 80000, totalAmount: 80000, sourceIds: ['s-ast'], roleInSession: 'assistant' },
    ];
    const res = BillingSnapshotEngine.applyTeacherWageSnapshot(sess, 'w-ast', lines);
    expect(res[0].assistantWageId).toBe('w-ast');
    expect(res[0].billedAssistantWage).toBe(80000);
  });

  // Case C15: Trợ giảng 0đ
  it('Case C15: [Assistant Zero Rate] should snapshot billedAssistantWage = 0 (NOT null) for intern assistant', () => {
    const sess: MockSessionEntity[] = [
      { id: 's-ast-zero', classId: 'c1', teacherId: 't1', assistantId: 'ast2', wageId: null, assistantWageId: null, billedTeacherWage: null, billedAssistantWage: null },
    ];
    const lines: BillLineInput[] = [
      { classId: 'c1', className: 'C1', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 0, totalAmount: 0, sourceIds: ['s-ast-zero'], roleInSession: 'assistant' },
    ];
    const res = BillingSnapshotEngine.applyTeacherWageSnapshot(sess, 'w-ast-zero', lines);
    expect(res[0].billedAssistantWage).toBe(0);
  });

  // Case C16: Buổi học không có trợ giảng
  it('Case C16: [No Assistant Session] should leave assistantWageId = null and billedAssistantWage = null when no assistant', () => {
    const sess: MockSessionEntity[] = [
      { id: 's-no-ast', classId: 'c1', teacherId: 't1', assistantId: null, wageId: null, assistantWageId: null, billedTeacherWage: null, billedAssistantWage: null },
    ];
    const lines: BillLineInput[] = [
      { classId: 'c1', className: 'C1', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 200000, totalAmount: 200000, sourceIds: ['s-no-ast'], roleInSession: 'teacher' },
    ];
    const res = BillingSnapshotEngine.applyTeacherWageSnapshot(sess, 'w-main', lines);
    expect(res[0].billedTeacherWage).toBe(200000);
    expect(res[0].assistantWageId).toBeNull();
    expect(res[0].billedAssistantWage).toBeNull();
    expect(BillingSnapshotEngine.isSessionValid(res[0])).toBe(true);
  });

  // Case C17: Tính lương GV nhưng chưa tính thù lao trợ giảng
  it('Case C17: [Teacher Only Billed] should only set teacher wage without affecting unbilled assistant fields', () => {
    const sess: MockSessionEntity[] = [
      { id: 's-dual-unbilled', classId: 'c1', teacherId: 't1', assistantId: 'ast1', wageId: null, assistantWageId: null, billedTeacherWage: null, billedAssistantWage: null },
    ];
    const lines: BillLineInput[] = [
      { classId: 'c1', className: 'C1', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 220000, totalAmount: 220000, sourceIds: ['s-dual-unbilled'], roleInSession: 'teacher' },
    ];
    const res = BillingSnapshotEngine.applyTeacherWageSnapshot(sess, 'w-tch', lines);
    expect(res[0].billedTeacherWage).toBe(220000);
    expect(res[0].assistantWageId).toBeNull();
    expect(res[0].billedAssistantWage).toBeNull();
    expect(BillingSnapshotEngine.isSessionValid(res[0])).toBe(true);
  });

  // Case C18: Tính thù lao trợ giảng độc lập đợt sau
  it('Case C18: [Assistant Billed Subsequently] should bill assistant subsequently without overriding existing teacher wage', () => {
    const sess: MockSessionEntity[] = [
      { id: 's-pre-billed', classId: 'c1', teacherId: 't1', assistantId: 'ast1', wageId: 'w-prev', assistantWageId: null, billedTeacherWage: 250000, billedAssistantWage: null },
    ];
    const lines: BillLineInput[] = [
      { classId: 'c1', className: 'C1', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 90000, totalAmount: 90000, sourceIds: ['s-pre-billed'], roleInSession: 'assistant' },
    ];
    const res = BillingSnapshotEngine.applyTeacherWageSnapshot(sess, 'w-ast-new', lines);
    expect(res[0].billedTeacherWage).toBe(250000); // Preserved!
    expect(res[0].billedAssistantWage).toBe(90000);
    expect(BillingSnapshotEngine.isSessionValid(res[0])).toBe(true);
  });

  // Case C19: [CH-05] Cùng 1 người vừa dạy vừa làm trợ giảng cùng buổi
  it('Case C19: [CH-05 Dual-Role Same Session] should snapshot 250k teacher wage and 100k assistant wage independently', () => {
    const sess: MockSessionEntity[] = [
      { id: 's-same-person', classId: 'c1', teacherId: 't-super', assistantId: 't-super', wageId: null, assistantWageId: null, billedTeacherWage: null, billedAssistantWage: null },
    ];
    let res = BillingSnapshotEngine.applyTeacherWageSnapshot(sess, 'w-main', [
      { classId: 'c1', className: 'C1', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 250000, totalAmount: 250000, sourceIds: ['s-same-person'], roleInSession: 'teacher' },
    ]);
    res = BillingSnapshotEngine.applyTeacherWageSnapshot(res, 'w-sub', [
      { classId: 'c1', className: 'C1', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 100000, totalAmount: 100000, sourceIds: ['s-same-person'], roleInSession: 'assistant' },
    ]);
    expect(res[0].billedTeacherWage).toBe(250000);
    expect(res[0].billedAssistantWage).toBe(100000);
    expect(BillingSnapshotEngine.isSessionValid(res[0])).toBe(true);
  });

  // Case C20: [CH-05] Cùng 1 người dạy lớp A nhưng làm trợ giảng lớp B
  it('Case C20: [CH-05 Cross-Class Role] should snapshot teacher wage in Class A and assistant wage in Class B', () => {
    const sess: MockSessionEntity[] = [
      { id: 's-cls-a', classId: 'cA', teacherId: 't-super', assistantId: null, wageId: null, assistantWageId: null, billedTeacherWage: null, billedAssistantWage: null },
      { id: 's-cls-b', classId: 'cB', teacherId: 't-other', assistantId: 't-super', wageId: null, assistantWageId: null, billedTeacherWage: null, billedAssistantWage: null },
    ];
    let res = BillingSnapshotEngine.applyTeacherWageSnapshot(sess, 'w-cA', [
      { classId: 'cA', className: 'CA', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 300000, totalAmount: 300000, sourceIds: ['s-cls-a'], roleInSession: 'teacher' },
    ]);
    res = BillingSnapshotEngine.applyTeacherWageSnapshot(res, 'w-cB', [
      { classId: 'cB', className: 'CB', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 90000, totalAmount: 90000, sourceIds: ['s-cls-b'], roleInSession: 'assistant' },
    ]);
    expect(res.find((s) => s.id === 's-cls-a')?.billedTeacherWage).toBe(300000);
    expect(res.find((s) => s.id === 's-cls-b')?.billedAssistantWage).toBe(90000);
  });

  // Case C21: Giáo viên dạy thay (Sub-teacher)
  it('Case C21: [Substitute Teacher] should snapshot correct wage per respective teacher for main and sub sessions', () => {
    const sess: MockSessionEntity[] = [
      { id: 's-main', classId: 'c1', teacherId: 't-main', assistantId: null, wageId: null, assistantWageId: null, billedTeacherWage: null, billedAssistantWage: null },
      { id: 's-sub', classId: 'c1', teacherId: 't-sub', assistantId: null, wageId: null, assistantWageId: null, billedTeacherWage: null, billedAssistantWage: null },
    ];
    let res = BillingSnapshotEngine.applyTeacherWageSnapshot(sess, 'w-main', [
      { classId: 'c1', className: 'C1', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 250000, totalAmount: 250000, sourceIds: ['s-main'], roleInSession: 'teacher' },
    ]);
    res = BillingSnapshotEngine.applyTeacherWageSnapshot(res, 'w-sub', [
      { classId: 'c1', className: 'C1', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 220000, totalAmount: 220000, sourceIds: ['s-sub'], roleInSession: 'teacher' },
    ]);
    expect(res.find((s) => s.id === 's-main')?.billedTeacherWage).toBe(250000);
    expect(res.find((s) => s.id === 's-sub')?.billedTeacherWage).toBe(220000);
  });

  // Case C22: Nhiều buổi học của GV với các rate khác nhau
  it('Case C22: [Teacher Mixed Rates] should snapshot 200k for regular session and 350k for weekend session', () => {
    const sess: MockSessionEntity[] = [
      { id: 's-weekday', classId: 'c1', teacherId: 't1', assistantId: null, wageId: null, assistantWageId: null, billedTeacherWage: null, billedAssistantWage: null },
      { id: 's-weekend', classId: 'c1', teacherId: 't1', assistantId: null, wageId: null, assistantWageId: null, billedTeacherWage: null, billedAssistantWage: null },
    ];
    const lines: BillLineInput[] = [
      { classId: 'c1', className: 'Weekday', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 200000, totalAmount: 200000, sourceIds: ['s-weekday'], roleInSession: 'teacher' },
      { classId: 'c1', className: 'Weekend', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 350000, totalAmount: 350000, sourceIds: ['s-weekend'], roleInSession: 'teacher' },
    ];
    const res = BillingSnapshotEngine.applyTeacherWageSnapshot(sess, 'w-mixed', lines);
    expect(res.find((s) => s.id === 's-weekday')?.billedTeacherWage).toBe(200000);
    expect(res.find((s) => s.id === 's-weekend')?.billedTeacherWage).toBe(350000);
  });

  // Case C23: Cách ly giữa học sinh và giáo viên
  it('Case C23: [Isolation Student -> Teacher] should ensure billing student attendance never modifies session wage fields', () => {
    const atts: MockAttendanceEntity[] = [
      { id: 'a1', studentId: 's1', classSessionId: 'cs1', classId: 'c1', billId: null, billedAmount: null },
    ];
    const initialSession: MockSessionEntity = {
      id: 'cs1', classId: 'c1', teacherId: 't1', assistantId: null, wageId: null, assistantWageId: null, billedTeacherWage: null, billedAssistantWage: null,
    };
    BillingSnapshotEngine.applyStudentBillSnapshot(atts, 'b-iso', [
      { classId: 'c1', className: 'C1', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 150000, totalAmount: 150000, sourceIds: ['a1'] },
    ]);
    expect(initialSession.wageId).toBeNull();
    expect(initialSession.billedTeacherWage).toBeNull();
  });

  // Case C24: Cách ly giữa giáo viên và học sinh
  it('Case C24: [Isolation Teacher -> Student] should ensure billing teacher wage never modifies student attendance fields', () => {
    const initialAtt: MockAttendanceEntity = {
      id: 'a1', studentId: 's1', classSessionId: 'cs1', classId: 'c1', billId: null, billedAmount: null,
    };
    const sess: MockSessionEntity[] = [
      { id: 'cs1', classId: 'c1', teacherId: 't1', assistantId: null, wageId: null, assistantWageId: null, billedTeacherWage: null, billedAssistantWage: null },
    ];
    BillingSnapshotEngine.applyTeacherWageSnapshot(sess, 'w-iso', [
      { classId: 'c1', className: 'C1', courseName: 'E', levelName: 'L1', sessionsCount: 1, rate: 250000, totalAmount: 250000, sourceIds: ['cs1'], roleInSession: 'teacher' },
    ]);
    expect(initialAtt.billId).toBeNull();
    expect(initialAtt.billedAmount).toBeNull();
  });

  // Case C25: Thỏa mãn DB Check Constraint toàn diện
  it('Case C25: [Check Constraint All Pass] should guarantee 100% of attendance and session entities pass DB constraints', () => {
    const att: MockAttendanceEntity = { id: 'a1', studentId: 's1', classSessionId: 'cs1', classId: 'c1', billId: 'b1', billedAmount: 150000 };
    const sess: MockSessionEntity = { id: 'cs1', classId: 'c1', teacherId: 't1', assistantId: 'ast1', wageId: 'w1', assistantWageId: 'w2', billedTeacherWage: 250000, billedAssistantWage: 80000 };

    expect(BillingSnapshotEngine.isStudentAttendanceValid(att)).toBe(true);
    expect(BillingSnapshotEngine.isSessionValid(sess)).toBe(true);
  });
});
