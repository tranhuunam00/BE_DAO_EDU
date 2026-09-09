import { UpdateCourseLevelPricingUseCase } from '../../../../../../src/modules/academics/application/use-cases/update-course-level-pricing.use-case';
import { CoursePricingPersistencePort, CoursePricingRecord } from '../../../../../../src/modules/academics/application/ports/course-pricing-persistence.port';
import { AcademicError } from '../../../../../../src/modules/academics/domain/errors/academic.error';

describe('Teacher Pricing Update Range Suite (13 Cases)', () => {
  let useCase: UpdateCourseLevelPricingUseCase;
  let mockPersistence: jest.Mocked<CoursePricingPersistencePort>;
  const levelId = 'lvl-update-range-teacher';

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
    useCase = new UpdateCourseLevelPricingUseCase(mockPersistence, () => '2026-01-01');
  });

  describe('Nhóm 1: Cập nhật dải ngày lương Giáo viên thành công (Cases U01 - U05)', () => {
    it('Case U01: Thu hẹp dải ngày lương GV (từ 01/09-31/12 thành 15/09-30/11)', async () => {
      const existing: CoursePricingRecord = {
        id: 'p-t1',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 300000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(existing);
      mockPersistence.findPricingByLevelId.mockResolvedValue([existing]);

      const result = await useCase.execute('p-t1', {
        effectiveFrom: '2026-09-15',
        effectiveTo: '2026-11-30',
      });

      expect(result.effectiveFrom).toBe('2026-09-15');
      expect(result.effectiveTo).toBe('2026-11-30');
    });

    it('Case U02: Mở rộng dải ngày lương GV sang năm tiếp theo (tới 30/06/2027)', async () => {
      const existing: CoursePricingRecord = {
        id: 'p-t1',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 300000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(existing);
      mockPersistence.findPricingByLevelId.mockResolvedValue([existing]);

      const result = await useCase.execute('p-t1', {
        effectiveTo: '2027-06-30',
      });

      expect(result.effectiveTo).toBe('2027-06-30');
    });

    it('Case U03: Dời dải ngày lương GV sang kỳ sau (từ 01/10 sang 01/11)', async () => {
      const existing: CoursePricingRecord = {
        id: 'p-t1',
        courseLevelId: levelId,
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 300000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(existing);
      mockPersistence.findPricingByLevelId.mockResolvedValue([existing]);

      const result = await useCase.execute('p-t1', {
        effectiveFrom: '2026-11-01',
      });

      expect(result.effectiveFrom).toBe('2026-11-01');
    });

    it('Case U04: Cập nhật đồng thời mức lương GV và dải ngày mới', async () => {
      const existing: CoursePricingRecord = {
        id: 'p-t1',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 300000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(existing);
      mockPersistence.findPricingByLevelId.mockResolvedValue([existing]);

      const result = await useCase.execute('p-t1', {
        teacherWagePerSession: 350000,
        effectiveFrom: '2026-09-05',
        effectiveTo: '2026-12-25',
      });

      expect(result.teacherWagePerSession).toBe(350000);
      expect(result.effectiveFrom).toBe('2026-09-05');
      expect(result.effectiveTo).toBe('2026-12-25');
    });

    it('Case U05: Cập nhật dải ngày lương GV thành 1 ngày duy nhất', async () => {
      const existing: CoursePricingRecord = {
        id: 'p-t1',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-09-30',
        pricePerSession: 0,
        teacherWagePerSession: 300000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(existing);
      mockPersistence.findPricingByLevelId.mockResolvedValue([existing]);

      const result = await useCase.execute('p-t1', {
        effectiveFrom: '2026-09-10',
        effectiveTo: '2026-09-10',
      });

      expect(result.effectiveFrom).toBe('2026-09-10');
      expect(result.effectiveTo).toBe('2026-09-10');
    });
  });

  describe('Nhóm 2: Overlap check & Độc lập với Học viên và Trợ giảng (Cases U11 - U14, U19 - U21)', () => {
    it('Case U11: Chặn đổi dải ngày lương GV khi chạm vào dải ngày của bản ghi GV khác', async () => {
      const p1: CoursePricingRecord = {
        id: 'p-t1',
        courseLevelId: levelId,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-05-31',
        pricePerSession: 0,
        teacherWagePerSession: 250000,
        taWagePerSession: 0,
      };
      const p2: CoursePricingRecord = {
        id: 'p-t2',
        courseLevelId: levelId,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 300000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(p1);
      mockPersistence.findPricingByLevelId.mockResolvedValue([p1, p2]);

      await expect(useCase.execute('p-t1', {
        effectiveTo: '2026-06-15',
      })).rejects.toThrow(AcademicError);
    });

    it('Case U12: Chặn lùi ngày bắt đầu của p2 làm đè lên p1 của GV', async () => {
      const p1: CoursePricingRecord = {
        id: 'p-t1',
        courseLevelId: levelId,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-05-31',
        pricePerSession: 0,
        teacherWagePerSession: 250000,
        taWagePerSession: 0,
      };
      const p2: CoursePricingRecord = {
        id: 'p-t2',
        courseLevelId: levelId,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 300000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(p2);
      mockPersistence.findPricingByLevelId.mockResolvedValue([p1, p2]);

      await expect(useCase.execute('p-t2', {
        effectiveFrom: '2026-05-15',
      })).rejects.toThrow(AcademicError);
    });

    it('Case U13: Cho phép đổi dải ngày lương GV chạm tới dải ngày Học viên mà không bị chặn', async () => {
      const pTeacher: CoursePricingRecord = {
        id: 'p-t1',
        courseLevelId: levelId,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-05-31',
        pricePerSession: 0,
        teacherWagePerSession: 250000,
        taWagePerSession: 0,
      };
      const pStudent: CoursePricingRecord = {
        id: 'p-s1',
        courseLevelId: levelId,
        effectiveFrom: '2026-04-01',
        effectiveTo: '2026-08-31',
        pricePerSession: 200000,
        teacherWagePerSession: 0,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(pTeacher);
      mockPersistence.findPricingByLevelId.mockResolvedValue([pTeacher, pStudent]);

      const result = await useCase.execute('p-t1', {
        effectiveTo: '2026-07-31',
      });
      expect(result.effectiveTo).toBe('2026-07-31');
    });

    it('Case U14: Cho phép đổi dải ngày lương GV trùng với dải ngày lương TA', async () => {
      const pTeacher: CoursePricingRecord = {
        id: 'p-t1',
        courseLevelId: levelId,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-05-31',
        pricePerSession: 0,
        teacherWagePerSession: 250000,
        taWagePerSession: 0,
      };
      const pTa: CoursePricingRecord = {
        id: 'p-ta1',
        courseLevelId: levelId,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 80000,
      };
      mockPersistence.findPricingById.mockResolvedValue(pTeacher);
      mockPersistence.findPricingByLevelId.mockResolvedValue([pTeacher, pTa]);

      const result = await useCase.execute('p-t1', {
        effectiveTo: '2026-08-31',
      });
      expect(result.effectiveTo).toBe('2026-08-31');
    });

    it('Case U19: Cho phép cập nhật giá GV mà không thay đổi dải ngày', async () => {
      const existing: CoursePricingRecord = {
        id: 'p-t1',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 300000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(existing);
      mockPersistence.findPricingByLevelId.mockResolvedValue([existing]);

      const result = await useCase.execute('p-t1', {
        teacherWagePerSession: 320000,
      });
      expect(result.teacherWagePerSession).toBe(320000);
      expect(result.effectiveFrom).toBe('2026-09-01');
      expect(result.effectiveTo).toBe('2026-12-31');
    });

    it('Case U20: Không kiểm tra overlap nếu ngày không hề thay đổi', async () => {
      const existing: CoursePricingRecord = {
        id: 'p-t1',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 300000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(existing);
      mockPersistence.findPricingByLevelId.mockResolvedValue([existing]);

      const result = await useCase.execute('p-t1', {
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
      });
      expect(result.effectiveFrom).toBe('2026-09-01');
    });

    it('Case U21: Cập nhật dải ngày bản ghi hỗn hợp cả Học sinh và Giáo viên', async () => {
      const combo: CoursePricingRecord = {
        id: 'p-combo',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 200000,
        teacherWagePerSession: 300000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(combo);
      mockPersistence.findPricingByLevelId.mockResolvedValue([combo]);

      const result = await useCase.execute('p-combo', {
        effectiveTo: '2027-01-31',
      });
      expect(result.effectiveTo).toBe('2027-01-31');
    });
  });

  describe('Nhóm 3: Ràng buộc tính hợp lệ & Khóa chốt lương Giáo viên (Case U24, U25)', () => {
    it('Case U24: Chặn khi ngày bắt đầu sau ngày kết thúc (newFrom > newTo)', async () => {
      const existing: CoursePricingRecord = {
        id: 'p-t1',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 300000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(existing);
      mockPersistence.findPricingByLevelId.mockResolvedValue([existing]);

      await expect(useCase.execute('p-t1', {
        effectiveFrom: '2026-12-31',
        effectiveTo: '2026-09-01',
      })).rejects.toThrow('Ngày bắt đầu áp dụng không được sau ngày kết thúc.');
    });

    it('Case U25: Chặn sửa mức lương GV khi giai đoạn bắt đầu đã có kỳ chốt lương (maxTeacherWageDate)', async () => {
      const existing: CoursePricingRecord = {
        id: 'p-t1',
        courseLevelId: levelId,
        effectiveFrom: '2026-05-01',
        effectiveTo: '2026-08-31',
        pricePerSession: 0,
        teacherWagePerSession: 300000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingById.mockResolvedValue(existing);
      mockPersistence.getMaxTeacherWageDate.mockResolvedValue('2026-06-30');

      await expect(useCase.execute('p-t1', {
        teacherWagePerSession: 350000,
      })).rejects.toThrow('Không thể thay đổi lương giáo viên vì bảng giá bắt đầu từ');
    });
  });
});
