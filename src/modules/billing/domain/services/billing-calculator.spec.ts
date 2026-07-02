import {
  BillingCalculator,
  BillingSource,
  PricingRule,
} from './billing-calculator';

const source = (
  id: string,
  ownerId: string,
  date: string,
  level = 'level-1',
): BillingSource => ({
  id,
  ownerId,
  ownerCode: `CODE-${ownerId}`,
  ownerName: `Name ${ownerId}`,
  ownerMobile: '',
  ownerStatus: 'Active',
  classId: 'class-1',
  className: 'English',
  courseName: 'English',
  levelName: 'A1',
  courseLevelId: level,
  date,
});

const pricing: PricingRule[] = [
  {
    courseLevelId: 'level-1',
    pricePerSession: 100000,
    teacherWagePerSession: 60000,
    taWagePerSession: 30000,
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-06-30',
  },
  {
    courseLevelId: 'level-1',
    pricePerSession: 120000,
    teacherWagePerSession: 70000,
    taWagePerSession: 35000,
    effectiveFrom: '2026-07-01',
    effectiveTo: null,
  },
];

describe('BillingCalculator', () => {
  it('groups sessions by owner and preserves one line per session', () => {
    const result = BillingCalculator.calculate(
      [
        source('attendance-1', 'student-1', '2026-06-01'),
        source('attendance-2', 'student-1', '2026-06-08'),
        source('attendance-3', 'student-2', '2026-07-01'),
      ],
      pricing,
      'pricePerSession',
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(
      expect.objectContaining({
        ownerId: 'student-1',
        totalSessions: 2,
        totalAmount: 200000,
      }),
    );
    expect(result[0].lines).toHaveLength(2);
    expect(result[1].totalAmount).toBe(120000);
  });

  it('uses teacher wage independently from tuition price', () => {
    const [result] = BillingCalculator.calculate(
      [source('session-1', 'teacher-1', '2026-07-10')],
      pricing,
      'teacherWagePerSession',
    );
    expect(result.totalAmount).toBe(70000);
  });

  it('creates zero-value orders when no effective pricing exists', () => {
    expect(
      BillingCalculator.calculate(
        [source('attendance-1', 'student-1', '2026-06-01', 'missing-level')],
        pricing,
        'pricePerSession',
      ),
    ).toEqual([
      expect.objectContaining({
        ownerId: 'student-1',
        totalSessions: 1,
        totalAmount: 0,
      }),
    ]);
  });

  it('uses inclusive effective date boundaries', () => {
    const result = BillingCalculator.calculate(
      [
        source('a1', 'student-1', '2026-06-30'),
        source('a2', 'student-1', '2026-07-01'),
      ],
      pricing,
      'pricePerSession',
    );
    expect(result[0].totalAmount).toBe(220000);
  });

  it('calculates mid-month price change correctly for students with sessions on both old and new prices', () => {
    const midMonthPricing: PricingRule[] = [
      {
        courseLevelId: 'level-1',
        pricePerSession: 100000,
        teacherWagePerSession: 60000,
        taWagePerSession: 30000,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-06-15',
      },
      {
        courseLevelId: 'level-1',
        pricePerSession: 150000,
        teacherWagePerSession: 90000,
        taWagePerSession: 45000,
        effectiveFrom: '2026-06-16',
        effectiveTo: null,
      },
    ];

    const result = BillingCalculator.calculate(
      [
        source('att-1', 'student-1', '2026-06-10'), // Before change -> 100,000
        source('att-2', 'student-1', '2026-06-12'), // Before change -> 100,000
        source('att-3', 'student-1', '2026-06-17'), // After change -> 150,000
        source('att-4', 'student-1', '2026-06-24'), // After change -> 150,000
      ],
      midMonthPricing,
      'pricePerSession',
    );

    expect(result).toHaveLength(1);
    expect(result[0].totalSessions).toBe(4);
    expect(result[0].totalAmount).toBe(500000); // 100k*2 + 150k*2

    // Check individual line items have the correct prices mapped
    const lines = result[0].lines;
    expect(lines).toHaveLength(4);
    expect(lines.find(l => l.sourceId === 'att-1')?.rate).toBe(100000);
    expect(lines.find(l => l.sourceId === 'att-2')?.rate).toBe(100000);
    expect(lines.find(l => l.sourceId === 'att-3')?.rate).toBe(150000);
    expect(lines.find(l => l.sourceId === 'att-4')?.rate).toBe(150000);
  });

  it('uses TA wage when source role is assistant', () => {
    const pricingWithTA: PricingRule[] = [
      {
        courseLevelId: 'level-1',
        pricePerSession: 120000,
        teacherWagePerSession: 70000,
        taWagePerSession: 35000,
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
      },
    ];
    const assistantSource = {
      ...source('session-1', 'teacher-1', '2026-07-10'),
      roleInSession: 'assistant' as const,
    };
    const [result] = BillingCalculator.calculate(
      [assistantSource],
      pricingWithTA,
      'teacherWagePerSession',
    );
    expect(result.totalAmount).toBe(35000);
  });
});
