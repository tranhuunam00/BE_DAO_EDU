import { BillingCalculator, BillingSource, PricingRule } from '../../../../../../src/modules/billing/domain/services/billing-calculator';

describe('Pricing Query Order Calculation Suite (13 Cases)', () => {
  const levelId = 'lvl-query-order-calc';

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

  describe('Nhóm 1: Tính toán ca học phức hợp và role hybrid (Cases Q13 - Q16)', () => {
    it('Case Q13: Tính nhiều ca trợ giảng trong kỳ hè (5 ca hè x 80,000đ = 400,000đ)', () => {
      const dates = ['2026-06-05', '2026-06-12', '2026-07-01', '2026-07-15', '2026-08-20'];
      const sources: BillingSource[] = dates.map((date, idx) => ({
        id: `sess-summer-${idx + 1}`,
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
        date,
        roleInSession: 'assistant',
      }));

      const orders = BillingCalculator.calculate(sources, mockPricings, 'teacherWagePerSession');
      expect(orders[0].totalSessions).toBe(5);
      expect(orders[0].totalAmount).toBe(400000);
    });

    it('Case Q14: 1 người vừa dạy chính lớp 1 vừa làm trợ giảng lớp 2 trong cùng tháng', () => {
      const sources: BillingSource[] = [
        {
          id: 'sess-m1',
          ownerId: 'user-hybrid',
          ownerCode: 'H01',
          ownerName: 'Lê Văn C',
          ownerMobile: '0909999999',
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
          id: 'sess-m2',
          ownerId: 'user-hybrid',
          ownerCode: 'H01',
          ownerName: 'Lê Văn C',
          ownerMobile: '0909999999',
          ownerStatus: 'Active',
          classId: 'cls-2',
          className: 'Lớp Toán 9B',
          courseName: 'Toán',
          levelName: 'Level 1',
          courseLevelId: levelId,
          date: '2026-09-15',
          roleInSession: 'assistant',
        },
      ];

      const orders = BillingCalculator.calculate(sources, mockPricings, 'teacherWagePerSession');
      expect(orders).toHaveLength(1);
      expect(orders[0].totalSessions).toBe(2);
      expect(orders[0].totalAmount).toBe(400000);
      expect(orders[0].lines).toHaveLength(2);
    });

    it('Case Q15: Ca học không tìm thấy cấu hình lương -> đơn giá trả về 0đ', () => {
      const sources: BillingSource[] = [
        {
          id: 'sess-no-price',
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
          date: '2026-01-15',
          roleInSession: 'teacher',
        },
      ];

      const orders = BillingCalculator.calculate(sources, mockPricings, 'teacherWagePerSession');
      expect(orders[0].totalAmount).toBe(0);
      expect(orders[0].lines[0].rate).toBe(0);
    });

    it('Case Q16: Ca học có ngày định dạng kèm giờ ISO -> cắt chuẩn 10 ký tự ngày', () => {
      const sources: BillingSource[] = [
        {
          id: 'sess-iso',
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
          date: '2026-09-15T08:30:00.000Z',
          roleInSession: 'teacher',
        },
      ];

      const orders = BillingCalculator.calculate(sources, mockPricings, 'teacherWagePerSession');
      expect(orders[0].totalAmount).toBe(300000);
    });
  });

  describe('Nhóm 2: Tính học phí học viên & Ưu tiên biểu giá (Cases Q17 - Q25)', () => {
    it('Case Q17: Tính học phí học viên tham gia học đầy đủ -> 200,000đ', () => {
      const sources: BillingSource[] = [
        {
          id: 'att-1',
          ownerId: 'stu-01',
          ownerCode: 'S01',
          ownerName: 'Học sinh X',
          ownerMobile: '0912345678',
          ownerStatus: 'Studying',
          classId: 'cls-1',
          className: 'Lớp Toán 9A',
          courseName: 'Toán',
          levelName: 'Level 1',
          courseLevelId: levelId,
          date: '2026-09-10',
          isPresent: true,
        },
      ];

      const orders = BillingCalculator.calculate(sources, mockPricings, 'pricePerSession');
      expect(orders[0].totalAmount).toBe(200000);
      expect(orders[0].totalSessions).toBe(1);
    });

    it('Case Q18: Học sinh vắng mặt (isPresent: false) -> đơn giá buổi đó tính 0đ', () => {
      const sources: BillingSource[] = [
        {
          id: 'att-absent',
          ownerId: 'stu-01',
          ownerCode: 'S01',
          ownerName: 'Học sinh X',
          ownerMobile: '0912345678',
          ownerStatus: 'Studying',
          classId: 'cls-1',
          className: 'Lớp Toán 9A',
          courseName: 'Toán',
          levelName: 'Level 1',
          courseLevelId: levelId,
          date: '2026-09-10',
          isPresent: false,
        },
      ];

      const orders = BillingCalculator.calculate(sources, mockPricings, 'pricePerSession');
      expect(orders[0].totalAmount).toBe(0);
      expect(orders[0].totalSessions).toBe(0);
    });

    it('Case Q19: Học sinh học 3 buổi có mặt, 1 buổi vắng mặt -> tính 3 buổi = 600,000đ', () => {
      const sources: BillingSource[] = [
        {
          id: 'att-1',
          ownerId: 'stu-01',
          ownerCode: 'S01',
          ownerName: 'Học sinh X',
          ownerMobile: '0912345678',
          ownerStatus: 'Studying',
          classId: 'cls-1',
          className: 'Lớp Toán 9A',
          courseName: 'Toán',
          levelName: 'Level 1',
          courseLevelId: levelId,
          date: '2026-09-05',
          isPresent: true,
        },
        {
          id: 'att-2',
          ownerId: 'stu-01',
          ownerCode: 'S01',
          ownerName: 'Học sinh X',
          ownerMobile: '0912345678',
          ownerStatus: 'Studying',
          classId: 'cls-1',
          className: 'Lớp Toán 9A',
          courseName: 'Toán',
          levelName: 'Level 1',
          courseLevelId: levelId,
          date: '2026-09-12',
          isPresent: true,
        },
        {
          id: 'att-3',
          ownerId: 'stu-01',
          ownerCode: 'S01',
          ownerName: 'Học sinh X',
          ownerMobile: '0912345678',
          ownerStatus: 'Studying',
          classId: 'cls-1',
          className: 'Lớp Toán 9A',
          courseName: 'Toán',
          levelName: 'Level 1',
          courseLevelId: levelId,
          date: '2026-09-19',
          isPresent: false,
        },
        {
          id: 'att-4',
          ownerId: 'stu-01',
          ownerCode: 'S01',
          ownerName: 'Học sinh X',
          ownerMobile: '0912345678',
          ownerStatus: 'Studying',
          classId: 'cls-1',
          className: 'Lớp Toán 9A',
          courseName: 'Toán',
          levelName: 'Level 1',
          courseLevelId: levelId,
          date: '2026-09-26',
          isPresent: true,
        },
      ];

      const orders = BillingCalculator.calculate(sources, mockPricings, 'pricePerSession');
      expect(orders[0].totalSessions).toBe(3);
      expect(orders[0].totalAmount).toBe(600000);
    });

    it('Case Q20: Sắp xếp ưu tiên biểu giá mới tạo hơn (createdAt mới hơn)', () => {
      const overlappingRules: PricingRule[] = [
        {
          id: 'p-old',
          courseLevelId: levelId,
          pricePerSession: 180000,
          teacherWagePerSession: 0,
          taWagePerSession: 0,
          effectiveFrom: '2026-09-01',
          effectiveTo: '2026-12-31',
          createdAt: new Date('2026-08-01T08:00:00Z'),
        },
        {
          id: 'p-new',
          courseLevelId: levelId,
          pricePerSession: 220000,
          teacherWagePerSession: 0,
          taWagePerSession: 0,
          effectiveFrom: '2026-09-01',
          effectiveTo: '2026-12-31',
          createdAt: new Date('2026-08-15T08:00:00Z'),
        },
      ];

      const pricing = BillingCalculator.getActivePricing(overlappingRules, '2026-09-10', 'pricePerSession', levelId);
      expect(Number(pricing?.pricePerSession)).toBe(220000);
      expect(pricing?.id).toBe('p-new');
    });

    it('Case Q21: Sắp xếp ưu tiên ID giảm dần khi createdAt bằng nhau', () => {
      const now = new Date('2026-08-01T08:00:00Z');
      const rules: PricingRule[] = [
        {
          id: 'id-aaa',
          courseLevelId: levelId,
          pricePerSession: 150000,
          teacherWagePerSession: 0,
          taWagePerSession: 0,
          effectiveFrom: '2026-09-01',
          effectiveTo: '2026-12-31',
          createdAt: now,
        },
        {
          id: 'id-zzz',
          courseLevelId: levelId,
          pricePerSession: 250000,
          teacherWagePerSession: 0,
          taWagePerSession: 0,
          effectiveFrom: '2026-09-01',
          effectiveTo: '2026-12-31',
          createdAt: now,
        },
      ];

      const pricing = BillingCalculator.getActivePricing(rules, '2026-09-10', 'pricePerSession', levelId);
      expect(pricing?.id).toBe('id-zzz');
      expect(Number(pricing?.pricePerSession)).toBe(250000);
    });

    it('Case Q22: Sắp xếp ưu tiên ngày bắt đầu muộn hơn khi không có createdAt', () => {
      const rules: PricingRule[] = [
        {
          id: 'r1',
          courseLevelId: levelId,
          pricePerSession: 150000,
          teacherWagePerSession: 0,
          taWagePerSession: 0,
          effectiveFrom: '2026-08-01',
          effectiveTo: '2026-12-31',
        },
        {
          id: 'r2',
          courseLevelId: levelId,
          pricePerSession: 200000,
          teacherWagePerSession: 0,
          taWagePerSession: 0,
          effectiveFrom: '2026-09-01',
          effectiveTo: '2026-12-31',
        },
      ];

      const sorted = BillingCalculator.sortPricings(rules);
      expect(sorted[0].id).toBe('r2');
    });

    it('Case Q23: Không tính thù lao cho giáo viên nếu nguồn rỗng (sources = [])', () => {
      const orders = BillingCalculator.calculate([], mockPricings, 'teacherWagePerSession');
      expect(orders).toHaveLength(0);
    });

    it('Case Q24: Không tính học phí nếu bảng giá rỗng (pricings = [])', () => {
      const sources: BillingSource[] = [
        {
          id: 'att-1',
          ownerId: 'stu-01',
          ownerCode: 'S01',
          ownerName: 'Học sinh X',
          ownerMobile: '0912345678',
          ownerStatus: 'Studying',
          classId: 'cls-1',
          className: 'Lớp Toán 9A',
          courseName: 'Toán',
          levelName: 'Level 1',
          courseLevelId: levelId,
          date: '2026-09-10',
          isPresent: true,
        },
      ];

      const orders = BillingCalculator.calculate(sources, [], 'pricePerSession');
      expect(orders[0].totalAmount).toBe(0);
    });

    it('Case Q25: Group các ca cùng rate và cùng role vào đúng 1 billing line', () => {
      const sources: BillingSource[] = [
        {
          id: 's1',
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
          date: '2026-09-05',
          roleInSession: 'teacher',
        },
        {
          id: 's2',
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
          date: '2026-09-12',
          roleInSession: 'teacher',
        },
      ];

      const orders = BillingCalculator.calculate(sources, mockPricings, 'teacherWagePerSession');
      expect(orders[0].lines).toHaveLength(1);
      expect(orders[0].lines[0].sessionsCount).toBe(2);
      expect(orders[0].lines[0].totalAmount).toBe(600000);
      expect(orders[0].lines[0].sourceIds).toEqual(['s1', 's2']);
    });
  });
});
