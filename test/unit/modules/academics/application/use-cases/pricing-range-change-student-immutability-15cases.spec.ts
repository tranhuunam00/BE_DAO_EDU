import { UpdateCourseLevelPricingUseCase } from '../../../../../../src/modules/academics/application/use-cases/update-course-level-pricing.use-case';
import { CreateCourseLevelPricingUseCase } from '../../../../../../src/modules/academics/application/use-cases/create-course-level-pricing.use-case';
import { CoursePricingPersistencePort, CoursePricingRecord } from '../../../../../../src/modules/academics/application/ports/course-pricing-persistence.port';
import { AcademicError } from '../../../../../../src/modules/academics/domain/errors/academic.error';

describe('Pricing Range Change Student Immutability Suite (15 Cases)', () => {
  let updateUseCase: UpdateCourseLevelPricingUseCase;
  let createUseCase: CreateCourseLevelPricingUseCase;
  let mockPersistence: jest.Mocked<CoursePricingPersistencePort>;
  const levelId = 'lvl-immutable-student';

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
    updateUseCase = new UpdateCourseLevelPricingUseCase(mockPersistence, () => '2025-12-01');
    createUseCase = new CreateCourseLevelPricingUseCase(mockPersistence);
  });

  describe('Nhóm 1: Đổi range học phí -> Hóa đơn và ca học đã chốt của Học sinh KHÔNG ĐỔI (Cases I01 - I10)', () => {
    it('Case I01: Đổi range học phí ở kỳ tương lai -> hóa đơn tháng trước giữ nguyên số tiền snapshot', async () => {
      mockPersistence.getMaxStudentBillDate.mockResolvedValue('2026-08-31');

      const futurePricing: CoursePricingRecord = {
        id: 'p-stu-future',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 250000,
        teacherWagePerSession: 0,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(futurePricing);
      mockPersistence.findPricingByLevelId.mockResolvedValue([futurePricing]);

      const updated = await updateUseCase.execute('p-stu-future', {
        effectiveFrom: '2026-09-15',
        effectiveTo: '2026-11-30',
        pricePerSession: 270000,
      });

      expect(updated.pricePerSession).toBe(270000);
      expect(updated.effectiveFrom).toBe('2026-09-15');
    });

    it('Case I02: Chặn đổi ngày bắt đầu của biểu giá học phí lùi về trước ngày chốt học phí (01/08 <= 31/08)', async () => {
      mockPersistence.getMaxStudentBillDate.mockResolvedValue('2026-08-31');

      const pricing: CoursePricingRecord = {
        id: 'p-stu',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 250000,
        teacherWagePerSession: 0,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(pricing);

      await expect(updateUseCase.execute('p-stu', {
        effectiveFrom: '2026-08-15',
      })).rejects.toThrow('Không thể thay đổi ngày bắt đầu của bảng giá liên quan đến giai đoạn đã chốt sổ/lương.');
    });

    it('Case I03: Chặn sửa đơn giá học phí nếu ngày bắt đầu của bảng giá nằm trong giai đoạn đã chốt sổ', async () => {
      mockPersistence.getMaxStudentBillDate.mockResolvedValue('2026-08-31');

      const oldBilledPricing: CoursePricingRecord = {
        id: 'p-old-billed',
        courseLevelId: levelId,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-08-31',
        pricePerSession: 200000,
        teacherWagePerSession: 0,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(oldBilledPricing);

      await expect(updateUseCase.execute('p-old-billed', {
        pricePerSession: 220000,
      })).rejects.toThrow('Không thể thay đổi đơn giá học sinh vì bảng giá bắt đầu từ 2026-01-01');
    });

    it('Case I04: Tạo bảng giá học sinh mới ở tương lai (năm 2027) không làm thay đổi các hóa đơn đã chốt năm 2026', async () => {
      mockPersistence.getMaxStudentBillDate.mockResolvedValue('2026-08-31');

      const created = await createUseCase.execute(levelId, {
        effectiveFrom: '2027-01-01',
        effectiveTo: '2027-06-30',
        pricePerSession: 300000,
      });

      expect(created.pricePerSession).toBe(300000);
      expect(mockPersistence.createPricing).toHaveBeenCalledWith(expect.objectContaining({
        effectiveFrom: '2027-01-01',
      }));
    });

    it('Case I05: Chặn tạo bảng giá học sinh mới có ngày bắt đầu trước ngày chốt học phí gần nhất', async () => {
      mockPersistence.getMaxStudentBillDate.mockResolvedValue('2026-08-31');

      await expect(createUseCase.execute(levelId, {
        effectiveFrom: '2026-08-10',
        effectiveTo: '2026-10-31',
        pricePerSession: 220000,
      })).rejects.toThrow('Ngày bắt đầu áp dụng học phí (2026-08-10) phải sau ngày chốt học phí gần nhất (2026-08-31).');
    });

    it('Case I06: Khóa bất biến: Học sinh đã chốt hóa đơn với rate 200k thì snapshot 200k giữ nguyên khi sửa giá tương lai', async () => {
      mockPersistence.getMaxStudentBillDate.mockResolvedValue('2026-08-31');

      const future: CoursePricingRecord = {
        id: 'p-future',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 250000,
        teacherWagePerSession: 0,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(future);
      mockPersistence.findPricingByLevelId.mockResolvedValue([future]);

      const result = await updateUseCase.execute('p-future', {
        pricePerSession: 300000,
      });
      expect(result.pricePerSession).toBe(300000);
    });

    it('Case I07: Chặn rút ngắn ngày kết thúc đè vào ngày chốt học phí gần nhất (newTo <= maxStudentBillDate)', async () => {
      mockPersistence.getMaxStudentBillDate.mockResolvedValue('2026-08-31');

      const pricing: CoursePricingRecord = {
        id: 'p-stu',
        courseLevelId: levelId,
        effectiveFrom: '2026-08-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 200000,
        teacherWagePerSession: 0,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(pricing);

      await expect(updateUseCase.execute('p-stu', {
        effectiveTo: '2026-08-20',
      })).rejects.toThrow('Không thể thay đổi ngày kết thúc của bảng giá liên quan đến giai đoạn đã chốt sổ/lương.');
    });

    it('Case I08: Cho phép nới rộng ngày kết thúc của bảng giá tương lai (từ 31/12 sang 2027-01-31)', async () => {
      mockPersistence.getMaxStudentBillDate.mockResolvedValue('2026-08-31');

      const pricing: CoursePricingRecord = {
        id: 'p-stu',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 250000,
        teacherWagePerSession: 0,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(pricing);
      mockPersistence.findPricingByLevelId.mockResolvedValue([pricing]);

      const updated = await updateUseCase.execute('p-stu', {
        effectiveTo: '2027-01-31',
      });
      expect(updated.effectiveTo).toBe('2027-01-31');
    });

    it('Case I09: Cho phép cập nhật ghi chú hoặc mô tả mà không đổi ngày và tiền học phí đã chốt', async () => {
      const pricing: CoursePricingRecord = {
        id: 'p-stu',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 250000,
        teacherWagePerSession: 0,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(pricing);
      mockPersistence.findPricingByLevelId.mockResolvedValue([pricing]);

      const updated = await updateUseCase.execute('p-stu', {
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
      });
      expect(updated.pricePerSession).toBe(250000);
    });

    it('Case I10: Khi chưa từng có kỳ chốt học phí nào (maxStudentBillDate = null) -> cho phép sửa tự do', async () => {
      mockPersistence.getMaxStudentBillDate.mockResolvedValue(null);

      const pricing: CoursePricingRecord = {
        id: 'p-stu',
        courseLevelId: levelId,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-06-30',
        pricePerSession: 180000,
        teacherWagePerSession: 0,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(pricing);
      mockPersistence.findPricingByLevelId.mockResolvedValue([pricing]);

      const updated = await updateUseCase.execute('p-stu', {
        pricePerSession: 210000,
        effectiveFrom: '2026-02-01',
        effectiveTo: '2026-07-31',
      });
      expect(updated.pricePerSession).toBe(210000);
      expect(updated.effectiveFrom).toBe('2026-02-01');
    });
  });

  describe('Nhóm 2: Bất biến lương Giáo viên & ca học đã chốt (Cases I11 - I15)', () => {
    it('Case I11: Tăng lương GV ở dải ngày mới -> phiếu lương tháng trước giữ nguyên', async () => {
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
        teacherWagePerSession: 350000,
      });

      expect(updated.teacherWagePerSession).toBe(350000);
    });

    it('Case I12: Chặn sửa lương GV nếu bảng giá bắt đầu trước hoặc trùng ngày chốt lương gần nhất (01/08 <= 31/08)', async () => {
      mockPersistence.getMaxTeacherWageDate.mockResolvedValue('2026-08-31');

      const oldTeacherWage: CoursePricingRecord = {
        id: 'p-tch-old',
        courseLevelId: levelId,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
        pricePerSession: 0,
        teacherWagePerSession: 280000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(oldTeacherWage);

      await expect(updateUseCase.execute('p-tch-old', {
        teacherWagePerSession: 320000,
      })).rejects.toThrow('Không thể thay đổi lương giáo viên vì bảng giá bắt đầu từ 2026-06-01');
    });

    it('Case I13: Chặn tạo dải ngày lương GV mới bắt đầu trước ngày chốt lương gần nhất', async () => {
      mockPersistence.getMaxTeacherWageDate.mockResolvedValue('2026-08-31');

      await expect(createUseCase.execute(levelId, {
        effectiveFrom: '2026-08-15',
        effectiveTo: '2026-11-30',
        teacherWagePerSession: 320000,
      })).rejects.toThrow('Ngày bắt đầu áp dụng lương giáo viên (2026-08-15) phải sau ngày chốt lương gần nhất (2026-08-31).');
    });

    it('Case I14: Tạo mức lương GV mới cho kỳ tiếp theo (01/09 - 31/12) thành công sau ngày chốt 31/08', async () => {
      mockPersistence.getMaxTeacherWageDate.mockResolvedValue('2026-08-31');

      const created = await createUseCase.execute(levelId, {
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        teacherWagePerSession: 350000,
      });

      expect(created.teacherWagePerSession).toBe(350000);
      expect(created.effectiveFrom).toBe('2026-09-01');
    });

    it('Case I15: Ca dạy đã chốt wageId thì billedTeacherWage là bất biến khi điều chỉnh dải ngày tương lai', async () => {
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
        effectiveFrom: '2026-09-10',
        effectiveTo: '2026-11-30',
      });
      expect(updated.effectiveFrom).toBe('2026-09-10');
    });
  });
});
