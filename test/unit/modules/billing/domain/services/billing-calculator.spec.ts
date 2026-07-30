import {
  BillingCalculator,
  BillingSource,
  PricingRule,
} from '../../../../../../src/modules/billing/domain/services/billing-calculator';

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
  it('groups sessions by owner and class+rate into aggregated lines', () => {
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
    // Same class + same rate → grouped into 1 line
    expect(result[0].lines).toHaveLength(1);
    expect(result[0].lines[0].sessionsCount).toBe(2);
    expect(result[0].lines[0].sourceIds).toEqual(['attendance-1', 'attendance-2']);
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

    // Check that lines are grouped by rate: 2 lines (100k and 150k)
    const lines = result[0].lines;
    expect(lines).toHaveLength(2);
    const line100k = lines.find(l => l.rate === 100000);
    const line150k = lines.find(l => l.rate === 150000);
    expect(line100k).toBeDefined();
    expect(line100k!.sessionsCount).toBe(2);
    expect(line100k!.totalAmount).toBe(200000);
    expect(line100k!.sourceIds).toEqual(expect.arrayContaining(['att-1', 'att-2']));
    expect(line150k).toBeDefined();
    expect(line150k!.sessionsCount).toBe(2);
    expect(line150k!.totalAmount).toBe(300000);
    expect(line150k!.sourceIds).toEqual(expect.arrayContaining(['att-3', 'att-4']));
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

  it('calculates absent sessions at 0 rate and groups them in a separate line with 0 totalAmount, and totalSessions only counts present ones', () => {
    const tuitionPricing: PricingRule[] = [
      {
        courseLevelId: 'level-1',
        pricePerSession: 150000,
        teacherWagePerSession: 90000,
        taWagePerSession: 45000,
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
      },
    ];

    const sources = [
      { ...source('att-1', 'student-1', '2026-06-10'), isPresent: true }, // Present -> 150k
      { ...source('att-2', 'student-1', '2026-06-12'), isPresent: false }, // Absent -> 0
      { ...source('att-3', 'student-1', '2026-06-14'), isPresent: true }, // Present -> 150k
      { ...source('att-4', 'student-1', '2026-06-16'), isPresent: false }, // Absent -> 0
    ];

    const result = BillingCalculator.calculate(
      sources,
      tuitionPricing,
      'pricePerSession',
    );

    expect(result).toHaveLength(1);
    const order = result[0];
    // Total tuition = 150k * 2 = 300k
    expect(order.totalAmount).toBe(300000);
    // Only 2 present sessions are counted in totalSessions
    expect(order.totalSessions).toBe(2);

    expect(order.lines).toHaveLength(2);
    const presentLine = order.lines.find((l) => l.rate === 150000);
    const absentLine = order.lines.find((l) => l.rate === 0);

    expect(presentLine).toBeDefined();
    expect(presentLine!.sessionsCount).toBe(2);
    expect(presentLine!.totalAmount).toBe(300000);
    expect(presentLine!.sourceIds).toEqual(expect.arrayContaining(['att-1', 'att-3']));

    expect(absentLine).toBeDefined();
    expect(absentLine!.sessionsCount).toBe(2);
    expect(absentLine!.totalAmount).toBe(0);
    expect(absentLine!.sourceIds).toEqual(expect.arrayContaining(['att-2', 'att-4']));
  });

  it('handles mid-month price changes with absences: correctly bills present sessions at their respective active rates, bills absent sessions at 0 rate, and groups them', () => {
    const midMonthPricing: PricingRule[] = [
      {
        courseLevelId: 'level-1',
        pricePerSession: 100000,
        teacherWagePerSession: 60000,
        taWagePerSession: 30000,
        effectiveFrom: '2026-06-01',
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

    const sources = [
      { ...source('att-1', 'student-1', '2026-06-10'), isPresent: true }, // Present before change -> 100k
      { ...source('att-2', 'student-1', '2026-06-12'), isPresent: false }, // Absent before change -> 0đ (normally 100k)
      { ...source('att-3', 'student-1', '2026-06-17'), isPresent: true }, // Present after change -> 150k
      { ...source('att-4', 'student-1', '2026-06-20'), isPresent: false }, // Absent after change -> 0đ (normally 150k)
    ];

    const [order] = BillingCalculator.calculate(
      sources,
      midMonthPricing,
      'pricePerSession',
    );

    // Total tuition = 100k + 150k = 250k
    expect(order.totalAmount).toBe(250000);
    // Only 2 present sessions counted
    expect(order.totalSessions).toBe(2);

    // Lines: 100k line (count 1), 150k line (count 1), 0đ line (count 2)
    expect(order.lines).toHaveLength(3);
    const line100k = order.lines.find((l) => l.rate === 100000);
    const line150k = order.lines.find((l) => l.rate === 150000);
    const line0 = order.lines.find((l) => l.rate === 0);

    expect(line100k).toBeDefined();
    expect(line100k!.sessionsCount).toBe(1);
    expect(line100k!.totalAmount).toBe(100000);
    expect(line100k!.sourceIds).toEqual(['att-1']);

    expect(line150k).toBeDefined();
    expect(line150k!.sessionsCount).toBe(1);
    expect(line150k!.totalAmount).toBe(150000);
    expect(line150k!.sourceIds).toEqual(['att-3']);

    expect(line0).toBeDefined();
    expect(line0!.sessionsCount).toBe(2);
    expect(line0!.totalAmount).toBe(0);
    expect(line0!.sourceIds).toEqual(expect.arrayContaining(['att-2', 'att-4']));
  });

  it('handles missing pricing rules: bills missing level present sessions at 0 rate (but counts in totalSessions) and absent ones at 0 rate (does not count)', () => {
    const tuitionPricing: PricingRule[] = [
      {
        courseLevelId: 'level-1',
        pricePerSession: 100000,
        teacherWagePerSession: 60000,
        taWagePerSession: 30000,
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
      },
    ];

    const sources = [
      { ...source('att-1', 'student-1', '2026-06-10', 'level-1'), isPresent: true }, // Present, has price -> 100k
      { ...source('att-2', 'student-1', '2026-06-12', 'missing-level'), isPresent: true }, // Present, no price -> 0đ
      { ...source('att-3', 'student-1', '2026-06-14', 'level-1'), isPresent: false }, // Absent, has price -> 0đ
      { ...source('att-4', 'student-1', '2026-06-16', 'missing-level'), isPresent: false }, // Absent, no price -> 0đ
    ];

    const [order] = BillingCalculator.calculate(
      sources,
      tuitionPricing,
      'pricePerSession',
    );

    // Total tuition = 100k + 0 + 0 + 0 = 100k
    expect(order.totalAmount).toBe(100000);
    // 2 present sessions counted (att-1 and att-2)
    expect(order.totalSessions).toBe(2);

    // Grouping: 1 line at 100k (count 1), 1 line at 0đ (count 3: att-2, att-3, att-4)
    expect(order.lines).toHaveLength(2);
    const line100k = order.lines.find((l) => l.rate === 100000);
    const line0 = order.lines.find((l) => l.rate === 0);

    expect(line100k).toBeDefined();
    expect(line100k!.sessionsCount).toBe(1);
    expect(line100k!.totalAmount).toBe(100000);
    expect(line100k!.sourceIds).toEqual(['att-1']);

    expect(line0).toBeDefined();
    expect(line0!.sessionsCount).toBe(3);
    expect(line0!.totalAmount).toBe(0);
    expect(line0!.sourceIds).toEqual(expect.arrayContaining(['att-2', 'att-3', 'att-4']));
  });
});
