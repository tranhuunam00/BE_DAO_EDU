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
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-06-30',
  },
  {
    courseLevelId: 'level-1',
    pricePerSession: 120000,
    teacherWagePerSession: 70000,
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
});
