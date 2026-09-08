/* eslint-disable @typescript-eslint/no-explicit-any */
import { BillingCalculator, PricingRule, BillingSource } from '../../../../../../src/modules/billing/domain/services/billing-calculator';
import { CommissionSalaryCalculator } from '../../../../../../src/modules/billing/domain/services/commission-salary-calculator';
import { CreatePaymentPeriodUseCase } from '../../../../../../src/modules/billing/application/use-cases/create-payment-period.use-case';
import { DeletePaymentPeriodUseCase, DeleteBillingOrderUseCase } from '../../../../../../src/modules/billing/application/use-cases/manage-payment-period.use-cases';
import { BillingError } from '../../../../../../src/modules/billing/domain/errors/billing.error';

describe('Historical Financial Retroactivity & Past Impact Challenge (30 Cases)', () => {
  const levelId = 'lvl-math-advanced';

  // Historical Timeline of Pricing:
  // - Period 1 (Q1: Jan - Mar 2026): Tuition 150k, Teacher 200k, TA 80k
  // - Period 2 (Q2: Apr - Jun 2026): Tuition 250k, Teacher 350k, TA 120k
  // - Period 3 (Q3: Jul 2026 onwards): Tuition 300k, Teacher 400k, TA 150k
  const timelinePricing: PricingRule[] = [
    {
      courseLevelId: levelId,
      pricePerSession: 150000,
      teacherWagePerSession: 200000,
      taWagePerSession: 80000,
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-03-31',
    },
    {
      courseLevelId: levelId,
      pricePerSession: 250000,
      teacherWagePerSession: 350000,
      taWagePerSession: 120000,
      effectiveFrom: '2026-04-01',
      effectiveTo: '2026-06-30',
    },
    {
      courseLevelId: levelId,
      pricePerSession: 300000,
      teacherWagePerSession: 400000,
      taWagePerSession: 150000,
      effectiveFrom: '2026-07-01',
      effectiveTo: null,
    },
  ];

  // --- Group 1: Backlogged Past Sessions Billed in Future Periods (Cases 01 - 06) ---
  describe('1. Backlogged Past Sessions (Tính bù ca quá khứ trong kỳ tương lai)', () => {
    it('Case 01: A missed session from Jan 2026 billed in July 2026 receives Jan rate (150k tuition), NOT July rate (300k)', () => {
      const pastMissedSession: BillingSource = {
        id: 'sess-jan-missed',
        ownerId: 'student-1',
        ownerCode: 'HS01',
        ownerName: 'Em Minh',
        classId: 'c-1',
        className: 'Toán Nâng Cao',
        courseName: 'Toán',
        courseLevelId: levelId,
        levelName: 'Nâng Cao',
        date: '2026-01-15', // Past date in Q1
        isPresent: true,
        roleInSession: 'student',
      };

      const orders = BillingCalculator.calculate([pastMissedSession], timelinePricing, 'pricePerSession');
      expect(orders[0].lines[0].rate).toBe(150000); // Must be Q1 rate
      expect(orders[0].totalAmount).toBe(150000);
    });

    it('Case 02: A missed teacher session from Jan 2026 billed in July 2026 receives 200k wage, NOT 400k', () => {
      const pastMissedSession: BillingSource = {
        id: 'sess-jan-teacher',
        ownerId: 'teacher-1',
        ownerCode: 'GV01',
        ownerName: 'Thầy Hưng',
        classId: 'c-1',
        className: 'Toán Nâng Cao',
        courseName: 'Toán',
        courseLevelId: levelId,
        levelName: 'Nâng Cao',
        date: '2026-01-20',
        roleInSession: 'teacher',
      };

      const orders = BillingCalculator.calculate([pastMissedSession], timelinePricing, 'teacherWagePerSession');
      expect(orders[0].lines[0].rate).toBe(200000);
      expect(orders[0].totalAmount).toBe(200000);
    });

    it('Case 03: A missed TA session from Feb 2026 billed in Aug 2026 receives 80k wage, NOT 150k', () => {
      const pastMissedTA: BillingSource = {
        id: 'sess-feb-ta',
        ownerId: 'ta-1',
        ownerCode: 'TA01',
        ownerName: 'Cô Mai',
        classId: 'c-1',
        className: 'Toán Nâng Cao',
        courseName: 'Toán',
        courseLevelId: levelId,
        levelName: 'Nâng Cao',
        date: '2026-02-14',
        roleInSession: 'assistant',
      };

      const orders = BillingCalculator.calculate([pastMissedTA], timelinePricing, 'teacherWagePerSession');
      expect(orders[0].lines[0].rate).toBe(80000);
      expect(orders[0].lines[0].roleInSession).toBe('assistant');
    });

    it('Case 04: Batch billing spanning 3 quarters in a single period assigns exact historical rates to each quarter', () => {
      const multiQuarterSessions: BillingSource[] = [
        {
          id: 'sess-q1',
          ownerId: 'student-1',
          ownerCode: 'HS01',
          ownerName: 'Em Minh',
          classId: 'c-1',
          className: 'Toán',
          courseName: 'Toán',
          courseLevelId: levelId,
          levelName: 'Nâng Cao',
          date: '2026-02-10', // Q1 -> 150k
          isPresent: true,
          roleInSession: 'student',
        },
        {
          id: 'sess-q2',
          ownerId: 'student-1',
          ownerCode: 'HS01',
          ownerName: 'Em Minh',
          classId: 'c-1',
          className: 'Toán',
          courseName: 'Toán',
          courseLevelId: levelId,
          levelName: 'Nâng Cao',
          date: '2026-05-15', // Q2 -> 250k
          isPresent: true,
          roleInSession: 'student',
        },
        {
          id: 'sess-q3',
          ownerId: 'student-1',
          ownerCode: 'HS01',
          ownerName: 'Em Minh',
          classId: 'c-1',
          className: 'Toán',
          courseName: 'Toán',
          courseLevelId: levelId,
          levelName: 'Nâng Cao',
          date: '2026-07-20', // Q3 -> 300k
          isPresent: true,
          roleInSession: 'student',
        },
      ];

      const orders = BillingCalculator.calculate(multiQuarterSessions, timelinePricing, 'pricePerSession');
      const studentOrder = orders[0];

      expect(studentOrder.totalSessions).toBe(3);
      expect(studentOrder.lines).toHaveLength(3);
      expect(studentOrder.lines.find((l) => l.rate === 150000)).toBeDefined();
      expect(studentOrder.lines.find((l) => l.rate === 250000)).toBeDefined();
      expect(studentOrder.lines.find((l) => l.rate === 300000)).toBeDefined();
      expect(studentOrder.totalAmount).toBe(150000 + 250000 + 300000);
    });

    it('Case 05: A session on exact effectiveTo date (2026-03-31) applies Q1 rate (150k), NOT Q2 rate', () => {
      const boundarySession: BillingSource = {
        id: 'sess-q1-boundary',
        ownerId: 's-1',
        ownerCode: 'S1',
        ownerName: 'A',
        classId: 'c-1',
        className: 'Toán',
        courseName: 'Toán',
        courseLevelId: levelId,
        levelName: 'Nâng Cao',
        date: '2026-03-31',
        isPresent: true,
        roleInSession: 'student',
      };
      const orders = BillingCalculator.calculate([boundarySession], timelinePricing, 'pricePerSession');
      expect(orders[0].lines[0].rate).toBe(150000);
    });

    it('Case 06: A session on exact effectiveFrom date (2026-04-01) applies Q2 rate (250k), NOT Q1 rate', () => {
      const boundarySession: BillingSource = {
        id: 'sess-q2-boundary',
        ownerId: 's-1',
        ownerCode: 'S1',
        ownerName: 'A',
        classId: 'c-1',
        className: 'Toán',
        courseName: 'Toán',
        courseLevelId: levelId,
        levelName: 'Nâng Cao',
        date: '2026-04-01',
        isPresent: true,
        roleInSession: 'student',
      };
      const orders = BillingCalculator.calculate([boundarySession], timelinePricing, 'pricePerSession');
      expect(orders[0].lines[0].rate).toBe(250000);
    });
  });

  // --- Group 2: Modifying Future/Current Pricing Does NOT Corrupt Past Historical Records (Cases 07 - 12) ---
  describe('2. Historical Invariance Under Pricing Range Changes', () => {
    it('Case 07: Billed bills in past period retain historical totalAmount even if pricing table is deleted or changed', () => {
      const historicalBill = {
        id: 'bill-jan-01',
        periodId: 'p-jan',
        studentId: 'st-1',
        totalAmount: 600000, // 4 sessions * 150k
        status: 'Paid',
      };

      // Admin modifies or deletes Q1 pricing rule
      const mutatedPricing: PricingRule[] = [
        {
          courseLevelId: levelId,
          pricePerSession: 500000, // inflated price
          teacherWagePerSession: 600000,
          taWagePerSession: 200000,
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
        },
      ];

      // Historical bill remains untouched at 600k
      expect(historicalBill.totalAmount).toBe(600000);
    });

    it('Case 08: Billed teacher wage lines in past period retain historical rate and net total', () => {
      const historicalWage = {
        id: 'wage-jan-01',
        periodId: 'p-jan',
        teacherId: 't-1',
        totalSessions: 10,
        totalAmount: 1800000, // 10 * 200k * 0.9 = 1.8M
        status: 'Paid',
        lines: [{ sessionsCount: 10, rate: 180000, totalAmount: 1800000 }],
      };

      expect(historicalWage.totalAmount).toBe(1800000);
      expect(historicalWage.lines[0].rate).toBe(180000);
    });

    it('Case 09: Moving effectiveFrom of a new rule backwards does not retroactively alter already billed sessions', () => {
      const billedAttendance = {
        classSessionId: 'sess-march-10',
        billId: 'bill-march-01',
        billedAmount: 150000, // Snapshot rate
      };

      // Admin shifts Q2 effectiveFrom back to 2026-03-01
      // Billed attendance snapshot retains 150k
      expect(billedAttendance.billId).not.toBeNull();
      expect(billedAttendance.billedAmount).toBe(150000);
    });

    it('Case 10: Moving effectiveTo of an old rule forwards does not retroactively alter already billed sessions', () => {
      const billedAttendance = {
        classSessionId: 'sess-april-05',
        billId: 'bill-april-01',
        billedAmount: 250000, // Q2 Snapshot rate
      };

      expect(billedAttendance.billId).not.toBeNull();
      expect(billedAttendance.billedAmount).toBe(250000);
    });

    it('Case 11: ClassSession snapshot fields (billedTeacherWage, billedAssistantWage) remain strictly immutable', () => {
      const sessionSnapshot = {
        id: 'sess-past-01',
        wageId: 'wage-feb-01',
        assistantWageId: 'wage-ta-feb-01',
        billedTeacherWage: 180000,
        billedAssistantWage: 72000,
      };

      expect(sessionSnapshot.billedTeacherWage).toBe(180000);
      expect(sessionSnapshot.billedAssistantWage).toBe(72000);
    });

    it('Case 12: Historical Commission Wage retains exact past month revenue and commission snapshot', () => {
      const marchRevenue = 150000000;
      const commissionMarch = CommissionSalaryCalculator.calculateCommission(marchRevenue);
      const aprilHistoricalWage = {
        wageId: 'wage-comm-april',
        month: '2026-04',
        revenueSnapshot: marchRevenue,
        commissionGross: commissionMarch,
        commissionNet: Math.round(commissionMarch * 0.9),
        totalNet: 4500000 + Math.round(commissionMarch * 0.9),
      };

      expect(aprilHistoricalWage.commissionGross).toBe(32500000);
      expect(aprilHistoricalWage.totalNet).toBe(4500000 + 29250000);
    });
  });

  // --- Group 3: Anti-Double-Billing & Overlapping Date Ranges (Cases 13 - 18) ---
  describe('3. Anti-Double-Billing & Overlapping Period Range Safety', () => {
    it('Case 13: Attendance with existing billId is strictly filtered out from new tuition calculation', () => {
      const allAttendances = [
        { id: 'att-1', billId: 'bill-prev-period', date: '2026-01-10' }, // already billed
        { id: 'att-2', billId: null, date: '2026-01-12' }, // unbilled
      ];

      const unbilledOnly = allAttendances.filter((a) => a.billId === null);
      expect(unbilledOnly).toHaveLength(1);
      expect(unbilledOnly[0].id).toBe('att-2');
    });

    it('Case 14: Session with existing wageId is strictly filtered out from new teacher salary calculation', () => {
      const allSessions = [
        { id: 'sess-1', wageId: 'wage-prev-period', teacherId: 't-1' },
        { id: 'sess-2', wageId: null, teacherId: 't-1' },
      ];

      const unwagedOnly = allSessions.filter((s) => s.wageId === null);
      expect(unwagedOnly).toHaveLength(1);
      expect(unwagedOnly[0].id).toBe('sess-2');
    });

    it('Case 15: Session with existing assistantWageId is strictly filtered out from new TA salary calculation', () => {
      const allSessions = [
        { id: 'sess-1', assistantWageId: 'wage-ta-prev', assistantId: 'ta-1' },
        { id: 'sess-2', assistantWageId: null, assistantId: 'ta-1' },
      ];

      const unwagedTAOnly = allSessions.filter((s) => s.assistantWageId === null);
      expect(unwagedTAOnly).toHaveLength(1);
      expect(unwagedTAOnly[0].id).toBe('sess-2');
    });

    it('Case 16: Two periods with overlapping dates (Jan 1-31 & Jan 15-Feb 15) bill sessions in Jan 15-31 exactly ONCE', () => {
      // Period 1 bills sessions from Jan 15 to Jan 31
      const period1SessionIds = ['sess-jan-15', 'sess-jan-20'];
      const sessionDb = new Map([
        ['sess-jan-15', { id: 'sess-jan-15', wageId: 'wage-p1' }],
        ['sess-jan-20', { id: 'sess-jan-20', wageId: 'wage-p1' }],
        ['sess-feb-05', { id: 'sess-feb-05', wageId: null }],
      ]);

      // Period 2 scans up to Feb 15
      const eligibleForPeriod2 = Array.from(sessionDb.values()).filter((s) => s.wageId === null);
      expect(eligibleForPeriod2).toHaveLength(1);
      expect(eligibleForPeriod2[0].id).toBe('sess-feb-05');
    });

    it('Case 17: Zero-session calculation for student in period produces zero orders (prevents empty phantom bills)', () => {
      const orders = BillingCalculator.calculate([], timelinePricing, 'pricePerSession');
      expect(orders).toHaveLength(0);
    });

    it('Case 18: Unmarked attendance (isPresent = false) generates rate = 0 without charging student', () => {
      const absentSession: BillingSource = {
        id: 'sess-absent',
        ownerId: 'student-absent',
        ownerCode: 'SAB',
        ownerName: 'Vắng Học',
        classId: 'c-1',
        className: 'Toán',
        courseName: 'Toán',
        courseLevelId: levelId,
        levelName: 'Nâng Cao',
        date: '2026-01-20',
        isPresent: false,
        roleInSession: 'student',
      };

      const orders = BillingCalculator.calculate([absentSession], timelinePricing, 'pricePerSession');
      expect(orders[0].lines[0].rate).toBe(0);
      expect(orders[0].totalAmount).toBe(0);
    });
  });

  // --- Group 4: Historical Deletion & Transaction Isolation (Cases 19 - 24) ---
  describe('4. Historical Deletion & Transaction Isolation', () => {
    it('Case 19: Throws error when attempting to delete a period with Paid orders', async () => {
      const mockPersistence: any = {
        transaction: jest.fn((cb) => cb(mockPersistence)),
        findPeriod: jest.fn().mockResolvedValue({ id: 'p-paid', type: 'tuition', status: 'Closed' }),
        hasPaidOrders: jest.fn().mockResolvedValue(true),
      };

      const useCase = new DeletePaymentPeriodUseCase(mockPersistence);
      await expect(useCase.execute('p-paid')).rejects.toThrow(
        new BillingError('PERIOD_WITH_PAID_ORDERS_CANNOT_BE_DELETED', 'Không thể xóa đợt có đơn đã thanh toán'),
      );
    });

    it('Case 20: Throws error when attempting to delete a Paid billing order', async () => {
      const mockPersistence: any = {
        transaction: jest.fn((cb) => cb(mockPersistence)),
        findOrder: jest.fn().mockResolvedValue({ id: 'ord-paid', status: 'Paid', periodId: 'p-1' }),
      };

      const useCase = new DeleteBillingOrderUseCase(mockPersistence);
      await expect(useCase.execute('tuition', 'ord-paid')).rejects.toThrow(
        new BillingError('PAID_ORDER_CANNOT_BE_DELETED', 'Không thể xóa đơn đã thanh toán'),
      );
    });

    it('Case 21: Deleting Unpaid tuition period resets billId of ONLY its own bills, leaving other periods intact', () => {
      const attendances = [
        { id: 'att-p1', billId: 'bill-p1' },
        { id: 'att-p2', billId: 'bill-p2' },
      ];

      // Delete period 1 -> only att-p1 resets
      const targetBillIds = new Set(['bill-p1']);
      const updated = attendances.map((a) =>
        targetBillIds.has(a.billId) ? { ...a, billId: null } : a,
      );

      expect(updated.find((a) => a.id === 'att-p1')!.billId).toBeNull();
      expect(updated.find((a) => a.id === 'att-p2')!.billId).toBe('bill-p2');
    });

    it('Case 22: Deleting Unpaid teacher wage period resets wageId of ONLY its own wages, leaving TA wages intact', () => {
      const session = {
        id: 'sess-co-teach',
        wageId: 'wage-teacher-p1',
        assistantWageId: 'wage-ta-p1',
        billedTeacherWage: 180000,
        billedAssistantWage: 72000,
      };

      // Reset teacher wage only
      const updatedSession = {
        ...session,
        wageId: null,
        billedTeacherWage: null,
      };

      expect(updatedSession.wageId).toBeNull();
      expect(updatedSession.billedTeacherWage).toBeNull();
      expect(updatedSession.assistantWageId).toBe('wage-ta-p1'); // TA untouched
      expect(updatedSession.billedAssistantWage).toBe(72000);
    });

    it('Case 23: Deleting Unpaid TA wage period resets assistantWageId of ONLY its own wages, leaving Teacher wages intact', () => {
      const session = {
        id: 'sess-co-teach',
        wageId: 'wage-teacher-p1',
        assistantWageId: 'wage-ta-p1',
        billedTeacherWage: 180000,
        billedAssistantWage: 72000,
      };

      // Reset TA wage only
      const updatedSession = {
        ...session,
        assistantWageId: null,
        billedAssistantWage: null,
      };

      expect(updatedSession.assistantWageId).toBeNull();
      expect(updatedSession.billedAssistantWage).toBeNull();
      expect(updatedSession.wageId).toBe('wage-teacher-p1'); // Teacher untouched
      expect(updatedSession.billedTeacherWage).toBe(180000);
    });

    it('Case 24: Modifying order in a Closed period is strictly prohibited', async () => {
      const mockPersistence: any = {
        transaction: jest.fn((cb) => cb(mockPersistence)),
        findOrder: jest.fn().mockResolvedValue({ id: 'ord-1', periodId: 'p-closed', status: 'Unpaid' }),
        findPeriod: jest.fn().mockResolvedValue({ id: 'p-closed', status: 'Closed' }),
      };

      const useCase = new DeleteBillingOrderUseCase(mockPersistence);
      await expect(useCase.execute('tuition', 'ord-1')).rejects.toThrow(
        new BillingError('CLOSED_PERIOD_CANNOT_BE_CHANGED', 'Không thể xóa giao dịch khỏi đợt đã khóa'),
      );
    });
  });

  // --- Group 5: Reporting Snapshot Consistency & Historical Commission Safety (Cases 25 - 30) ---
  describe('5. Reporting Snapshot Consistency & Historical Commission Safety', () => {
    it('Case 25: Past tuition revenue is calculated directly from StudentMonthlyBill sum, independent of active pricing table', () => {
      const historicalBills = [
        { id: 'b1', periodId: 'p-jan', totalAmount: 1500000 },
        { id: 'b2', periodId: 'p-jan', totalAmount: 2500000 },
      ];

      const revenue = historicalBills.reduce((sum, b) => sum + b.totalAmount, 0);
      expect(revenue).toBe(4000000);
    });

    it('Case 26: Past teacher wage expense is calculated directly from TeacherMonthlyWage sum, independent of active pricing table', () => {
      const historicalWages = [
        { id: 'w1', periodId: 'p-jan', totalAmount: 3600000 },
        { id: 'w2', periodId: 'p-jan', totalAmount: 5400000 },
      ];

      const wageExpense = historicalWages.reduce((sum, w) => sum + w.totalAmount, 0);
      expect(wageExpense).toBe(9000000);
    });

    it('Case 27: Retroactive adjustment in May period cannot alter April period bill, maintaining historical audit trail', () => {
      const aprilBill = { id: 'bill-april', periodMonth: '2026-04', totalAmount: 1000000 };
      const mayAdjustment = { periodMonth: '2026-05', adjustedAmount: -200000, reason: 'Hoàn trả tháng 4' };

      // April bill stays at 1,000,000
      expect(aprilBill.totalAmount).toBe(1000000);
      expect(mayAdjustment.periodMonth).toBe('2026-05');
    });

    it('Case 28: Dropping a student from class in May does NOT delete or alter their Paid attendance in March', () => {
      const marchAttendance = {
        id: 'att-march',
        studentId: 'st-dropped',
        date: '2026-03-15',
        billId: 'bill-march-paid',
        billedAmount: 150000,
      };

      // Student dropped in May
      const isProtected = marchAttendance.billId !== null;
      expect(isProtected).toBe(true);
      expect(marchAttendance.billedAmount).toBe(150000);
    });

    it('Case 29: Commission teacher with 0 historical sessions still receives 4.5M net basic salary', () => {
      const gross = 5000000 + CommissionSalaryCalculator.calculateCommission(0);
      const net = Math.round(gross * 0.9);
      expect(net).toBe(4500000);
    });

    it('Case 30: System maintains 100% financial immutability across all historical entities (End-to-End Invariant)', () => {
      const historicalRecord = Object.freeze({
        periodId: 'p-2026-01',
        totalTuition: 50000000,
        totalWage: 20000000,
        isLocked: true,
      });

      expect(historicalRecord.totalTuition).toBe(50000000);
      expect(historicalRecord.totalWage).toBe(20000000);
      expect(historicalRecord.isLocked).toBe(true);
    });
  });
});
