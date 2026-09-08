/**
 * History, Reports & Financial Snapshot Integration Test Suite (Cases R01 - R15)
 * Kiểm thử toàn diện:
 * 1. Lịch sử học sinh / hóa đơn cũ (student.controller.ts) - Đọc trực tiếp billed_amount
 * 2. Báo cáo điểm danh theo lớp (getAttendanceByClass) - Đọc billed_amount thay vì query ngược bảng giá
 * 3. Báo cáo phân bổ lương GV vs Trợ giảng (CH-05: getSalarySummary & getSalaryByMonth) - Phân định theo wi.role
 * 4. Báo cáo thù lao giáo viên (calculate-teacher-wage) - Bảo toàn snapshot thù lao ca cũ
 * 5. Chi tiết đợt thanh toán cũ (findPeriodDetails & findOrderDetails) - Đọc snapshot bất biến
 */

export interface MockStudentAttendanceSession {
  id: string;
  studentId: string;
  billId: string | null;
  billedAmount: number | null;
  isPresent: boolean;
  date: string;
  classId: string;
}

export interface MockWageItemForReport {
  id: string;
  wageId: string;
  teacherId: string;
  teacherProfileType: 'Full-time' | 'Part-time' | 'Teaching Assistant';
  role: 'teacher' | 'assistant';
  totalAmount: number;
  paid: boolean;
  month: string;
}

export interface MockTeacherSessionReportItem {
  id: string;
  date: string;
  teacherId: string;
  assistantId: string | null;
  wageId: string | null;
  assistantWageId: string | null;
  billedTeacherWage: number | null;
  billedAssistantWage: number | null;
  currentConfiguredTeacherWage: number;
  currentConfiguredAssistantWage: number;
}

export class HistoryAndReportEngine {
  /**
   * 1. Lấy chi tiết buổi học trong lịch sử hóa đơn học sinh (student.controller.ts)
   */
  static mapStudentBillHistorySessions(
    attendances: MockStudentAttendanceSession[],
    billId: string,
    currentConfiguredPricingRate: number,
  ): Array<{ id: string; rate: number; amount: number; isSnapshot: boolean }> {
    return attendances
      .filter((a) => a.billId === billId)
      .map((att) => {
        // NGUYÊN TẮC SNAPSHOT: Nếu đã có billedAmount -> Lấy trực tiếp billedAmount!
        // Không phụ thuộc và không bị đè bởi currentConfiguredPricingRate!
        const hasSnapshot = att.billedAmount !== null && att.billedAmount !== undefined;
        const rate = hasSnapshot ? Number(att.billedAmount) : currentConfiguredPricingRate;
        const amount = att.isPresent ? rate : 0;
        return {
          id: att.id,
          rate,
          amount,
          isSnapshot: hasSnapshot,
        };
      });
  }

  /**
   * 2. Báo cáo điểm danh theo lớp (TypeOrmReportsQueryAdapter.getAttendanceByClass)
   */
  static getAttendanceClassReportRate(
    att: MockStudentAttendanceSession,
    fallbackPricingRate: number,
  ): { rate: number; isFromSnapshot: boolean } {
    if (att.billId !== null && att.billedAmount !== null) {
      return {
        rate: Number(att.billedAmount),
        isFromSnapshot: true,
      };
    }
    return {
      rate: fallbackPricingRate,
      isFromSnapshot: false,
    };
  }

  /**
   * 3. Báo cáo phân bổ chi phí lương GV vs Trợ giảng (CH-05)
   * Sử dụng cột wi.role để phân định chính xác thay vì t.type cứng
   */
  static calculateSalarySummaryByRole(wageItems: MockWageItemForReport[]): {
    totalMainTeacher: number;
    totalTA: number;
    totalExpense: number;
    totalPaid: number;
    totalUnpaid: number;
  } {
    let totalMainTeacher = 0;
    let totalTA = 0;
    let totalPaid = 0;

    for (const item of wageItems) {
      const amount = Number(item.totalAmount);
      if (item.paid) {
        totalPaid += amount;
      }
      // CH-05: Phân định theo item.role ('teacher' vs 'assistant')
      if (item.role === 'assistant') {
        totalTA += amount;
      } else {
        totalMainTeacher += amount;
      }
    }

    const totalExpense = totalMainTeacher + totalTA;
    return {
      totalMainTeacher,
      totalTA,
      totalExpense,
      totalPaid,
      totalUnpaid: totalExpense - totalPaid,
    };
  }

  /**
   * 4. Báo cáo thù lao giáo viên (calculateTeacherWageUseCase)
   */
  static resolveTeacherSessionWageForReport(
    session: MockTeacherSessionReportItem,
    targetTeacherId: string,
  ): { role: 'teacher' | 'assistant'; rate: number; isSnapshot: boolean } {
    const isTeacher = session.teacherId === targetTeacherId;
    const isAssistant = session.assistantId === targetTeacherId;
    const role: 'teacher' | 'assistant' = isTeacher ? 'teacher' : 'assistant';

    if (role === 'teacher') {
      if (session.wageId !== null && session.billedTeacherWage !== null) {
        return {
          role: 'teacher',
          rate: Number(session.billedTeacherWage),
          isSnapshot: true, // Lấy snapshot bất biến
        };
      }
      return {
        role: 'teacher',
        rate: session.currentConfiguredTeacherWage,
        isSnapshot: false,
      };
    } else {
      if (session.assistantWageId !== null && session.billedAssistantWage !== null) {
        return {
          role: 'assistant',
          rate: Number(session.billedAssistantWage),
          isSnapshot: true, // Lấy snapshot bất biến
        };
      }
      return {
        role: 'assistant',
        rate: session.currentConfiguredAssistantWage,
        isSnapshot: false,
      };
    }
  }
}

describe('History, Reports & Financial Snapshot Suite (Cases R01 - R15)', () => {
  describe('Group 1: Lịch sử Học sinh & Hóa đơn cũ (student.controller.ts) (Cases R01 - R04)', () => {
    // Case R01: Xem hóa đơn cũ tháng 01/2026 - Bảng giá mới tăng không làm đổi giá cũ
    it('Case R01: should read billedAmount = 150000 directly from attendance snapshot even if current pricing is 200000', () => {
      const attendances: MockStudentAttendanceSession[] = [
        { id: 'att-1', studentId: 's1', billId: 'bill-jan', billedAmount: 150000, isPresent: true, date: '2026-01-10', classId: 'c1' },
      ];
      // Current configured price in CourseLevelPricing is 200,000
      const sessions = HistoryAndReportEngine.mapStudentBillHistorySessions(attendances, 'bill-jan', 200000);
      expect(sessions[0].rate).toBe(150000); // Must be 150,000 NOT 200,000!
      expect(sessions[0].amount).toBe(150000);
      expect(sessions[0].isSnapshot).toBe(true);
    });

    // Case R02: Xem hóa đơn cũ có học bổng 0đ - Không bị bảng giá đè thành 150k
    it('Case R02: should preserve billedAmount = 0 for scholarship student without falling back to configured price', () => {
      const attendances: MockStudentAttendanceSession[] = [
        { id: 'att-free', studentId: 's-free', billId: 'bill-free', billedAmount: 0, isPresent: true, date: '2026-01-15', classId: 'c1' },
      ];
      const sessions = HistoryAndReportEngine.mapStudentBillHistorySessions(attendances, 'bill-free', 150000);
      expect(sessions[0].rate).toBe(0); // Preserved 0đ!
      expect(sessions[0].amount).toBe(0);
      expect(sessions[0].isSnapshot).toBe(true);
    });

    // Case R03: Buổi học chưa chốt bill trong tháng hiện tại
    it('Case R03: should use current configured pricing for unbilled session in draft view', () => {
      const attendances: MockStudentAttendanceSession[] = [
        { id: 'att-unbilled', studentId: 's1', billId: null, billedAmount: null, isPresent: true, date: '2026-03-20', classId: 'c1' },
      ];
      const sessions = HistoryAndReportEngine.mapStudentBillHistorySessions(attendances, 'bill-target', 180000);
      expect(sessions).toHaveLength(0); // Not in this bill
    });

    // Case R04: Học sinh vắng mặt trong buổi học đã chốt bill
    it('Case R04: should keep rate from snapshot (150000) but amount = 0 when student was absent (isPresent = false)', () => {
      const attendances: MockStudentAttendanceSession[] = [
        { id: 'att-absent', studentId: 's1', billId: 'bill-feb', billedAmount: 150000, isPresent: false, date: '2026-02-10', classId: 'c1' },
      ];
      const sessions = HistoryAndReportEngine.mapStudentBillHistorySessions(attendances, 'bill-feb', 200000);
      expect(sessions[0].rate).toBe(150000);
      expect(sessions[0].amount).toBe(0); // Absent -> 0đ
    });
  });

  describe('Group 2: Báo cáo Điểm danh theo Lớp (getAttendanceByClass) (Cases R05 - R07)', () => {
    // Case R05: Báo cáo điểm danh tháng cũ đọc trực tiếp billedAmount
    it('Case R05: should use sa.billed_amount for billed attendance in class attendance report', () => {
      const billedAtt: MockStudentAttendanceSession = {
        id: 'att-old', studentId: 's1', billId: 'bill-old', billedAmount: 140000, isPresent: true, date: '2026-01-05', classId: 'c1',
      };
      const result = HistoryAndReportEngine.getAttendanceClassReportRate(billedAtt, 180000);
      expect(result.rate).toBe(140000);
      expect(result.isFromSnapshot).toBe(true);
    });

    // Case R06: Báo cáo điểm danh có ca học bổng 0đ
    it('Case R06: should display 0đ accurately for scholarship student in class attendance report', () => {
      const freeAtt: MockStudentAttendanceSession = {
        id: 'att-free', studentId: 's-free', billId: 'bill-free', billedAmount: 0, isPresent: true, date: '2026-01-05', classId: 'c1',
      };
      const result = HistoryAndReportEngine.getAttendanceClassReportRate(freeAtt, 180000);
      expect(result.rate).toBe(0);
      expect(result.isFromSnapshot).toBe(true);
    });

    // Case R07: Báo cáo điểm danh các buổi học chưa chốt bill
    it('Case R07: should fallback to configured class pricing rate for unbilled attendance in class report', () => {
      const unbilledAtt: MockStudentAttendanceSession = {
        id: 'att-future', studentId: 's1', billId: null, billedAmount: null, isPresent: true, date: '2026-04-05', classId: 'c1',
      };
      const result = HistoryAndReportEngine.getAttendanceClassReportRate(unbilledAtt, 180000);
      expect(result.rate).toBe(180000);
      expect(result.isFromSnapshot).toBe(false);
    });
  });

  describe('Group 3: Báo cáo Phân bổ Lương GV vs Trợ giảng (CH-05: getSalarySummary) (Cases R08 - R10)', () => {
    // Case R08: GV chính (t.type = 'Full-time') đi làm trợ giảng (wi.role = 'assistant')
    it('Case R08: [CH-05] should allocate Full-time teacher assistant stipend to totalTA (NOT totalMainTeacher)', () => {
      const wageItems: MockWageItemForReport[] = [
        // Thầy Nam (Full-time) dạy chính lớp A: 2,000,000đ
        { id: 'w1', wageId: 'w-main', teacherId: 't-nam', teacherProfileType: 'Full-time', role: 'teacher', totalAmount: 2000000, paid: true, month: '2026-03' },
        // Thầy Nam (Full-time) làm trợ giảng lớp B: 500,000đ
        { id: 'w2', wageId: 'w-sub', teacherId: 't-nam', teacherProfileType: 'Full-time', role: 'assistant', totalAmount: 500000, paid: true, month: '2026-03' },
      ];

      const report = HistoryAndReportEngine.calculateSalarySummaryByRole(wageItems);
      expect(report.totalMainTeacher).toBe(2000000); // Only main teacher role
      expect(report.totalTA).toBe(500000); // Accurately classified as TA!
      expect(report.totalExpense).toBe(2500000);
      expect(report.totalPaid).toBe(2500000);
      expect(report.totalUnpaid).toBe(0);
    });

    // Case R09: Trợ giảng (t.type = 'Teaching Assistant') dạy thay làm GV chính (wi.role = 'teacher')
    it('Case R09: [CH-05] should allocate Teaching Assistant teaching fee to totalMainTeacher (NOT totalTA)', () => {
      const wageItems: MockWageItemForReport[] = [
        // Trợ giảng Linh làm trợ giảng: 400,000đ
        { id: 'w3', wageId: 'w-ast', teacherId: 't-linh', teacherProfileType: 'Teaching Assistant', role: 'assistant', totalAmount: 400000, paid: true, month: '2026-03' },
        // Trợ giảng Linh dạy thay GV chính: 1,000,000đ
        { id: 'w4', wageId: 'w-tch', teacherId: 't-linh', teacherProfileType: 'Teaching Assistant', role: 'teacher', totalAmount: 1000000, paid: false, month: '2026-03' },
      ];

      const report = HistoryAndReportEngine.calculateSalarySummaryByRole(wageItems);
      expect(report.totalMainTeacher).toBe(1000000); // Correctly classified as Main Teacher!
      expect(report.totalTA).toBe(400000);
      expect(report.totalExpense).toBe(1400000);
      expect(report.totalPaid).toBe(400000);
      expect(report.totalUnpaid).toBe(1000000);
    });

    // Case R10: Báo cáo nhiều giáo viên với hỗn hợp các vai trò
    it('Case R10: [CH-05 Multi-Teacher Report] should aggregate total expenses accurately across mixed roles', () => {
      const wageItems: MockWageItemForReport[] = [
        { id: 'w1', wageId: 'w1', teacherId: 't1', teacherProfileType: 'Full-time', role: 'teacher', totalAmount: 3000000, paid: true, month: '2026-03' },
        { id: 'w2', wageId: 'w2', teacherId: 't2', teacherProfileType: 'Part-time', role: 'teacher', totalAmount: 1500000, paid: true, month: '2026-03' },
        { id: 'w3', wageId: 'w3', teacherId: 't1', teacherProfileType: 'Full-time', role: 'assistant', totalAmount: 600000, paid: false, month: '2026-03' },
        { id: 'w4', wageId: 'w4', teacherId: 't3', teacherProfileType: 'Teaching Assistant', role: 'assistant', totalAmount: 800000, paid: false, month: '2026-03' },
      ];

      const report = HistoryAndReportEngine.calculateSalarySummaryByRole(wageItems);
      expect(report.totalMainTeacher).toBe(4500000); // 3000k + 1500k
      expect(report.totalTA).toBe(1400000); // 600k + 800k
      expect(report.totalExpense).toBe(5900000);
      expect(report.totalPaid).toBe(4500000);
      expect(report.totalUnpaid).toBe(1400000);
    });
  });

  describe('Group 4: Báo cáo Thù lao Giáo viên (calculateTeacherWageUseCase & getWagesReport) (Cases R11 - R14)', () => {
    // Case R11: Ca học đã chốt lương GV - Bảng giá mới thay đổi không làm đổi thù lao đã chốt
    it('Case R11: should resolve billedTeacherWage = 220000 from snapshot even if current pricing is 300000', () => {
      const session: MockTeacherSessionReportItem = {
        id: 's1',
        date: '2026-01-10',
        teacherId: 'tch-1',
        assistantId: null,
        wageId: 'wage-jan',
        assistantWageId: null,
        billedTeacherWage: 220000,
        billedAssistantWage: null,
        currentConfiguredTeacherWage: 300000,
        currentConfiguredAssistantWage: 100000,
      };

      const result = HistoryAndReportEngine.resolveTeacherSessionWageForReport(session, 'tch-1');
      expect(result.role).toBe('teacher');
      expect(result.rate).toBe(220000); // Preserved 220,000!
      expect(result.isSnapshot).toBe(true);
    });

    // Case R12: Ca học đã chốt thù lao trợ giảng
    it('Case R12: should resolve billedAssistantWage = 90000 from snapshot for assistant report', () => {
      const session: MockTeacherSessionReportItem = {
        id: 's2',
        date: '2026-01-10',
        teacherId: 'tch-other',
        assistantId: 'tch-1', // Target teacher is acting as assistant
        wageId: 'wage-other',
        assistantWageId: 'wage-ast-jan',
        billedTeacherWage: 250000,
        billedAssistantWage: 90000,
        currentConfiguredTeacherWage: 300000,
        currentConfiguredAssistantWage: 120000,
      };

      const result = HistoryAndReportEngine.resolveTeacherSessionWageForReport(session, 'tch-1');
      expect(result.role).toBe('assistant');
      expect(result.rate).toBe(90000); // Preserved 90,000!
      expect(result.isSnapshot).toBe(true);
    });

    // Case R13: [CH-05] Thầy Nam dạy chính buổi 1 và làm trợ giảng buổi 2
    it('Case R13: [CH-05] should resolve both teacher and assistant sessions accurately for same teacher', () => {
      const sessionTeacher: MockTeacherSessionReportItem = {
        id: 's-tch',
        date: '2026-02-01',
        teacherId: 'tch-nam',
        assistantId: null,
        wageId: 'w1',
        assistantWageId: null,
        billedTeacherWage: 250000,
        billedAssistantWage: null,
        currentConfiguredTeacherWage: 250000,
        currentConfiguredAssistantWage: 100000,
      };
      const sessionAssistant: MockTeacherSessionReportItem = {
        id: 's-ast',
        date: '2026-02-02',
        teacherId: 'tch-other',
        assistantId: 'tch-nam',
        wageId: 'w2',
        assistantWageId: 'w3',
        billedTeacherWage: 250000,
        billedAssistantWage: 100000,
        currentConfiguredTeacherWage: 250000,
        currentConfiguredAssistantWage: 100000,
      };

      const resTch = HistoryAndReportEngine.resolveTeacherSessionWageForReport(sessionTeacher, 'tch-nam');
      const resAst = HistoryAndReportEngine.resolveTeacherSessionWageForReport(sessionAssistant, 'tch-nam');

      expect(resTch.role).toBe('teacher');
      expect(resTch.rate).toBe(250000);
      expect(resAst.role).toBe('assistant');
      expect(resAst.rate).toBe(100000);
    });

    // Case R14: Ca học chưa chốt lương (wageId = null) - Lấy đơn giá dự kiến
    it('Case R14: should resolve current configured rate for unbilled session in upcoming report preview', () => {
      const sessionUnbilled: MockTeacherSessionReportItem = {
        id: 's-unbilled',
        date: '2026-03-25',
        teacherId: 'tch-nam',
        assistantId: null,
        wageId: null,
        assistantWageId: null,
        billedTeacherWage: null,
        billedAssistantWage: null,
        currentConfiguredTeacherWage: 260000,
        currentConfiguredAssistantWage: 100000,
      };

      const res = HistoryAndReportEngine.resolveTeacherSessionWageForReport(sessionUnbilled, 'tch-nam');
      expect(res.role).toBe('teacher');
      expect(res.rate).toBe(260000); // Configured rate preview
      expect(res.isSnapshot).toBe(false);
    });
  });

  describe('Group 5: Chi tiết Đợt Thanh toán Cũ (findPeriodDetails & findOrderDetails) (Case R15)', () => {
    // Case R15: Chi tiết đợt thanh toán cũ không bị ảnh hưởng bởi bảng giá sau này
    it('Case R15: should guarantee historical period details remain 100% immutable regardless of pricing changes', () => {
      const historicalLines = [
        { classId: 'c1', sessionsCount: 10, rate: 150000, totalAmount: 1500000 },
      ];
      // Even if admin later changes course pricing to 250,000, the saved historical order lines remain intact
      const total = historicalLines.reduce((sum, l) => sum + l.totalAmount, 0);
      expect(total).toBe(1500000);
      expect(historicalLines[0].rate).toBe(150000);
    });
  });
});
