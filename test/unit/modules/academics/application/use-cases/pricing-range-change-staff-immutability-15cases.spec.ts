import { UpdateCourseLevelPricingUseCase } from '../../../../../../src/modules/academics/application/use-cases/update-course-level-pricing.use-case';
import { CreateCourseLevelPricingUseCase } from '../../../../../../src/modules/academics/application/use-cases/create-course-level-pricing.use-case';
import { CoursePricingPersistencePort, CoursePricingRecord } from '../../../../../../src/modules/academics/application/ports/course-pricing-persistence.port';
import { AcademicError } from '../../../../../../src/modules/academics/domain/errors/academic.error';

describe('Pricing Range Change Staff Immutability Suite (15 Cases)', () => {
  let updateUseCase: UpdateCourseLevelPricingUseCase;
  let createUseCase: CreateCourseLevelPricingUseCase;
  let mockPersistence: jest.Mocked<CoursePricingPersistencePort>;
  const levelId = 'lvl-immutable-staff';

  beforeEach(() => {
    mockPersistence = {
      findPricingByLevelId: jest.fn().mockResolvedValue([]),
      findPricingById: jest.fn().mockResolvedValue(null),
      findActivePricing: jest.fn().mockResolvedValue(null),
      savePricing: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      createPricing: jest.fn().mockImplementation((p) => Promise.resolve({ id: 'p-new', ...p })),
      deletePricing: jest.fn().mockResolvedValue(undefined),
      checkStudentBills: jest.fn().mockResolvedValue(false),
      checkTeacherWages: jest.fn().mockResolvedValue(false),
      checkAssistantWages: jest.fn().mockResolvedValue(false),
      getMaxStudentBillDate: jest.fn().mockResolvedValue(null),
      getMaxTeacherWageDate: jest.fn().mockResolvedValue(null),
      getMaxAssistantWageDate: jest.fn().mockResolvedValue(null),
    };
    updateUseCase = new UpdateCourseLevelPricingUseCase(mockPersistence);
    createUseCase = new CreateCourseLevelPricingUseCase(mockPersistence);
  });

  describe('Nhóm 1: Ràng buộc khóa chốt Giáo viên (Cases I16 - I20)', () => {
    it('Case I16: Chặn lùi ngày bắt đầu của lương GV đè vào giai đoạn đã chốt lương', async () => {
      mockPersistence.getMaxTeacherWageDate.mockResolvedValue('2026-08-31');

      const futureTeacherWage: CoursePricingRecord = {
        id: 'p-tch-future',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 300000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(futureTeacherWage);

      await expect(updateUseCase.execute('p-tch-future', {
        effectiveFrom: '2026-08-20',
      })).rejects.toThrow('Không thể thay đổi ngày bắt đầu của bảng giá liên quan đến giai đoạn đã chốt sổ/lương.');
    });

    it('Case I17: Chặn rút ngắn ngày kết thúc của lương GV chạm vào ngày đã chốt lương', async () => {
      mockPersistence.getMaxTeacherWageDate.mockResolvedValue('2026-08-31');

      const teacherWage: CoursePricingRecord = {
        id: 'p-tch',
        courseLevelId: levelId,
        effectiveFrom: '2026-08-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 300000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(teacherWage);

      await expect(updateUseCase.execute('p-tch', {
        effectiveTo: '2026-08-15',
      })).rejects.toThrow('Không thể thay đổi ngày kết thúc của bảng giá liên quan đến giai đoạn đã chốt sổ/lương.');
    });

    it('Case I18: Đổi mức lương GV không làm ảnh hưởng đến dải ngày học sinh và trợ giảng', async () => {
      mockPersistence.getMaxTeacherWageDate.mockResolvedValue('2026-08-31');

      const futureTeacherWage: CoursePricingRecord = {
        id: 'p-tch-future',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 300000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(futureTeacherWage);
      mockPersistence.findPricingByLevelId.mockResolvedValue([futureTeacherWage]);

      const updated = await updateUseCase.execute('p-tch-future', {
        teacherWagePerSession: 380000,
      });
      expect(updated.teacherWagePerSession).toBe(380000);
      expect(updated.pricePerSession).toBe(0);
      expect(updated.taWagePerSession).toBe(0);
    });

    it('Case I19: Cho phép mở rộng dải ngày lương GV sang năm sau (đến 31/03/2027)', async () => {
      mockPersistence.getMaxTeacherWageDate.mockResolvedValue('2026-08-31');

      const futureTeacherWage: CoursePricingRecord = {
        id: 'p-tch-future',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 300000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(futureTeacherWage);
      mockPersistence.findPricingByLevelId.mockResolvedValue([futureTeacherWage]);

      const updated = await updateUseCase.execute('p-tch-future', {
        effectiveTo: '2027-03-31',
      });
      expect(updated.effectiveTo).toBe('2027-03-31');
    });

    it('Case I20: Khi chưa chốt lương GV lần nào (maxTeacherWageDate = null) -> cho phép sửa tự do', async () => {
      mockPersistence.getMaxTeacherWageDate.mockResolvedValue(null);

      const teacherWage: CoursePricingRecord = {
        id: 'p-tch',
        courseLevelId: levelId,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-05-31',
        pricePerSession: 0,
        teacherWagePerSession: 250000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(teacherWage);
      mockPersistence.findPricingByLevelId.mockResolvedValue([teacherWage]);

      const updated = await updateUseCase.execute('p-tch', {
        teacherWagePerSession: 270000,
        effectiveFrom: '2026-02-01',
      });
      expect(updated.teacherWagePerSession).toBe(270000);
      expect(updated.effectiveFrom).toBe('2026-02-01');
    });
  });

  describe('Nhóm 2: Bất biến lương Trợ giảng & Độc lập đa chiều (Cases I21 - I30)', () => {
    it('Case I21: Thay đổi dải ngày lương TA ở kỳ tương lai thành công, không đụng vào kỳ trước', async () => {
      mockPersistence.getMaxAssistantWageDate.mockResolvedValue('2026-08-31');

      const futureTaWage: CoursePricingRecord = {
        id: 'p-ta-future',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 100000,
      };
      mockPersistence.findPricingById.mockResolvedValue(futureTaWage);
      mockPersistence.findPricingByLevelId.mockResolvedValue([futureTaWage]);

      const updated = await updateUseCase.execute('p-ta-future', {
        taWagePerSession: 120000,
        effectiveFrom: '2026-10-01',
      });

      expect(updated.taWagePerSession).toBe(120000);
      expect(updated.effectiveFrom).toBe('2026-10-01');
    });

    it('Case I22: Chặn sửa mức lương TA nếu ngày bắt đầu của bảng giá nằm trong giai đoạn đã chốt lương TA', async () => {
      mockPersistence.getMaxAssistantWageDate.mockResolvedValue('2026-08-31');

      const oldTaWage: CoursePricingRecord = {
        id: 'p-ta-old',
        courseLevelId: levelId,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 80000,
      };
      mockPersistence.findPricingById.mockResolvedValue(oldTaWage);

      await expect(updateUseCase.execute('p-ta-old', {
        taWagePerSession: 95000,
      })).rejects.toThrow('Không thể thay đổi lương trợ giảng vì bảng giá bắt đầu từ 2026-06-01');
    });

    it('Case I23: Chặn tạo bảng giá lương TA mới bắt đầu trước ngày chốt lương TA gần nhất', async () => {
      mockPersistence.getMaxAssistantWageDate.mockResolvedValue('2026-08-31');

      await expect(createUseCase.execute(levelId, {
        effectiveFrom: '2026-08-01',
        effectiveTo: '2026-10-31',
        taWagePerSession: 100000,
      })).rejects.toThrow('Ngày bắt đầu áp dụng lương trợ giảng (2026-08-01) phải sau ngày chốt lương trợ giảng gần nhất (2026-08-31).');
    });

    it('Case I24: Chặn lùi ngày bắt đầu của lương TA đè vào giai đoạn đã chốt lương TA', async () => {
      mockPersistence.getMaxAssistantWageDate.mockResolvedValue('2026-08-31');

      const futureTaWage: CoursePricingRecord = {
        id: 'p-ta-future',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 100000,
      };
      mockPersistence.findPricingById.mockResolvedValue(futureTaWage);

      await expect(updateUseCase.execute('p-ta-future', {
        effectiveFrom: '2026-08-25',
      })).rejects.toThrow('Không thể thay đổi ngày bắt đầu của bảng giá liên quan đến giai đoạn đã chốt sổ/lương.');
    });

    it('Case I25: Tạo mức lương TA mới ở tương lai (01/10 - 31/12) không chạm vào các kỳ đã chốt', async () => {
      mockPersistence.getMaxAssistantWageDate.mockResolvedValue('2026-08-31');

      const created = await createUseCase.execute(levelId, {
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-12-31',
        taWagePerSession: 120000,
      });

      expect(created.taWagePerSession).toBe(120000);
      expect(created.effectiveFrom).toBe('2026-10-01');
    });

    it('Case I26: Bảng giá hỗn hợp: Đã chốt học phí (maxStudentBillDate) nhưng chưa chốt lương GV -> cho phép sửa lương GV', async () => {
      mockPersistence.getMaxStudentBillDate.mockResolvedValue('2026-08-31');
      mockPersistence.getMaxTeacherWageDate.mockResolvedValue(null);

      const combo: CoursePricingRecord = {
        id: 'p-combo',
        courseLevelId: levelId,
        effectiveFrom: '2026-08-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 200000,
        teacherWagePerSession: 300000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(combo);
      mockPersistence.findPricingByLevelId.mockResolvedValue([combo]);

      const updated = await updateUseCase.execute('p-combo', {
        teacherWagePerSession: 350000,
      });
      expect(updated.teacherWagePerSession).toBe(350000);
    });

    it('Case I27: Bảng giá hỗn hợp: Đã chốt lương GV nhưng chưa chốt lương TA -> cho phép sửa lương TA', async () => {
      mockPersistence.getMaxTeacherWageDate.mockResolvedValue('2026-08-31');
      mockPersistence.getMaxAssistantWageDate.mockResolvedValue(null);

      const combo: CoursePricingRecord = {
        id: 'p-combo',
        courseLevelId: levelId,
        effectiveFrom: '2026-08-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 300000,
        taWagePerSession: 100000,
      };
      mockPersistence.findPricingById.mockResolvedValue(combo);
      mockPersistence.findPricingByLevelId.mockResolvedValue([combo]);

      const updated = await updateUseCase.execute('p-combo', {
        taWagePerSession: 130000,
      });
      expect(updated.taWagePerSession).toBe(130000);
    });

    it('Case I28: Đổi range lương TA không làm thay đổi các giá trị thù lao đã chốt trước đó trong DB', async () => {
      mockPersistence.getMaxAssistantWageDate.mockResolvedValue('2026-08-31');

      const futureTaWage: CoursePricingRecord = {
        id: 'p-ta-future',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 100000,
      };
      mockPersistence.findPricingById.mockResolvedValue(futureTaWage);
      mockPersistence.findPricingByLevelId.mockResolvedValue([futureTaWage]);

      const updated = await updateUseCase.execute('p-ta-future', {
        effectiveTo: '2027-01-31',
      });
      expect(updated.effectiveTo).toBe('2027-01-31');
    });

    it('Case I29: Chặn tạo bảng giá nếu ngày bắt đầu rơi vào giai đoạn đã chốt lương của GV (chạm ngày 31/08)', async () => {
      mockPersistence.getMaxTeacherWageDate.mockResolvedValue('2026-08-31');

      await expect(createUseCase.execute(levelId, {
        effectiveFrom: '2026-08-31',
        effectiveTo: '2026-12-31',
        teacherWagePerSession: 320000,
      })).rejects.toThrow('Ngày bắt đầu áp dụng lương giáo viên (2026-08-31) phải sau ngày chốt lương gần nhất (2026-08-31).');
    });

    it('Case I30: Khi chưa chốt lương TA (maxAssistantWageDate = null) -> cho phép thay đổi tự do', async () => {
      mockPersistence.getMaxAssistantWageDate.mockResolvedValue(null);

      const taPricing: CoursePricingRecord = {
        id: 'p-ta',
        courseLevelId: levelId,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 85000,
      };
      mockPersistence.findPricingById.mockResolvedValue(taPricing);
      mockPersistence.findPricingByLevelId.mockResolvedValue([taPricing]);

      const updated = await updateUseCase.execute('p-ta', {
        taWagePerSession: 95000,
        effectiveFrom: '2026-06-15',
        effectiveTo: '2026-09-15',
      });
      expect(updated.taWagePerSession).toBe(95000);
      expect(updated.effectiveFrom).toBe('2026-06-15');
      expect(updated.effectiveTo).toBe('2026-09-15');
    });
  });
});
