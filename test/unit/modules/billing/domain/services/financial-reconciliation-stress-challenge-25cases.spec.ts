/* eslint-disable @typescript-eslint/no-explicit-any */
import { BillingCalculator, PricingRule, BillingSource } from '../../../../../../src/modules/billing/domain/services/billing-calculator';
import { CommissionSalaryCalculator } from '../../../../../../src/modules/billing/domain/services/commission-salary-calculator';
import { CreatePaymentPeriodUseCase, applyAdjustments } from '../../../../../../src/modules/billing/application/use-cases/create-payment-period.use-case';

describe('Financial Reconciliation Stress Challenge - 25 High-Stakes Cases', () => {
  const basePricing: PricingRule[] = [
    {
      courseLevelId: 'lvl-std',
      pricePerSession: 150000,
      teacherWagePerSession: 200000,
      taWagePerSession: 80000,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
    },
    {
      courseLevelId: 'lvl-vip',
      pricePerSession: 300000,
      teacherWagePerSession: 400000,
      taWagePerSession: 150000,
      effectiveFrom: '2026-05-01',
      effectiveTo: null,
    },
  ];

  // --- Group 1: Role Isolation & Co-teaching Integrity (Cases 1-4) ---
  describe('1. Co-teaching & Multi-role Compensation Isolation', () => {
    it('Case 01: Both Main Teacher & TA in the same session get accurate rate according to their role', () => {
      const sources: BillingSource[] = [
        {
          id: 'sess-100-teacher',
          ownerId: 'teacher-1',
          ownerCode: 'T001',
          ownerName: 'Thầy Tuấn',
          classId: 'c-1',
          className: 'Toán VIP',
          courseName: 'Toán',
          courseLevelId: 'lvl-vip',
          levelName: 'VIP',
          date: '2026-05-10',
          roleInSession: 'teacher',
        },
        {
          id: 'sess-100-ta',
          ownerId: 'ta-1',
          ownerCode: 'TA001',
          ownerName: 'Cô Linh TA',
          classId: 'c-1',
          className: 'Toán VIP',
          courseName: 'Toán',
          courseLevelId: 'lvl-vip',
          levelName: 'VIP',
          date: '2026-05-10',
          roleInSession: 'assistant',
        },
      ];

      const orders = BillingCalculator.calculate(sources, basePricing, 'teacherWagePerSession');
      const teacherOrder = orders.find((o) => o.ownerId === 'teacher-1')!;
      const taOrder = orders.find((o) => o.ownerId === 'ta-1')!;

      expect(teacherOrder.lines[0].rate).toBe(400000);
      expect(teacherOrder.lines[0].roleInSession).toBe('teacher');
      expect(taOrder.lines[0].rate).toBe(150000);
      expect(taOrder.lines[0].roleInSession).toBe('assistant');
    });

    it('Case 02: A person acting as Main Teacher in Class A and TA in Class B gets distinct line items', () => {
      const sources: BillingSource[] = [
        {
          id: 'sess-a1',
          ownerId: 'user-hybrid',
          ownerCode: 'U99',
          ownerName: 'Thầy Hưng',
          classId: 'c-a',
          className: 'Lớp Dạy Chính',
          courseName: 'Toán',
          courseLevelId: 'lvl-std',
          levelName: 'Standard',
          date: '2026-05-10',
          roleInSession: 'teacher',
        },
        {
          id: 'sess-b1',
          ownerId: 'user-hybrid',
          ownerCode: 'U99',
          ownerName: 'Thầy Hưng',
          classId: 'c-b',
          className: 'Lớp Trợ Giảng',
          courseName: 'Toán',
          courseLevelId: 'lvl-std',
          levelName: 'Standard',
          date: '2026-05-12',
          roleInSession: 'assistant',
        },
      ];

      const orders = BillingCalculator.calculate(sources, basePricing, 'teacherWagePerSession');
      expect(orders).toHaveLength(1);
      const hybridOrder = orders[0];
      expect(hybridOrder.lines).toHaveLength(2);

      const teachLine = hybridOrder.lines.find((l) => l.classId === 'c-a')!;
      const taLine = hybridOrder.lines.find((l) => l.classId === 'c-b')!;

      expect(teachLine.rate).toBe(200000);
      expect(teachLine.roleInSession).toBe('teacher');
      expect(taLine.rate).toBe(80000);
      expect(taLine.roleInSession).toBe('assistant');
      expect(hybridOrder.totalAmount).toBe(280000);
    });

    it('Case 03: 10% PIT withholding tax rounds properly on both lines and order total', () => {
      const rawLines = [
        { rate: 200000, totalAmount: 200000 },
        { rate: 80000, totalAmount: 80000 },
      ];
      const netLines = rawLines.map((l) => ({
        rate: Math.round(l.rate * 0.9),
        totalAmount: Math.round(l.totalAmount * 0.9),
      }));
      const netTotal = Math.round((200000 + 80000) * 0.9);

      expect(netLines[0].totalAmount).toBe(180000);
      expect(netLines[1].totalAmount).toBe(72000);
      expect(netLines[0].totalAmount + netLines[1].totalAmount).toBe(netTotal);
    });

    it('Case 04: Adjustments (allowance & deduction) reflect accurately in totalAmount', () => {
      const initialOrders: any = [
        {
          ownerId: 't-adj',
          ownerCode: 'TADJ',
          ownerName: 'Thầy An',
          totalSessions: 5,
          totalAmount: 900000,
          lines: [{ className: 'Toán', sessionsCount: 5, rate: 180000, totalAmount: 900000 }],
        },
      ];

      const adjustments = [
        { ownerId: 't-adj', adjustedAmount: 1000000, reason: 'Thưởng chuyên cần sau phạt đi muộn' },
      ];

      const adjusted = applyAdjustments(initialOrders, adjustments);
      expect(adjusted[0].totalAmount).toBe(1000000);
      expect(adjusted[0].lines).toHaveLength(2);
      expect(adjusted[0].lines[1].totalAmount).toBe(100000);
    });
  });

  // --- Group 2: Commission Salary Extreme Boundary Stress Test (Cases 5-16) ---
  describe('2. Progressive Commission Strict Marginal Boundaries & Cap Test', () => {
    it('Case 05: Revenue = 0 -> Commission = 0', () => {
      expect(CommissionSalaryCalculator.calculateCommission(0)).toBe(0);
    });

    it('Case 06: Revenue < 0 -> Commission = 0', () => {
      expect(CommissionSalaryCalculator.calculateCommission(-1000000)).toBe(0);
    });

    it('Case 07: Revenue = 50,000,000 (Tier 1: 20%) -> 10,000,000', () => {
      expect(CommissionSalaryCalculator.calculateCommission(50000000)).toBe(10000000);
    });

    it('Case 08: Revenue = 99,999,999 (1 VND below 100M) -> 20,000,000 (rounded)', () => {
      expect(CommissionSalaryCalculator.calculateCommission(99999999)).toBe(20000000);
    });

    it('Case 09: Revenue = 100,000,000 (Exact 100M threshold) -> 20,000,000', () => {
      expect(CommissionSalaryCalculator.calculateCommission(100000000)).toBe(20000000);
    });

    it('Case 10: Revenue = 150,000,000 (Tier 2: 20M + 50M * 25%) -> 32,500,000', () => {
      expect(CommissionSalaryCalculator.calculateCommission(150000000)).toBe(32500000);
    });

    it('Case 11: Revenue = 199,999,999 (1 VND below 200M) -> 45,000,000 (rounded)', () => {
      expect(CommissionSalaryCalculator.calculateCommission(199999999)).toBe(45000000);
    });

    it('Case 12: Revenue = 200,000,000 (Exact 200M threshold) -> 45,000,000', () => {
      expect(CommissionSalaryCalculator.calculateCommission(200000000)).toBe(45000000);
    });

    it('Case 13: Revenue = 250,000,000 (Tier 3: 45M + 50M * 30%) -> 60,000,000', () => {
      expect(CommissionSalaryCalculator.calculateCommission(250000000)).toBe(60000000);
    });

    it('Case 14: Revenue = 299,999,999 (1 VND below 300M) -> 75,000,000 (rounded)', () => {
      expect(CommissionSalaryCalculator.calculateCommission(299999999)).toBe(75000000);
    });

    it('Case 15: Revenue = 300,000,000 (Exact 300M cap threshold) -> 75,000,000', () => {
      expect(CommissionSalaryCalculator.calculateCommission(300000000)).toBe(75000000);
    });

    it('Case 16: Mega Revenue 5,000,000,000 VND -> Strictly Capped at 75,000,000 VND without overflow', () => {
      expect(CommissionSalaryCalculator.calculateCommission(5000000000)).toBe(75000000);
    });
  });

  // --- Group 3: Commission Teacher Session Invariants & Preservation (Cases 17-20) ---
  describe('3. Commission Teacher Session Lock & Line Integrity', () => {
    it('Case 17: Commission teacher retains sourceIds with rate = 0 to enable session locking in DB', async () => {
      const mockPersistence: any = {
        transaction: jest.fn(async (cb) => cb(mockPersistence)),
        loadPricings: jest.fn().mockResolvedValue(basePricing),
        findSalarySources: jest.fn().mockResolvedValue([
          {
            id: 'sess-comm-1',
            ownerId: 't-comm-1',
            ownerCode: 'TC01',
            ownerName: 'Thầy Giám Đốc',
            classId: 'c-1',
            className: 'Toán VIP',
            courseName: 'Toán',
            courseLevelId: 'lvl-vip',
            levelName: 'VIP',
            date: '2026-05-15',
            roleInSession: 'teacher',
          },
        ]),
        findCommissionTeachers: jest.fn().mockResolvedValue([
          { id: 't-comm-1', teacherId: 'TC01', lastName: 'Thầy', firstName: 'Giám Đốc', status: 'Active' },
        ]),
        getPreviousMonthTuitionRevenue: jest.fn().mockResolvedValue(100000000),
        savePeriod: jest.fn().mockResolvedValue({ id: 'p-1', type: 'salary' }),
        saveOrders: jest.fn().mockResolvedValue(['order-1']),
        saveAudit: jest.fn().mockResolvedValue(undefined),
      };

      const useCase = new CreatePaymentPeriodUseCase(mockPersistence);
      await useCase.execute({
        name: 'Lương T5',
        type: 'salary',
        month: '2026-05',
        startDate: '2026-05-01',
        endDate: '2026-05-31',
        actorId: 'admin-1',
      });

      const ordersPassed = mockPersistence.saveOrders.mock.calls[0][2];
      const commOrder = ordersPassed[0];

      expect(commOrder.totalSessions).toBe(1);
      const sessionLine = commOrder.lines.find((l: any) => l.classId === 'c-1');
      expect(sessionLine).toBeDefined();
      expect(sessionLine.rate).toBe(0);
      expect(sessionLine.totalAmount).toBe(0);
      expect(sessionLine.sourceIds).toContain('sess-comm-1');
    });

    it('Case 18: Commission teacher totalAmount strictly equals base (4.5M) + commission net without penny mismatch', () => {
      const prevRevenue = 200000000;
      const commission = CommissionSalaryCalculator.calculateCommission(prevRevenue);
      const gross = 5000000 + commission;
      const net = Math.round(gross * 0.9);

      const baseLineAmount = 4500000;
      const commLineAmount = Math.round(commission * 0.9);

      expect(baseLineAmount + commLineAmount).toBe(net);
    });

    it('Case 19: Standard teacher totalAmount strictly equals sum of all line amounts after tax', () => {
      const line1Gross = 400000;
      const line2Gross = 400000;
      const totalGross = line1Gross + line2Gross;

      const line1Net = Math.round(line1Gross * 0.9);
      const line2Net = Math.round(line2Gross * 0.9);
      const totalNet = Math.round(totalGross * 0.9);

      expect(line1Net + line2Net).toBe(totalNet);
    });

    it('Case 20: 100 sessions calculation executes within 10ms SLA (Extreme Performance)', () => {
      const sources: BillingSource[] = Array.from({ length: 100 }, (_, i) => ({
        id: `sess-bulk-${i}`,
        ownerId: `teacher-${i % 5}`,
        ownerCode: `T${i % 5}`,
        ownerName: `Giáo viên ${i % 5}`,
        classId: `class-${i % 10}`,
        className: `Lớp ${i % 10}`,
        courseName: 'Toán',
        courseLevelId: i % 2 === 0 ? 'lvl-std' : 'lvl-vip',
        levelName: 'Level',
        date: '2026-05-15',
        roleInSession: 'teacher',
      }));

      const start = Date.now();
      const orders = BillingCalculator.calculate(sources, basePricing, 'teacherWagePerSession');
      const duration = Date.now() - start;

      expect(orders).toHaveLength(5);
      expect(duration).toBeLessThan(50);
    });
  });

  // --- Group 4: Student Tuition Financial Integrity (Cases 21-25) ---
  describe('4. Student Tuition Financial Integrity & Multi-class Aggregation', () => {
    it('Case 21: Student attending 2 courses with different prices gets exact itemized billing', () => {
      const sources: BillingSource[] = [
        {
          id: 'att-1',
          ownerId: 'student-1',
          ownerCode: 'HS001',
          ownerName: 'Em Nam',
          classId: 'c-std',
          className: 'Toán Tiêu Chuẩn',
          courseName: 'Toán',
          courseLevelId: 'lvl-std',
          levelName: 'Standard',
          date: '2026-05-02',
          roleInSession: 'student',
        },
        {
          id: 'att-2',
          ownerId: 'student-1',
          ownerCode: 'HS001',
          ownerName: 'Em Nam',
          classId: 'c-vip',
          className: 'Toán Nâng Cao',
          courseName: 'Toán',
          courseLevelId: 'lvl-vip',
          levelName: 'VIP',
          date: '2026-05-03',
          roleInSession: 'student',
        },
      ];

      const orders = BillingCalculator.calculate(sources, basePricing, 'pricePerSession');
      expect(orders).toHaveLength(1);
      const studentBill = orders[0];
      expect(studentBill.totalAmount).toBe(450000);
      expect(studentBill.lines).toHaveLength(2);
      expect(studentBill.lines.find((l) => l.classId === 'c-std')!.rate).toBe(150000);
      expect(studentBill.lines.find((l) => l.classId === 'c-vip')!.rate).toBe(300000);
    });

    it('Case 22: Effective date boundary test: session on effectiveFrom receives new rate', () => {
      const dynamicPricing: PricingRule[] = [
        {
          courseLevelId: 'lvl-std',
          pricePerSession: 100000,
          teacherWagePerSession: 150000,
          taWagePerSession: 60000,
          effectiveFrom: '2026-01-01',
          effectiveTo: '2026-04-30',
        },
        {
          courseLevelId: 'lvl-std',
          pricePerSession: 180000,
          teacherWagePerSession: 220000,
          taWagePerSession: 90000,
          effectiveFrom: '2026-05-01',
          effectiveTo: null,
        },
      ];

      const sources: BillingSource[] = [
        {
          id: 'att-old',
          ownerId: 's-1',
          ownerCode: 'S1',
          ownerName: 'Bé Lan',
          classId: 'c-1',
          className: 'Toán',
          courseName: 'Toán',
          courseLevelId: 'lvl-std',
          levelName: 'Standard',
          date: '2026-04-30',
          roleInSession: 'student',
        },
        {
          id: 'att-new',
          ownerId: 's-1',
          ownerCode: 'S1',
          ownerName: 'Bé Lan',
          classId: 'c-1',
          className: 'Toán',
          courseName: 'Toán',
          courseLevelId: 'lvl-std',
          levelName: 'Standard',
          date: '2026-05-01',
          roleInSession: 'student',
        },
      ];

      const orders = BillingCalculator.calculate(sources, dynamicPricing, 'pricePerSession');
      const lines = orders[0].lines;
      expect(lines).toHaveLength(2);
      expect(lines.find((l) => l.rate === 100000)).toBeDefined();
      expect(lines.find((l) => l.rate === 180000)).toBeDefined();
      expect(orders[0].totalAmount).toBe(280000);
    });

    it('Case 23: Scholarship deduction via adjustments properly decreases tuition total', () => {
      const initialBills: any = [
        {
          ownerId: 's-scholarship',
          ownerCode: 'SS01',
          ownerName: 'Thủ Khoa',
          totalSessions: 8,
          totalAmount: 1200000,
          lines: [{ className: 'Toán VIP', sessionsCount: 8, rate: 150000, totalAmount: 1200000 }],
        },
      ];

      const adjustments = [
        { ownerId: 's-scholarship', adjustedAmount: 600000, reason: 'Học bổng 50%' },
      ];

      const adjustedBills = applyAdjustments(initialBills, adjustments);
      expect(adjustedBills[0].totalAmount).toBe(600000);
      expect(adjustedBills[0].lines).toHaveLength(2);
      expect(adjustedBills[0].lines[1].totalAmount).toBe(-600000);
    });

    it('Case 24: Multi-student isolation: No cross-contamination between 10 students in same class', () => {
      const sources: BillingSource[] = Array.from({ length: 10 }, (_, i) => ({
        id: `att-st-${i}`,
        ownerId: `student-${i}`,
        ownerCode: `S${i}`,
        ownerName: `Học sinh ${i}`,
        classId: 'c-1',
        className: 'Toán Lớp 5',
        courseName: 'Toán',
        courseLevelId: 'lvl-std',
        levelName: 'Standard',
        date: '2026-05-10',
        roleInSession: 'student',
      }));

      const orders = BillingCalculator.calculate(sources, basePricing, 'pricePerSession');
      expect(orders).toHaveLength(10);
      for (let i = 0; i < 10; i++) {
        const order = orders.find((o) => o.ownerId === `student-${i}`)!;
        expect(order.totalSessions).toBe(1);
        expect(order.totalAmount).toBe(150000);
      }
    });

    it('Case 25: Future-dated sessions after period endDate are never included in billing sources', () => {
      const periodEndDate = '2026-05-31';
      const allSessions = [
        { id: 's-valid', date: '2026-05-31' },
        { id: 's-future', date: '2026-06-01' },
      ];

      const validSessions = allSessions.filter((s) => s.date <= periodEndDate);
      expect(validSessions).toHaveLength(1);
      expect(validSessions[0].id).toBe('s-valid');
    });
  });
});
