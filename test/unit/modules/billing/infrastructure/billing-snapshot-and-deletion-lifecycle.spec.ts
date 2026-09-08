/**
 * Billing Snapshot & Deletion Lifecycle Test Suite
 * Kiểm thử vòng đời:
 * 1. Khi tính tiền: BẮT BUỘC lưu bill_id/wage_id VÀ snapshot số tiền (billed_amount, billed_teacher_wage, billed_assistant_wage)
 * 2. Khi xóa đợt thu: BẮT BUỘC xóa cả bill_id/wage_id VÀ gỡ tiền về null
 * 3. Bảo toàn 100% tính toàn vẹn DB CHECK Constraint
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

export class BillingLifecycleService {
  /**
   * Lưu snapshot tiền khi tạo hóa đơn học sinh (Create Student Bill)
   */
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
            billedAmount: line.rate, // Snapshot bất biến
          };
        }
      }
    }
    return updated;
  }

  /**
   * Lưu snapshot thù lao khi tạo bảng lương GV / Trợ giảng (Create Teacher Wage)
   */
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

  /**
   * Xóa đợt thu học phí: Gỡ cả billId và billedAmount về null
   */
  static deleteTuitionPeriod(
    attendances: MockAttendanceEntity[],
    billIdsToDelete: string[],
  ): MockAttendanceEntity[] {
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

  /**
   * Xóa đợt lương giáo viên/trợ giảng: Gỡ cả wageId/assistantWageId và tiền về null
   */
  static deleteSalaryPeriod(
    sessions: MockSessionEntity[],
    wageIdsToDelete: string[],
  ): MockSessionEntity[] {
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

  /**
   * Reset yêu cầu thanh toán (Hủy bill đơn lẻ)
   */
  static resetSinglePaymentRequest(
    attendances: MockAttendanceEntity[],
    billId: string,
  ): MockAttendanceEntity[] {
    return attendances.map((att) => {
      if (att.billId === billId) {
        return {
          ...att,
          billId: null,
          billedAmount: null, // BẮT BUỘC gỡ về null
        };
      }
      return att;
    });
  }

  /**
   * Kiểm tra DB Check Constraint cho Student Attendance
   */
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

  /**
   * Kiểm tra DB Check Constraint cho Class Session
   */
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

describe('Billing Snapshot & Deletion Lifecycle Test Suite (15 Cases)', () => {
  describe('Group A: Tính tiền - Phải lưu bill_id và snapshot tiền vào bảng điểm danh / buổi học (Cases L01 - L07)', () => {
    // Case L01: Học sinh bình thường
    it('Case L01: should save both billId and billedAmount (150,000đ) into student attendance upon billing', () => {
      const attendances: MockAttendanceEntity[] = [
        { id: 'att-1', studentId: 'std-1', classSessionId: 'sess-1', billId: null, billedAmount: null },
      ];
      const lines: BillLineInput[] = [
        {
          classId: 'c1',
          className: 'English 1',
          courseName: 'Eng',
          levelName: 'A1',
          sessionsCount: 1,
          rate: 150000,
          totalAmount: 150000,
          sourceIds: ['att-1'],
        },
      ];

      const result = BillingLifecycleService.applyStudentBillSnapshot(attendances, 'bill-1', lines);
      expect(result[0].billId).toBe('bill-1');
      expect(result[0].billedAmount).toBe(150000);
      expect(BillingLifecycleService.isStudentAttendanceValid(result[0])).toBe(true);
    });

    // Case L02: Học bổng 100% / miễn phí (rate = 0)
    it('Case L02: should save billedAmount = 0 (NOT null) when student tuition rate is 0 (100% scholarship)', () => {
      const attendances: MockAttendanceEntity[] = [
        { id: 'att-2', studentId: 'std-free', classSessionId: 'sess-1', billId: null, billedAmount: null },
      ];
      const lines: BillLineInput[] = [
        {
          classId: 'c1',
          className: 'English Free',
          courseName: 'Eng',
          levelName: 'A1',
          sessionsCount: 1,
          rate: 0,
          totalAmount: 0,
          sourceIds: ['att-2'],
        },
      ];

      const result = BillingLifecycleService.applyStudentBillSnapshot(attendances, 'bill-2', lines);
      expect(result[0].billId).toBe('bill-2');
      expect(result[0].billedAmount).toBe(0);
      expect(result[0].billedAmount).not.toBeNull();
      expect(BillingLifecycleService.isStudentAttendanceValid(result[0])).toBe(true);
    });

    // Case L03: Nhiều buổi học với các mức rate khác nhau
    it('Case L03: should correctly snapshot different rates for different attendance sessions in same bill', () => {
      const attendances: MockAttendanceEntity[] = [
        { id: 'att-normal', studentId: 'std-1', classSessionId: 'sess-1', billId: null, billedAmount: null },
        { id: 'att-workshop', studentId: 'std-1', classSessionId: 'sess-2', billId: null, billedAmount: null },
      ];
      const lines: BillLineInput[] = [
        {
          classId: 'c1',
          className: 'Standard',
          courseName: 'Eng',
          levelName: 'A1',
          sessionsCount: 1,
          rate: 150000,
          totalAmount: 150000,
          sourceIds: ['att-normal'],
        },
        {
          classId: 'c2',
          className: 'Workshop',
          courseName: 'Eng',
          levelName: 'Advanced',
          sessionsCount: 1,
          rate: 300000,
          totalAmount: 300000,
          sourceIds: ['att-workshop'],
        },
      ];

      const result = BillingLifecycleService.applyStudentBillSnapshot(attendances, 'bill-multi', lines);
      expect(result[0].billedAmount).toBe(150000);
      expect(result[1].billedAmount).toBe(300000);
      expect(result.every(BillingLifecycleService.isStudentAttendanceValid)).toBe(true);
    });

    // Case L04: Giáo viên bình thường
    it('Case L04: should save both wageId and billedTeacherWage (250,000đ) into class session', () => {
      const sessions: MockSessionEntity[] = [
        {
          id: 'sess-1',
          classId: 'c1',
          teacherId: 'tch-1',
          assistantId: null,
          wageId: null,
          assistantWageId: null,
          billedTeacherWage: null,
          billedAssistantWage: null,
        },
      ];
      const lines: BillLineInput[] = [
        {
          classId: 'c1',
          className: 'Eng',
          courseName: 'Eng',
          levelName: 'A1',
          sessionsCount: 1,
          rate: 250000,
          totalAmount: 250000,
          sourceIds: ['sess-1'],
          roleInSession: 'teacher',
        },
      ];

      const result = BillingLifecycleService.applyTeacherWageSnapshot(sessions, 'wage-1', lines);
      expect(result[0].wageId).toBe('wage-1');
      expect(result[0].billedTeacherWage).toBe(250000);
      expect(BillingLifecycleService.isSessionValid(result[0])).toBe(true);
    });

    // Case L05: Trợ giảng bình thường
    it('Case L05: should save assistantWageId and billedAssistantWage (80,000đ) into class session', () => {
      const sessions: MockSessionEntity[] = [
        {
          id: 'sess-1',
          classId: 'c1',
          teacherId: 'tch-1',
          assistantId: 'ast-1',
          wageId: null,
          assistantWageId: null,
          billedTeacherWage: null,
          billedAssistantWage: null,
        },
      ];
      const lines: BillLineInput[] = [
        {
          classId: 'c1',
          className: 'Eng',
          courseName: 'Eng',
          levelName: 'A1',
          sessionsCount: 1,
          rate: 80000,
          totalAmount: 80000,
          sourceIds: ['sess-1'],
          roleInSession: 'assistant',
        },
      ];

      const result = BillingLifecycleService.applyTeacherWageSnapshot(sessions, 'wage-ast-1', lines);
      expect(result[0].assistantWageId).toBe('wage-ast-1');
      expect(result[0].billedAssistantWage).toBe(80000);
      expect(BillingLifecycleService.isSessionValid(result[0])).toBe(true);
    });

    // Case L06: GV tình nguyện 0đ
    it('Case L06: should save billedTeacherWage = 0 (NOT null) when volunteer teacher rate is 0', () => {
      const sessions: MockSessionEntity[] = [
        {
          id: 'sess-vol',
          classId: 'c1',
          teacherId: 'tch-vol',
          assistantId: null,
          wageId: null,
          assistantWageId: null,
          billedTeacherWage: null,
          billedAssistantWage: null,
        },
      ];
      const lines: BillLineInput[] = [
        {
          classId: 'c1',
          className: 'Eng',
          courseName: 'Eng',
          levelName: 'A1',
          sessionsCount: 1,
          rate: 0,
          totalAmount: 0,
          sourceIds: ['sess-vol'],
          roleInSession: 'teacher',
        },
      ];

      const result = BillingLifecycleService.applyTeacherWageSnapshot(sessions, 'wage-vol', lines);
      expect(result[0].billedTeacherWage).toBe(0);
      expect(result[0].billedTeacherWage).not.toBeNull();
      expect(BillingLifecycleService.isSessionValid(result[0])).toBe(true);
    });

    // Case L07: [CH-05] GV kiêm Trợ giảng trong cùng 1 buổi học
    it('Case L07: [CH-05] should independently snapshot both teacher and assistant wages when teacher acts in dual-role', () => {
      const sessions: MockSessionEntity[] = [
        {
          id: 'sess-dual',
          classId: 'c1',
          teacherId: 'tch-dual',
          assistantId: 'tch-dual',
          wageId: null,
          assistantWageId: null,
          billedTeacherWage: null,
          billedAssistantWage: null,
        },
      ];
      const teacherLine: BillLineInput = {
        classId: 'c1',
        className: 'Eng',
        courseName: 'Eng',
        levelName: 'A1',
        sessionsCount: 1,
        rate: 250000,
        totalAmount: 250000,
        sourceIds: ['sess-dual'],
        roleInSession: 'teacher',
      };
      const assistantLine: BillLineInput = {
        classId: 'c1',
        className: 'Eng',
        courseName: 'Eng',
        levelName: 'A1',
        sessionsCount: 1,
        rate: 100000,
        totalAmount: 100000,
        sourceIds: ['sess-dual'],
        roleInSession: 'assistant',
      };

      let result = BillingLifecycleService.applyTeacherWageSnapshot(sessions, 'wage-main', [teacherLine]);
      result = BillingLifecycleService.applyTeacherWageSnapshot(result, 'wage-sub', [assistantLine]);

      expect(result[0].billedTeacherWage).toBe(250000);
      expect(result[0].billedAssistantWage).toBe(100000);
      expect(BillingLifecycleService.isSessionValid(result[0])).toBe(true);
    });
  });

  describe('Group B: Xóa đợt thu - BẮT BUỘC xóa cả bill_id và gỡ số tiền về null (Cases L08 - L13)', () => {
    // Case L08: Xóa đợt thu học phí
    it('Case L08: should reset both billId = null AND billedAmount = null when payment period is deleted', () => {
      const billedAttendances: MockAttendanceEntity[] = [
        { id: 'att-1', studentId: 's1', classSessionId: 'cs1', billId: 'bill-to-delete', billedAmount: 150000 },
        { id: 'att-2', studentId: 's2', classSessionId: 'cs1', billId: 'bill-stay', billedAmount: 150000 },
      ];

      const result = BillingLifecycleService.deleteTuitionPeriod(billedAttendances, ['bill-to-delete']);
      expect(result[0].billId).toBeNull();
      expect(result[0].billedAmount).toBeNull(); // BẮT BUỘC = null
      expect(result[1].billId).toBe('bill-stay');
      expect(result[1].billedAmount).toBe(150000); // Bản ghi khác giữ nguyên
      expect(result.every(BillingLifecycleService.isStudentAttendanceValid)).toBe(true);
    });

    // Case L09: Xóa đợt thu có học bổng 0đ
    it('Case L09: should reset billedAmount from 0 to null when payment period is deleted', () => {
      const billedAttendances: MockAttendanceEntity[] = [
        { id: 'att-free', studentId: 's1', classSessionId: 'cs1', billId: 'bill-free-del', billedAmount: 0 },
      ];

      const result = BillingLifecycleService.deleteTuitionPeriod(billedAttendances, ['bill-free-del']);
      expect(result[0].billId).toBeNull();
      expect(result[0].billedAmount).toBeNull();
      expect(BillingLifecycleService.isStudentAttendanceValid(result[0])).toBe(true);
    });

    // Case L10: Xóa đợt lương GV
    it('Case L10: should reset both wageId = null AND billedTeacherWage = null when salary period is deleted', () => {
      const billedSessions: MockSessionEntity[] = [
        {
          id: 'sess-1',
          classId: 'c1',
          teacherId: 't1',
          assistantId: null,
          wageId: 'wage-to-del',
          assistantWageId: null,
          billedTeacherWage: 200000,
          billedAssistantWage: null,
        },
      ];

      const result = BillingLifecycleService.deleteSalaryPeriod(billedSessions, ['wage-to-del']);
      expect(result[0].wageId).toBeNull();
      expect(result[0].billedTeacherWage).toBeNull();
      expect(BillingLifecycleService.isSessionValid(result[0])).toBe(true);
    });

    // Case L11: Xóa đợt lương trợ giảng
    it('Case L11: should reset assistantWageId = null AND billedAssistantWage = null when salary period is deleted', () => {
      const billedSessions: MockSessionEntity[] = [
        {
          id: 'sess-1',
          classId: 'c1',
          teacherId: 't1',
          assistantId: 'a1',
          wageId: null,
          assistantWageId: 'wage-ast-del',
          billedTeacherWage: null,
          billedAssistantWage: 80000,
        },
      ];

      const result = BillingLifecycleService.deleteSalaryPeriod(billedSessions, ['wage-ast-del']);
      expect(result[0].assistantWageId).toBeNull();
      expect(result[0].billedAssistantWage).toBeNull();
      expect(BillingLifecycleService.isSessionValid(result[0])).toBe(true);
    });

    // Case L12: Reset yêu cầu thanh toán (Hủy bill đơn lẻ)
    it('Case L12: should reset both billId = null and billedAmount = null when resetPaymentRequest is called', () => {
      const attendances: MockAttendanceEntity[] = [
        { id: 'att-single', studentId: 's1', classSessionId: 'cs1', billId: 'bill-req-1', billedAmount: 180000 },
      ];

      const result = BillingLifecycleService.resetSinglePaymentRequest(attendances, 'bill-req-1');
      expect(result[0].billId).toBeNull();
      expect(result[0].billedAmount).toBeNull();
      expect(BillingLifecycleService.isStudentAttendanceValid(result[0])).toBe(true);
    });

    // Case L13: Trở về trạng thái Unbilled an toàn để tính lại đợt sau
    it('Case L13: should allow re-billing with new rate after period is deleted and reset to null', () => {
      // 1. Ban đầu đã tính với rate cũ 150,000đ
      let attendances: MockAttendanceEntity[] = [
        { id: 'att-re', studentId: 's1', classSessionId: 'cs1', billId: 'bill-old', billedAmount: 150000 },
      ];

      // 2. Xóa đợt thu cũ
      attendances = BillingLifecycleService.deleteTuitionPeriod(attendances, ['bill-old']);
      expect(attendances[0].billId).toBeNull();
      expect(attendances[0].billedAmount).toBeNull();

      // 3. Tính lại đợt mới với bảng giá mới 180,000đ
      const newLines: BillLineInput[] = [
        {
          classId: 'c1',
          className: 'Eng',
          courseName: 'Eng',
          levelName: 'A1',
          sessionsCount: 1,
          rate: 180000,
          totalAmount: 180000,
          sourceIds: ['att-re'],
        },
      ];
      attendances = BillingLifecycleService.applyStudentBillSnapshot(attendances, 'bill-new', newLines);
      expect(attendances[0].billId).toBe('bill-new');
      expect(attendances[0].billedAmount).toBe(180000); // Cập nhật đúng giá mới của đợt mới
      expect(BillingLifecycleService.isStudentAttendanceValid(attendances[0])).toBe(true);
    });
  });

  describe('Group C: Rào chắn DB Check Constraint ngăn chặn lỗi code sót (Cases L14 - L15)', () => {
    // Case L14: Lỗi xóa bill_id nhưng quên xóa billed_amount
    it('Case L14: should FAIL check constraint if legacy code deletes billId but forgets to set billedAmount to null', () => {
      const buggedRow: MockAttendanceEntity = {
        id: 'att-bug-1',
        studentId: 's1',
        classSessionId: 'cs1',
        billId: null, // Đã xóa billId
        billedAmount: 150000, // Nhưng quên xóa tiền!
      };
      // Vi phạm DB CHECK constraint!
      expect(BillingLifecycleService.isStudentAttendanceValid(buggedRow)).toBe(false);
    });

    // Case L15: Lỗi tạo bill_id nhưng quên lưu billed_amount
    it('Case L15: should FAIL check constraint if legacy code assigns billId but leaves billedAmount null', () => {
      const buggedRow: MockAttendanceEntity = {
        id: 'att-bug-2',
        studentId: 's1',
        classSessionId: 'cs1',
        billId: 'bill-99', // Có billId
        billedAmount: null, // Nhưng quên lưu tiền snapshot!
      };
      // Vi phạm DB CHECK constraint!
      expect(BillingLifecycleService.isStudentAttendanceValid(buggedRow)).toBe(false);
    });
  });
});
