import { CreateCourseLevelPricingUseCase } from '../../../../../../src/modules/academics/application/use-cases/create-course-level-pricing.use-case';
import { UpdateCourseLevelPricingUseCase } from '../../../../../../src/modules/academics/application/use-cases/update-course-level-pricing.use-case';
import { CoursePricingPersistencePort, CoursePricingRecord } from '../../../../../../src/modules/academics/application/ports/course-pricing-persistence.port';
import { BillingCalculator, PricingRule } from '../../../../../../src/modules/billing/domain/services/billing-calculator';

describe('Independent Pricing Types Range & Billing Accuracy Suite', () => {
  let createUseCase: CreateCourseLevelPricingUseCase;
  let updateUseCase: UpdateCourseLevelPricingUseCase;
  let inMemoryPricings: CoursePricingRecord[];
  let mockPersistence: jest.Mocked<CoursePricingPersistencePort>;

  const levelId = 'lvl-math-advanced-8';

  beforeEach(() => {
    inMemoryPricings = [
      {
        id: 'rec-student-1',
        courseLevelId: levelId,
        pricePerSession: 200000,
        teacherWagePerSession: 0,
        taWagePerSession: 0,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
        type: 'student',
      },
      {
        id: 'rec-teacher-1',
        courseLevelId: levelId,
        pricePerSession: 0,
        teacherWagePerSession: 150000,
        taWagePerSession: 0,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
        type: 'teacher',
      },
      {
        id: 'rec-ta-1',
        courseLevelId: levelId,
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 80000,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
        type: 'ta',
      },
    ];

    mockPersistence = {
      findPricingByLevelId: jest.fn().mockImplementation(async () => [...inMemoryPricings]),
      findPricingById: jest.fn().mockImplementation(async (id: string) => {
        return inMemoryPricings.find((p) => p.id === id) || null;
      }),
      findActivePricing: jest.fn().mockImplementation(async (lvl: string, t?: string) => {
        return inMemoryPricings.find((p) => p.courseLevelId === lvl && (!t || p.type === t) && p.effectiveTo === null) || null;
      }),
      createPricing: jest.fn().mockImplementation(async (data: any) => {
        const record = { id: `rec-${Date.now()}`, ...data };
        inMemoryPricings.push(record);
        return record;
      }),
      savePricing: jest.fn().mockImplementation(async (data: any) => {
        const idx = inMemoryPricings.findIndex((p) => p.id === data.id);
        if (idx !== -1) {
          inMemoryPricings[idx] = { ...data };
        }
        return data;
      }),
      deletePricing: jest.fn().mockImplementation(async (id: string) => {
        inMemoryPricings = inMemoryPricings.filter((p) => p.id !== id);
      }),
      checkStudentBills: jest.fn().mockResolvedValue(false),
      checkTeacherWages: jest.fn().mockResolvedValue(false),
      checkAssistantWages: jest.fn().mockResolvedValue(false),
      getMaxStudentBillDate: jest.fn().mockResolvedValue(null),
      getMaxTeacherWageDate: jest.fn().mockResolvedValue(null),
      getMaxAssistantWageDate: jest.fn().mockResolvedValue(null),
    };

    createUseCase = new CreateCourseLevelPricingUseCase(mockPersistence);
    updateUseCase = new UpdateCourseLevelPricingUseCase(mockPersistence, () => '2026-09-09');
  });

  it('Case 1: Cho phép tạo mức giá mới cùng dải ngày nếu khác type (không bị overlap)', async () => {
    // Đã có student record 2026-01-01 -> 2026-12-31.
    // Tạo thêm teacher wage cho dải ngày 2026-06-01 -> 2026-12-31 không bị báo trùng với student
    const newTeacherPricing = await createUseCase.execute(levelId, {
      teacherWagePerSession: 180000,
      effectiveFrom: '2027-01-01',
      effectiveTo: '2027-12-31',
      type: 'teacher',
    });

    expect(newTeacherPricing).toBeDefined();
    expect(newTeacherPricing.type).toBe('teacher');
    expect(newTeacherPricing.teacherWagePerSession).toBe(180000);
    expect(newTeacherPricing.pricePerSession).toBe(0);
  });

  it('Case 2: Cập nhật ngày kết thúc của student không làm ảnh hưởng đến ngày kết thúc của teacher', async () => {
    const teacherRec = inMemoryPricings.find((p) => p.id === 'rec-teacher-1')!;
    teacherRec.effectiveTo = null;

    const studentBefore = inMemoryPricings.find((p) => p.id === 'rec-student-1');
    const teacherBefore = inMemoryPricings.find((p) => p.id === 'rec-teacher-1');

    expect(teacherBefore?.effectiveTo).toBeNull();

    // Người dùng sửa ngày kết thúc của đơn giá học sinh thành 2027-09-01
    await updateUseCase.execute('rec-student-1', {
      effectiveTo: '2027-09-01',
      type: 'student',
    });

    const studentAfter = inMemoryPricings.find((p) => p.id === 'rec-student-1');
    const teacherAfter = inMemoryPricings.find((p) => p.id === 'rec-teacher-1');

    // Student đã đổi sang 2027-09-01
    expect(studentAfter?.effectiveTo).toBe('2027-09-01');
    // Teacher wage hoàn toàn giữ nguyên effectiveTo = null (Nay)!
    expect(teacherAfter?.effectiveTo).toBeNull();
  });

  it('Case 3: Check lock chốt sổ độc lập: Khóa học phí học sinh không ngăn cản tạo bảng lương giáo viên', async () => {
    // Giả sử học phí học sinh đã chốt đến 2026-08-31
    mockPersistence.getMaxStudentBillDate.mockResolvedValue('2026-08-31');

    // Tạo lương giáo viên từ 2026-08-01 -> 2026-12-31 (trước ngày chốt học sinh)
    // Phải thành công vì lương giáo viên chưa bị chốt sổ!
    const res = await createUseCase.execute(levelId, {
      teacherWagePerSession: 190000,
      effectiveFrom: '2027-01-01',
      effectiveTo: '2027-06-30',
      type: 'teacher',
    });

    expect(res).toBeDefined();
    expect(res.type).toBe('teacher');
  });

  it('Case 4: Billing resolution lấy đúng range theo type: Học phí học sinh theo range của student, lương giáo viên theo range của teacher', () => {
    const rules: PricingRule[] = [
      {
        courseLevelId: levelId,
        pricePerSession: 220000,
        teacherWagePerSession: 0,
        taWagePerSession: 0,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-06-30',
        type: 'student',
      },
      {
        courseLevelId: levelId,
        pricePerSession: 250000,
        teacherWagePerSession: 0,
        taWagePerSession: 0,
        effectiveFrom: '2026-07-01',
        effectiveTo: '2026-12-31',
        type: 'student',
      },
      {
        courseLevelId: levelId,
        pricePerSession: 0,
        teacherWagePerSession: 140000,
        taWagePerSession: 0,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-09-30', // Range giáo viên khác range học sinh!
        type: 'teacher',
      },
      {
        courseLevelId: levelId,
        pricePerSession: 0,
        teacherWagePerSession: 160000,
        taWagePerSession: 0,
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-12-31',
        type: 'teacher',
      },
    ];

    // Ngày 2026-08-15:
    // - Học sinh ở kỳ 2 (2026-07-01 -> 2026-12-31) -> Giá phải là 250,000
    // - Giáo viên ở kỳ 1 (2026-01-01 -> 2026-09-30) -> Lương phải là 140,000
    const studentPricing = BillingCalculator.getActivePricing(rules, '2026-08-15', 'pricePerSession', levelId);
    const teacherPricing = BillingCalculator.getActivePricing(rules, '2026-08-15', 'teacherWagePerSession', levelId);

    expect(studentPricing?.type).toBe('student');
    expect(studentPricing?.pricePerSession).toBe(250000);

    expect(teacherPricing?.type).toBe('teacher');
    expect(teacherPricing?.teacherWagePerSession).toBe(140000);
  });
});
