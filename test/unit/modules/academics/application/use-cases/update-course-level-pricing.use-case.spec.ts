import { UpdateCourseLevelPricingUseCase } from '../../../../../../src/modules/academics/application/use-cases/update-course-level-pricing.use-case';
import { CoursePricingPersistencePort, CoursePricingRecord } from '../../../../../../src/modules/academics/application/ports/course-pricing-persistence.port';
import { AcademicError } from '../../../../../../src/modules/academics/domain/errors/academic.error';

describe('UpdateCourseLevelPricingUseCase - Mandatory EffectiveTo & Boundary Guards (Cases U01 - U08)', () => {
  let useCase: UpdateCourseLevelPricingUseCase;
  let mockPersistence: jest.Mocked<CoursePricingPersistencePort>;

  const levelId = 'level-math-9';
  const pricingId = 'pricing-123';

  const defaultPricing: CoursePricingRecord = {
    id: pricingId,
    courseLevelId: levelId,
    pricePerSession: 150000,
    teacherWagePerSession: 100000,
    taWagePerSession: 50000,
    effectiveFrom: '2026-05-01',
    effectiveTo: '2026-05-31',
  };

  beforeEach(() => {
    mockPersistence = {
      findPricingById: jest.fn().mockResolvedValue({ ...defaultPricing }),
      findPricingByLevelId: jest.fn().mockResolvedValue([{ ...defaultPricing }]),
      findActivePricing: jest.fn().mockResolvedValue(null),
      createPricing: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      savePricing: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      deletePricing: jest.fn().mockResolvedValue(undefined),
      checkStudentBills: jest.fn().mockResolvedValue(false),
      checkTeacherWages: jest.fn().mockResolvedValue(false),
      checkAssistantWages: jest.fn().mockResolvedValue(false),
      getMaxStudentBillDate: jest.fn().mockResolvedValue(null),
      getMaxTeacherWageDate: jest.fn().mockResolvedValue(null),
      getMaxAssistantWageDate: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<CoursePricingPersistencePort>;

    useCase = new UpdateCourseLevelPricingUseCase(mockPersistence);
  });

  // Case U01: Setting effectiveTo to null or empty string is rejected
  it('Case U01: should reject if effectiveTo is updated to null, undefined, or empty string', async () => {
    await expect(useCase.execute(pricingId, {
      effectiveTo: null as any,
    })).rejects.toThrow(AcademicError);

    await expect(useCase.execute(pricingId, {
      effectiveTo: '',
    })).rejects.toThrow(AcademicError);
  });

  // Case U02: Setting effectiveTo < effectiveFrom is rejected
  it('Case U02: should reject if effectiveTo is updated to be before effectiveFrom', async () => {
    await expect(useCase.execute(pricingId, {
      effectiveTo: '2026-04-01', // Before 2026-05-01
    })).rejects.toThrow(AcademicError);
  });

  // Case U03: Successful date update
  it('Case U03: should successfully update effectiveTo when date is valid and non-overlapping', async () => {
    const result = await useCase.execute(pricingId, {
      effectiveTo: '2026-06-15',
    });
    expect(result.effectiveTo).toBe('2026-06-15');
    expect(mockPersistence.savePricing).toHaveBeenCalledWith(expect.objectContaining({
      id: pricingId,
      effectiveTo: '2026-06-15',
    }));
  });

  // Case U04: Self-exclusion - changing amounts or same range does not collide with self
  it('Case U04: should ignore self record ID when validating range collision', async () => {
    const result = await useCase.execute(pricingId, {
      pricePerSession: 200000,
    });
    expect(result.pricePerSession).toBe(200000);
    expect(result.effectiveTo).toBe('2026-05-31');
  });

  // Case U05: Collision with another record in the same level
  it('Case U05: should reject if updated range collides with another existing pricing record', async () => {
    const otherPricing: CoursePricingRecord = {
      id: 'other-pricing-456',
      courseLevelId: levelId,
      pricePerSession: 180000,
      teacherWagePerSession: 120000,
      taWagePerSession: 60000,
      effectiveFrom: '2026-06-01',
      effectiveTo: '2026-06-30',
    };
    mockPersistence.findPricingByLevelId.mockResolvedValue([
      { ...defaultPricing },
      otherPricing,
    ]);

    // Extending effectiveTo to 2026-06-15 collides with otherPricing [2026-06-01 -> 2026-06-30]
    await expect(useCase.execute(pricingId, {
      effectiveTo: '2026-06-15',
    })).rejects.toThrow(AcademicError);
  });

  // Case U06: Lock check - changing effectiveFrom/effectiveTo into billed period
  it('Case U06: should reject modifying dates into already billed period', async () => {
    mockPersistence.getMaxStudentBillDate.mockResolvedValue('2026-05-15');

    // Trying to move effectiveFrom to <= maxStudentBillDate (2026-05-15)
    await expect(useCase.execute(pricingId, {
      effectiveFrom: '2026-05-10',
    })).rejects.toThrow(AcademicError);
  });

  // Case U07: Lock check - changing price when pricing already has billed attendance
  it('Case U07: should reject changing price if pricing started before or on max billed date', async () => {
    mockPersistence.getMaxStudentBillDate.mockResolvedValue('2026-05-20');

    await expect(useCase.execute(pricingId, {
      pricePerSession: 300000,
    })).rejects.toThrow(AcademicError);
  });

  // Case U08: Successful price change in unbilled period
  it('Case U08: should allow price change if pricing is completely in unbilled future', async () => {
    mockPersistence.getMaxStudentBillDate.mockResolvedValue('2026-04-30');

    const result = await useCase.execute(pricingId, {
      pricePerSession: 250000,
    });
    expect(result.pricePerSession).toBe(250000);
  });
});
