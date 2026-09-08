import { UpdateCourseLevelPricingUseCase } from '../../../../../../src/modules/academics/application/use-cases/update-course-level-pricing.use-case';
import { CoursePricingPersistencePort, CoursePricingRecord } from '../../../../../../src/modules/academics/application/ports/course-pricing-persistence.port';
import { AcademicError } from '../../../../../../src/modules/academics/domain/errors/academic.error';

describe('TA Pricing Update Range Suite (12 Cases)', () => {
  let useCase: UpdateCourseLevelPricingUseCase;
  let mockPersistence: jest.Mocked<CoursePricingPersistencePort>;
  const levelId = 'lvl-update-range-ta';

  beforeEach(() => {
    mockPersistence = {
      findPricingByLevelId: jest.fn().mockResolvedValue([]),
      findPricingById: jest.fn().mockResolvedValue(null),
      findActivePricing: jest.fn().mockResolvedValue(null),
      savePricing: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      createPricing: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      deletePricing: jest.fn().mockResolvedValue(undefined),
      checkStudentBills: jest.fn().mockResolvedValue(false),
      checkTeacherWages: jest.fn().mockResolvedValue(false),
      checkAssistantWages: jest.fn().mockResolvedValue(false),
      getMaxStudentBillDate: jest.fn().mockResolvedValue(null),
      getMaxTeacherWageDate: jest.fn().mockResolvedValue(null),
      getMaxAssistantWageDate: jest.fn().mockResolvedValue(null),
    };
    useCase = new UpdateCourseLevelPricingUseCase(mockPersistence);
  });

  describe('Nhóm 1: Cập nhật dải ngày lương Trợ giảng thành công (Cases U06 - U10)', () => {
    it('Case U06: Kéo dài dải ngày lương TA sang tháng sau', async () => {
      const existing: CoursePricingRecord = {
        id: 'p-ta1',
        courseLevelId: levelId,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 80000,
      };
      mockPersistence.findPricingById.mockResolvedValue(existing);
      mockPersistence.findPricingByLevelId.mockResolvedValue([existing]);

      const result = await useCase.execute('p-ta1', {
        effectiveTo: '2026-09-30',
      });

      expect(result.effectiveTo).toBe('2026-09-30');
    });

    it('Case U07: Đổi ngày bắt đầu của lương TA từ 01/06 sang 15/06', async () => {
      const existing: CoursePricingRecord = {
        id: 'p-ta1',
        courseLevelId: levelId,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 80000,
      };
      mockPersistence.findPricingById.mockResolvedValue(existing);
      mockPersistence.findPricingByLevelId.mockResolvedValue([existing]);

      const result = await useCase.execute('p-ta1', {
        effectiveFrom: '2026-06-15',
      });

      expect(result.effectiveFrom).toBe('2026-06-15');
    });

    it('Case U08: Tăng mức thù lao TA và đồng thời đổi dải ngày', async () => {
      const existing: CoursePricingRecord = {
        id: 'p-ta1',
        courseLevelId: levelId,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 80000,
      };
      mockPersistence.findPricingById.mockResolvedValue(existing);
      mockPersistence.findPricingByLevelId.mockResolvedValue([existing]);

      const result = await useCase.execute('p-ta1', {
        taWagePerSession: 110000,
        effectiveFrom: '2026-07-01',
        effectiveTo: '2026-09-30',
      });

      expect(result.taWagePerSession).toBe(110000);
      expect(result.effectiveFrom).toBe('2026-07-01');
      expect(result.effectiveTo).toBe('2026-09-30');
    });

    it('Case U09: Dời toàn bộ dải ngày lương TA sang mùa đông (01/11 - 31/12)', async () => {
      const existing: CoursePricingRecord = {
        id: 'p-ta1',
        courseLevelId: levelId,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 80000,
      };
      mockPersistence.findPricingById.mockResolvedValue(existing);
      mockPersistence.findPricingByLevelId.mockResolvedValue([existing]);

      const result = await useCase.execute('p-ta1', {
        effectiveFrom: '2026-11-01',
        effectiveTo: '2026-12-31',
      });

      expect(result.effectiveFrom).toBe('2026-11-01');
      expect(result.effectiveTo).toBe('2026-12-31');
    });

    it('Case U10: Giữ nguyên mức lương TA khi chỉ đổi ngày', async () => {
      const existing: CoursePricingRecord = {
        id: 'p-ta1',
        courseLevelId: levelId,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 95000,
      };
      mockPersistence.findPricingById.mockResolvedValue(existing);
      mockPersistence.findPricingByLevelId.mockResolvedValue([existing]);

      const result = await useCase.execute('p-ta1', {
        effectiveTo: '2026-09-15',
      });

      expect(result.taWagePerSession).toBe(95000);
    });
  });

  describe('Nhóm 2: Overlap check, Validation & Khóa chốt lương TA (Cases U15 - U18, U22 - U23, U25_TA)', () => {
    it('Case U15: Chặn đổi dải ngày lương TA khi đè lên một bản ghi lương TA khác', async () => {
      const ta1: CoursePricingRecord = {
        id: 'p-ta1',
        courseLevelId: levelId,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 80000,
      };
      const ta2: CoursePricingRecord = {
        id: 'p-ta2',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 100000,
      };
      mockPersistence.findPricingById.mockResolvedValue(ta1);
      mockPersistence.findPricingByLevelId.mockResolvedValue([ta1, ta2]);

      await expect(useCase.execute('p-ta1', {
        effectiveTo: '2026-10-15',
      })).rejects.toThrow(AcademicError);
    });

    it('Case U16: Cho phép thu hẹp dải ngày lương TA để tạo khoảng trống cho kỳ mới', async () => {
      const ta1: CoursePricingRecord = {
        id: 'p-ta1',
        courseLevelId: levelId,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 80000,
      };
      mockPersistence.findPricingById.mockResolvedValue(ta1);
      mockPersistence.findPricingByLevelId.mockResolvedValue([ta1]);

      const result = await useCase.execute('p-ta1', {
        effectiveTo: '2026-08-31',
      });
      expect(result.effectiveTo).toBe('2026-08-31');
    });

    it('Case U17: Cho phép cập nhật cả ngày và đổi mức lương TA mà không lỗi', async () => {
      const ta1: CoursePricingRecord = {
        id: 'p-ta1',
        courseLevelId: levelId,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 80000,
      };
      mockPersistence.findPricingById.mockResolvedValue(ta1);
      mockPersistence.findPricingByLevelId.mockResolvedValue([ta1]);

      const result = await useCase.execute('p-ta1', {
        taWagePerSession: 90000,
        effectiveFrom: '2026-06-05',
        effectiveTo: '2026-08-25',
      });
      expect(result.taWagePerSession).toBe(90000);
      expect(result.effectiveFrom).toBe('2026-06-05');
      expect(result.effectiveTo).toBe('2026-08-25');
    });

    it('Case U18: Báo lỗi khi cập nhật bản ghi không tồn tại (PRICING_NOT_FOUND)', async () => {
      mockPersistence.findPricingById.mockResolvedValue(null);
      await expect(useCase.execute('p-not-exist', {
        effectiveTo: '2026-12-31',
      })).rejects.toThrow('Không tìm thấy bảng giá lịch sử này.');
    });

    it('Case U22: Chặn khi cập nhật ngày bắt đầu là chuỗi rỗng', async () => {
      const existing: CoursePricingRecord = {
        id: 'p-ta1',
        courseLevelId: levelId,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 80000,
      };
      mockPersistence.findPricingById.mockResolvedValue(existing);

      await expect(useCase.execute('p-ta1', {
        effectiveFrom: '',
      })).rejects.toThrow('Ngày bắt đầu không được để trống.');
    });

    it('Case U23: Chặn khi cập nhật ngày kết thúc là chuỗi rỗng', async () => {
      const existing: CoursePricingRecord = {
        id: 'p-ta1',
        courseLevelId: levelId,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 80000,
      };
      mockPersistence.findPricingById.mockResolvedValue(existing);

      await expect(useCase.execute('p-ta1', {
        effectiveTo: '',
      })).rejects.toThrow('Ngày kết thúc không được để trống.');
    });

    it('Case U25_TA: Chặn sửa mức lương TA khi giai đoạn bắt đầu đã có kỳ chốt lương (maxAssistantWageDate)', async () => {
      const existing: CoursePricingRecord = {
        id: 'p-ta1',
        courseLevelId: levelId,
        effectiveFrom: '2026-05-01',
        effectiveTo: '2026-08-31',
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 80000,
      };
      mockPersistence.findPricingById.mockResolvedValue(existing);
      mockPersistence.getMaxAssistantWageDate.mockResolvedValue('2026-06-30');

      await expect(useCase.execute('p-ta1', {
        taWagePerSession: 100000,
      })).rejects.toThrow('Không thể thay đổi lương trợ giảng vì bảng giá bắt đầu từ');
    });
  });
});
