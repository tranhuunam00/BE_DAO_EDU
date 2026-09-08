import { BillingCalculator, BillingSource, PricingRule } from '../../../../../../src/modules/billing/domain/services/billing-calculator';

describe('Pricing Query Active Rule Suite (12 Cases)', () => {
  const levelId = 'lvl-query-active-rule';

  const mockPricings: PricingRule[] = [
    {
      id: 'rule-student-1',
      courseLevelId: levelId,
      pricePerSession: 200000,
      teacherWagePerSession: 0,
      taWagePerSession: 0,
      effectiveFrom: '2026-09-01',
      effectiveTo: '2026-12-31',
      createdAt: new Date('2026-08-01T10:00:00Z'),
    },
    {
      id: 'rule-teacher-1',
      courseLevelId: levelId,
      pricePerSession: 0,
      teacherWagePerSession: 300000,
      taWagePerSession: 0,
      effectiveFrom: '2026-09-01',
      effectiveTo: '2026-12-31',
      createdAt: new Date('2026-08-01T10:05:00Z'),
    },
    {
      id: 'rule-ta-summer',
      courseLevelId: levelId,
      pricePerSession: 0,
      teacherWagePerSession: 0,
      taWagePerSession: 80000,
      effectiveFrom: '2026-06-01',
      effectiveTo: '2026-08-31',
      createdAt: new Date('2026-05-15T09:00:00Z'),
    },
    {
      id: 'rule-ta-autumn',
      courseLevelId: levelId,
      pricePerSession: 0,
      teacherWagePerSession: 0,
      taWagePerSession: 100000,
      effectiveFrom: '2026-09-01',
      effectiveTo: '2026-12-31',
      createdAt: new Date('2026-08-15T09:00:00Z'),
    },
  ];

  describe('Nhóm 1: Truy vấn Active Pricing chính xác theo thời gian và đối tượng (Cases Q01 - Q08)', () => {
    it('Case Q01: Truy vấn đơn giá học viên vào ngày 15/09/2026 -> 200,000đ', () => {
      const pricing = BillingCalculator.getActivePricing(mockPricings, '2026-09-15', 'pricePerSession', levelId);
      expect(pricing).toBeDefined();
      expect(Number(pricing?.pricePerSession)).toBe(200000);
    });

    it('Case Q02: Truy vấn lương giáo viên vào ngày 15/09/2026 -> 300,000đ', () => {
      const pricing = BillingCalculator.getActivePricing(mockPricings, '2026-09-15', 'teacherWagePerSession', levelId);
      expect(pricing).toBeDefined();
      expect(Number(pricing?.teacherWagePerSession)).toBe(300000);
    });

    it('Case Q03: Truy vấn lương trợ giảng vào ngày hè 15/07/2026 -> 80,000đ', () => {
      const pricing = BillingCalculator.getActivePricing(mockPricings, '2026-07-15', 'taWagePerSession', levelId);
      expect(pricing).toBeDefined();
      expect(Number(pricing?.taWagePerSession)).toBe(80000);
    });

    it('Case Q04: Truy vấn lương trợ giảng vào mùa thu 15/10/2026 -> 100,000đ', () => {
      const pricing = BillingCalculator.getActivePricing(mockPricings, '2026-10-15', 'taWagePerSession', levelId);
      expect(pricing).toBeDefined();
      expect(Number(pricing?.taWagePerSession)).toBe(100000);
    });

    it('Case Q05: Truy vấn học phí vào ngày hè 15/07/2026 (chưa có giá học viên) -> undefined', () => {
      const pricing = BillingCalculator.getActivePricing(mockPricings, '2026-07-15', 'pricePerSession', levelId);
      expect(pricing).toBeUndefined();
    });

    it('Case Q06: Truy vấn lương GV vào ngày trước dải ngày (15/08/2026) -> undefined', () => {
      const pricing = BillingCalculator.getActivePricing(mockPricings, '2026-08-15', 'teacherWagePerSession', levelId);
      expect(pricing).toBeUndefined();
    });

    it('Case Q07: Truy vấn ngày đúng mốc bắt đầu (01/09/2026) -> Khớp chuẩn xác', () => {
      const pricing = BillingCalculator.getActivePricing(mockPricings, '2026-09-01', 'teacherWagePerSession', levelId);
      expect(pricing).toBeDefined();
      expect(Number(pricing?.teacherWagePerSession)).toBe(300000);
    });

    it('Case Q08: Truy vấn ngày đúng mốc kết thúc (31/12/2026) -> Khớp chuẩn xác', () => {
      const pricing = BillingCalculator.getActivePricing(mockPricings, '2026-12-31', 'teacherWagePerSession', levelId);
      expect(pricing).toBeDefined();
      expect(Number(pricing?.teacherWagePerSession)).toBe(300000);
    });
  });

  describe('Nhóm 2: Tính tiền ca học phân định Giáo viên và Trợ giảng (Cases Q09 - Q12)', () => {
    it('Case Q09: Tính lương 1 ca cho Giáo viên chính -> 300,000đ', () => {
      const sources: BillingSource[] = [
        {
          id: 'sess-1',
          ownerId: 'tch-01',
          ownerCode: 'T01',
          ownerName: 'Nguyễn Văn A',
          ownerMobile: '0901234567',
          ownerStatus: 'Active',
          classId: 'cls-1',
          className: 'Lớp Toán 9A',
          courseName: 'Toán',
          levelName: 'Level 1',
          courseLevelId: levelId,
          date: '2026-09-10',
          roleInSession: 'teacher',
        },
      ];

      const orders = BillingCalculator.calculate(sources, mockPricings, 'teacherWagePerSession');
      expect(orders).toHaveLength(1);
      expect(orders[0].totalSessions).toBe(1);
      expect(orders[0].totalAmount).toBe(300000);
      expect(orders[0].lines[0].rate).toBe(300000);
    });

    it('Case Q10: Tính lương 1 ca cho Trợ giảng -> 100,000đ (tự động chuyển rateField sang taWage)', () => {
      const sources: BillingSource[] = [
        {
          id: 'sess-1-ta',
          ownerId: 'ta-01',
          ownerCode: 'TA01',
          ownerName: 'Trần Thị B',
          ownerMobile: '0907654321',
          ownerStatus: 'Active',
          classId: 'cls-1',
          className: 'Lớp Toán 9A',
          courseName: 'Toán',
          levelName: 'Level 1',
          courseLevelId: levelId,
          date: '2026-09-10',
          roleInSession: 'assistant',
        },
      ];

      const orders = BillingCalculator.calculate(sources, mockPricings, 'teacherWagePerSession');
      expect(orders).toHaveLength(1);
      expect(orders[0].totalSessions).toBe(1);
      expect(orders[0].totalAmount).toBe(100000);
      expect(orders[0].lines[0].rate).toBe(100000);
      expect(orders[0].lines[0].roleInSession).toBe('assistant');
    });

    it('Case Q11: 1 ca học gồm cả GV và TA -> tính chính xác 2 orders độc lập', () => {
      const sources: BillingSource[] = [
        {
          id: 'sess-1-tch',
          ownerId: 'tch-01',
          ownerCode: 'T01',
          ownerName: 'Nguyễn Văn A',
          ownerMobile: '0901234567',
          ownerStatus: 'Active',
          classId: 'cls-1',
          className: 'Lớp Toán 9A',
          courseName: 'Toán',
          levelName: 'Level 1',
          courseLevelId: levelId,
          date: '2026-09-10',
          roleInSession: 'teacher',
        },
        {
          id: 'sess-1-ta',
          ownerId: 'ta-01',
          ownerCode: 'TA01',
          ownerName: 'Trần Thị B',
          ownerMobile: '0907654321',
          ownerStatus: 'Active',
          classId: 'cls-1',
          className: 'Lớp Toán 9A',
          courseName: 'Toán',
          levelName: 'Level 1',
          courseLevelId: levelId,
          date: '2026-09-10',
          roleInSession: 'assistant',
        },
      ];

      const orders = BillingCalculator.calculate(sources, mockPricings, 'teacherWagePerSession');
      expect(orders).toHaveLength(2);
      const tchOrder = orders.find((o) => o.ownerId === 'tch-01');
      const taOrder = orders.find((o) => o.ownerId === 'ta-01');
      expect(tchOrder?.totalAmount).toBe(300000);
      expect(taOrder?.totalAmount).toBe(100000);
    });

    it('Case Q12: Tính nhiều ca dạy trong tháng cho Giáo viên (4 ca -> 1,200,000đ)', () => {
      const dates = ['2026-09-05', '2026-09-12', '2026-09-19', '2026-09-26'];
      const sources: BillingSource[] = dates.map((date, idx) => ({
        id: `sess-${idx + 1}`,
        ownerId: 'tch-01',
        ownerCode: 'T01',
        ownerName: 'Nguyễn Văn A',
        ownerMobile: '0901234567',
        ownerStatus: 'Active',
        classId: 'cls-1',
        className: 'Lớp Toán 9A',
        courseName: 'Toán',
        levelName: 'Level 1',
        courseLevelId: levelId,
        date,
        roleInSession: 'teacher',
      }));

      const orders = BillingCalculator.calculate(sources, mockPricings, 'teacherWagePerSession');
      expect(orders[0].totalSessions).toBe(4);
      expect(orders[0].totalAmount).toBe(1200000);
    });
  });
});
