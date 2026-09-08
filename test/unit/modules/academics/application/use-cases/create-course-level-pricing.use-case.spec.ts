import { CreateCourseLevelPricingUseCase } from '../../../../../../src/modules/academics/application/use-cases/create-course-level-pricing.use-case';
import { CoursePricingPersistencePort, CoursePricingRecord } from '../../../../../../src/modules/academics/application/ports/course-pricing-persistence.port';
import { AcademicError } from '../../../../../../src/modules/academics/domain/errors/academic.error';

describe('CreateCourseLevelPricingUseCase - Mandatory EffectiveTo & Guard Validations (Cases C01 - C12)', () => {
  let useCase: CreateCourseLevelPricingUseCase;
  let mockPersistence: jest.Mocked<CoursePricingPersistencePort>;

  const levelId = 'level-math-9';

  beforeEach(() => {
    mockPersistence = {
      findPricingByLevelId: jest.fn().mockResolvedValue([]),
      findPricingById: jest.fn().mockResolvedValue(null),
      findActivePricing: jest.fn().mockResolvedValue(null),
      createPricing: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'new-pricing-id', ...data })),
      savePricing: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      deletePricing: jest.fn().mockResolvedValue(undefined),
      checkStudentBills: jest.fn().mockResolvedValue(false),
      checkTeacherWages: jest.fn().mockResolvedValue(false),
      checkAssistantWages: jest.fn().mockResolvedValue(false),
      getMaxStudentBillDate: jest.fn().mockResolvedValue(null),
      getMaxTeacherWageDate: jest.fn().mockResolvedValue(null),
      getMaxAssistantWageDate: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<CoursePricingPersistencePort>;

    useCase = new CreateCourseLevelPricingUseCase(mockPersistence);
  });

  // Case C01: effectiveTo is missing, null, undefined or empty string
  it('Case C01: should reject with BAD_REQUEST if effectiveTo is missing, null, or empty string', async () => {
    await expect(useCase.execute(levelId, {
      effectiveFrom: '2026-03-01',
      effectiveTo: null as any,
      pricePerSession: 150000,
    })).rejects.toThrow(AcademicError);

    await expect(useCase.execute(levelId, {
      effectiveFrom: '2026-03-01',
      effectiveTo: undefined as any,
      pricePerSession: 150000,
    })).rejects.toThrow(AcademicError);

    await expect(useCase.execute(levelId, {
      effectiveFrom: '2026-03-01',
      effectiveTo: '',
      pricePerSession: 150000,
    })).rejects.toThrow(AcademicError);
  });

  // Case C02: effectiveFrom is missing, null, undefined or empty string
  it('Case C02: should reject with BAD_REQUEST if effectiveFrom is missing or empty', async () => {
    await expect(useCase.execute(levelId, {
      effectiveFrom: '' as any,
      effectiveTo: '2026-03-31',
      pricePerSession: 150000,
    })).rejects.toThrow(AcademicError);
  });

  // Case C03: effectiveTo < effectiveFrom
  it('Case C03: should reject with BAD_REQUEST if effectiveTo is before effectiveFrom', async () => {
    await expect(useCase.execute(levelId, {
      effectiveFrom: '2026-03-31',
      effectiveTo: '2026-03-01',
      pricePerSession: 150000,
    })).rejects.toThrow(AcademicError);
  });

  // Case C04: Single day pricing (effectiveTo === effectiveFrom)
  it('Case C04: should allow single-day pricing where effectiveTo equals effectiveFrom', async () => {
    const result = await useCase.execute(levelId, {
      effectiveFrom: '2026-05-15',
      effectiveTo: '2026-05-15',
      pricePerSession: 200000,
    });
    expect(result.effectiveFrom).toBe('2026-05-15');
    expect(result.effectiveTo).toBe('2026-05-15');
  });

  // Case C05: ISO date string sanitized to YYYY-MM-DD
  it('Case C05: should sanitize ISO timestamp strings to clean YYYY-MM-DD dates', async () => {
    const result = await useCase.execute(levelId, {
      effectiveFrom: '2026-06-01T00:00:00.000Z',
      effectiveTo: '2026-06-30T23:59:59.999Z',
      pricePerSession: 180000,
    });
    expect(result.effectiveFrom).toBe('2026-06-01');
    expect(result.effectiveTo).toBe('2026-06-30');
  });

  // Case C06: Reject negative amounts
  it('Case C06: should reject negative pricePerSession, teacherWage, or assistantWage', async () => {
    await expect(useCase.execute(levelId, {
      effectiveFrom: '2026-07-01',
      effectiveTo: '2026-07-31',
      pricePerSession: -100000,
    })).rejects.toThrow(AcademicError);

    await expect(useCase.execute(levelId, {
      effectiveFrom: '2026-07-01',
      effectiveTo: '2026-07-31',
      teacherWagePerSession: -50000,
    })).rejects.toThrow(AcademicError);

    await expect(useCase.execute(levelId, {
      effectiveFrom: '2026-07-01',
      effectiveTo: '2026-07-31',
      taWagePerSession: -30000,
    })).rejects.toThrow(AcademicError);
  });

  // Case C07: Lock check - creating pricing fully in billed past
  it('Case C07: should reject creating pricing where effectiveTo <= maxBilledDate', async () => {
    mockPersistence.getMaxStudentBillDate.mockResolvedValue('2026-03-15');

    await expect(useCase.execute(levelId, {
      effectiveFrom: '2026-02-01',
      effectiveTo: '2026-02-28',
      pricePerSession: 150000,
    })).rejects.toThrow(AcademicError);
  });

  // Case C08: Lock check - effectiveFrom <= maxStudentBillDate
  it('Case C08: should reject if effectiveFrom <= maxStudentBillDate when pricePerSession is provided', async () => {
    mockPersistence.getMaxStudentBillDate.mockResolvedValue('2026-03-15');

    await expect(useCase.execute(levelId, {
      effectiveFrom: '2026-03-10',
      effectiveTo: '2026-04-10',
      pricePerSession: 200000,
    })).rejects.toThrow(AcademicError);
  });

  // Case C09: Overlap collision with existing closed intervals
  it('Case C09: should reject if date range overlaps or touches an existing pricing record', async () => {
    const existing: CoursePricingRecord = {
      id: 'existing-p1',
      courseLevelId: levelId,
      effectiveFrom: '2026-04-01',
      effectiveTo: '2026-04-30',
      pricePerSession: 150000,
      teacherWagePerSession: 100000,
      taWagePerSession: 50000,
    };
    mockPersistence.findPricingByLevelId.mockResolvedValue([existing]);

    await expect(useCase.execute(levelId, {
      effectiveFrom: '2026-04-15',
      effectiveTo: '2026-05-15',
      pricePerSession: 180000,
    })).rejects.toThrow(AcademicError);
  });

  // Case C10: Overlap collision with legacy open-ended interval (effectiveTo = null)
  it('Case C10: should reject if date range overlaps with a legacy open-ended record (effectiveTo is null)', async () => {
    const legacyRecord: CoursePricingRecord = {
      id: 'legacy-p1',
      courseLevelId: levelId,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      pricePerSession: 150000,
      teacherWagePerSession: 100000,
      taWagePerSession: 50000,
    };
    mockPersistence.findPricingByLevelId.mockResolvedValue([legacyRecord]);

    await expect(useCase.execute(levelId, {
      effectiveFrom: '2026-06-01',
      effectiveTo: '2026-06-30',
      pricePerSession: 200000,
    })).rejects.toThrow(AcademicError);
  });

  // Case C11: Clean creation in valid non-overlapping range
  it('Case C11: should successfully create pricing when interval is completely clean and non-overlapping', async () => {
    const existing: CoursePricingRecord = {
      id: 'existing-p1',
      courseLevelId: levelId,
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-03-31',
      pricePerSession: 150000,
      teacherWagePerSession: 100000,
      taWagePerSession: 50000,
    };
    mockPersistence.findPricingByLevelId.mockResolvedValue([existing]);

    const result = await useCase.execute(levelId, {
      effectiveFrom: '2026-04-01',
      effectiveTo: '2026-06-30',
      pricePerSession: 200000,
      teacherWagePerSession: 120000,
      taWagePerSession: 60000,
    });

    expect(result).toBeDefined();
    expect(result.effectiveFrom).toBe('2026-04-01');
    expect(result.effectiveTo).toBe('2026-06-30');
    expect(mockPersistence.createPricing).toHaveBeenCalledWith(expect.objectContaining({
      courseLevelId: levelId,
      effectiveFrom: '2026-04-01',
      effectiveTo: '2026-06-30',
      pricePerSession: 200000,
      teacherWagePerSession: 120000,
      taWagePerSession: 60000,
    }));
  });

  // Case C12: Partial rates inherit from prior pricing or default to 0
  it('Case C12: should inherit unset rates from prior pricing or default to 0', async () => {
    const existing: CoursePricingRecord = {
      id: 'existing-p1',
      courseLevelId: levelId,
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-03-31',
      pricePerSession: 150000,
      teacherWagePerSession: 100000,
      taWagePerSession: 50000,
    };
    mockPersistence.findPricingByLevelId.mockResolvedValue([existing]);

    await useCase.execute(levelId, {
      effectiveFrom: '2026-04-01',
      effectiveTo: '2026-06-30',
      pricePerSession: 220000,
      // teacherWage and taWage not provided
    });

    expect(mockPersistence.createPricing).toHaveBeenCalledWith(expect.objectContaining({
      courseLevelId: levelId,
      pricePerSession: 220000,
      teacherWagePerSession: 100000, // inherited
      taWagePerSession: 50000, // inherited
    }));
  });

  // Case C13: Non-leap year 29/02 and invalid calendar dates
  it('Case C13: should reject non-leap year 29/02 and invalid calendar dates', async () => {
    await expect(useCase.execute(levelId, {
      effectiveFrom: '2026-02-01',
      effectiveTo: '2026-02-29', // 2026 is not a leap year
      pricePerSession: 150000,
    })).rejects.toThrow(AcademicError);

    await expect(useCase.execute(levelId, {
      effectiveFrom: '2026-04-01',
      effectiveTo: '2026-04-31', // April has only 30 days
      pricePerSession: 150000,
    })).rejects.toThrow(AcademicError);
  });

  // Case C14: Leap year 29/02 acceptance
  it('Case C14: should accept leap year February 29 (2024-02-29)', async () => {
    const result = await useCase.execute(levelId, {
      effectiveFrom: '2024-02-01',
      effectiveTo: '2024-02-29',
      pricePerSession: 150000,
    });
    expect(result.effectiveTo).toBe('2024-02-29');
  });

  // Case C15: Lock check - effectiveFrom <= maxTeacherWageDate
  it('Case C15: should reject if effectiveFrom <= maxTeacherWageDate when teacherWage is provided', async () => {
    mockPersistence.getMaxTeacherWageDate.mockResolvedValue('2026-04-15');

    await expect(useCase.execute(levelId, {
      effectiveFrom: '2026-04-10',
      effectiveTo: '2026-05-10',
      teacherWagePerSession: 150000,
    })).rejects.toThrow(AcademicError);
  });

  // Case C16: Lock check - effectiveFrom <= maxAssistantWageDate
  it('Case C16: should reject if effectiveFrom <= maxAssistantWageDate when taWage is provided', async () => {
    mockPersistence.getMaxAssistantWageDate.mockResolvedValue('2026-04-15');

    await expect(useCase.execute(levelId, {
      effectiveFrom: '2026-04-10',
      effectiveTo: '2026-05-10',
      taWagePerSession: 80000,
    })).rejects.toThrow(AcademicError);
  });

  // Case C17: Boundary touch left (effectiveTo === existing.effectiveFrom) -> "Chạm là Chặn"
  it('Case C17: should reject new pricing touching left boundary of existing record (Chạm là Chặn)', async () => {
    const existing: CoursePricingRecord = {
      id: 'existing-p1',
      courseLevelId: levelId,
      effectiveFrom: '2026-03-01',
      effectiveTo: '2026-03-31',
      pricePerSession: 150000,
      teacherWagePerSession: 100000,
      taWagePerSession: 50000,
    };
    mockPersistence.findPricingByLevelId.mockResolvedValue([existing]);

    await expect(useCase.execute(levelId, {
      effectiveFrom: '2026-02-01',
      effectiveTo: '2026-03-01', // Touches existing start '2026-03-01'
      pricePerSession: 160000,
    })).rejects.toThrow(AcademicError);
  });

  // Case C18: Boundary touch right (effectiveFrom === existing.effectiveTo) -> "Chạm là Chặn"
  it('Case C18: should reject new pricing touching right boundary of existing record (Chạm là Chặn)', async () => {
    const existing: CoursePricingRecord = {
      id: 'existing-p1',
      courseLevelId: levelId,
      effectiveFrom: '2026-03-01',
      effectiveTo: '2026-03-31',
      pricePerSession: 150000,
      teacherWagePerSession: 100000,
      taWagePerSession: 50000,
    };
    mockPersistence.findPricingByLevelId.mockResolvedValue([existing]);

    await expect(useCase.execute(levelId, {
      effectiveFrom: '2026-03-31', // Touches existing end '2026-03-31'
      effectiveTo: '2026-04-30',
      pricePerSession: 160000,
    })).rejects.toThrow(AcademicError);
  });

  // Case C19: Sub-interval (Completely inside existing interval)
  it('Case C19: should reject new pricing completely inside an existing range', async () => {
    const existing: CoursePricingRecord = {
      id: 'existing-p1',
      courseLevelId: levelId,
      effectiveFrom: '2026-03-01',
      effectiveTo: '2026-03-31',
      pricePerSession: 150000,
      teacherWagePerSession: 100000,
      taWagePerSession: 50000,
    };
    mockPersistence.findPricingByLevelId.mockResolvedValue([existing]);

    await expect(useCase.execute(levelId, {
      effectiveFrom: '2026-03-10',
      effectiveTo: '2026-03-20',
      pricePerSession: 160000,
    })).rejects.toThrow(AcademicError);
  });

  // Case C20: Super-interval (Completely engulfing existing interval)
  it('Case C20: should reject new pricing completely engulfing an existing interval', async () => {
    const existing: CoursePricingRecord = {
      id: 'existing-p1',
      courseLevelId: levelId,
      effectiveFrom: '2026-03-01',
      effectiveTo: '2026-03-31',
      pricePerSession: 150000,
      teacherWagePerSession: 100000,
      taWagePerSession: 50000,
    };
    mockPersistence.findPricingByLevelId.mockResolvedValue([existing]);

    await expect(useCase.execute(levelId, {
      effectiveFrom: '2026-02-15',
      effectiveTo: '2026-04-15',
      pricePerSession: 160000,
    })).rejects.toThrow(AcademicError);
  });

  // Case C21: Clean fit in gap between two intervals
  it('Case C21: should allow new pricing that fits cleanly in the gap between two existing intervals', async () => {
    const p1: CoursePricingRecord = {
      id: 'p1',
      courseLevelId: levelId,
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-01-31',
      pricePerSession: 150000,
      teacherWagePerSession: 100000,
      taWagePerSession: 50000,
    };
    const p2: CoursePricingRecord = {
      id: 'p2',
      courseLevelId: levelId,
      effectiveFrom: '2026-03-01',
      effectiveTo: '2026-03-31',
      pricePerSession: 180000,
      teacherWagePerSession: 120000,
      taWagePerSession: 60000,
    };
    mockPersistence.findPricingByLevelId.mockResolvedValue([p1, p2]);

    const result = await useCase.execute(levelId, {
      effectiveFrom: '2026-02-01',
      effectiveTo: '2026-02-28',
      pricePerSession: 160000,
    });
    expect(result.effectiveFrom).toBe('2026-02-01');
    expect(result.effectiveTo).toBe('2026-02-28');
  });

  // Case C22: Brand new level with empty pricing history
  it('Case C22: should successfully create pricing for a brand new level with 0 prior records', async () => {
    mockPersistence.findPricingByLevelId.mockResolvedValue([]);

    const result = await useCase.execute('new-level-id', {
      effectiveFrom: '2026-09-01',
      effectiveTo: '2026-12-31',
      pricePerSession: 250000,
      teacherWagePerSession: 150000,
      taWagePerSession: 70000,
    });
    expect(result).toBeDefined();
    expect(mockPersistence.createPricing).toHaveBeenCalledWith(expect.objectContaining({
      courseLevelId: 'new-level-id',
      pricePerSession: 250000,
      teacherWagePerSession: 150000,
      taWagePerSession: 70000,
      effectiveFrom: '2026-09-01',
      effectiveTo: '2026-12-31',
    }));
  });

  // Case C23: Extreme amounts up to 100,000,000 VND
  it('Case C23: should accept large amounts up to 100,000,000 VND', async () => {
    const result = await useCase.execute(levelId, {
      effectiveFrom: '2026-10-01',
      effectiveTo: '2026-10-31',
      pricePerSession: 100000000,
      teacherWagePerSession: 50000000,
      taWagePerSession: 20000000,
    });
    expect(result).toBeDefined();
  });

  // Case C24: Date range crossing calendar years
  it('Case C24: should allow pricing timeline crossing across different calendar years', async () => {
    const result = await useCase.execute(levelId, {
      effectiveFrom: '2025-11-01',
      effectiveTo: '2026-02-28',
      pricePerSession: 170000,
    });
    expect(result.effectiveFrom).toBe('2025-11-01');
    expect(result.effectiveTo).toBe('2026-02-28');
  });

  // Case C25: Whitespace trimming in date strings
  it('Case C25: should sanitize date strings with leading/trailing whitespaces', async () => {
    const result = await useCase.execute(levelId, {
      effectiveFrom: '  2026-08-01  ',
      effectiveTo: '  2026-08-31  ',
      pricePerSession: 190000,
    });
    expect(result.effectiveFrom).toBe('2026-08-01');
    expect(result.effectiveTo).toBe('2026-08-31');
  });
});

