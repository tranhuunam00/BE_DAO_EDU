import { CreateCourseLevelPricingUseCase } from '../../../../../../src/modules/academics/application/use-cases/create-course-level-pricing.use-case';
import { CoursePricingPersistencePort, CoursePricingRecord } from '../../../../../../src/modules/academics/application/ports/course-pricing-persistence.port';
import { AcademicError } from '../../../../../../src/modules/academics/domain/errors/academic.error';

describe('Teacher and TA Pricing Creation Suite (25 Cases)', () => {
  let useCase: CreateCourseLevelPricingUseCase;
  let mockPersistence: jest.Mocked<CoursePricingPersistencePort>;
  const levelId = 'lvl-test-101';

  beforeEach(() => {
    mockPersistence = {
      findPricingByLevelId: jest.fn().mockResolvedValue([]),
      findPricingById: jest.fn().mockResolvedValue(null),
      findActivePricing: jest.fn().mockResolvedValue(null),
      savePricing: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      createPricing: jest.fn().mockImplementation((p) => Promise.resolve({ id: 'p-new-1', ...p })),
      deletePricing: jest.fn().mockResolvedValue(undefined),
      checkStudentBills: jest.fn().mockResolvedValue(false),
      checkTeacherWages: jest.fn().mockResolvedValue(false),
      checkAssistantWages: jest.fn().mockResolvedValue(false),
      getMaxStudentBillDate: jest.fn().mockResolvedValue(null),
      getMaxTeacherWageDate: jest.fn().mockResolvedValue(null),
      getMaxAssistantWageDate: jest.fn().mockResolvedValue(null),
    };
    useCase = new CreateCourseLevelPricingUseCase(mockPersistence);
  });

  describe('Nhóm 1: Tạo mới lương Giáo viên độc lập (Cases T01 - T05)', () => {
    it('Case T01: Tạo mức lương GV cơ bản thành công với rate riêng, price và taWage bằng 0', async () => {
      await useCase.execute(levelId, {
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        teacherWagePerSession: 300000,
      });

      expect(mockPersistence.createPricing).toHaveBeenCalledWith(expect.objectContaining({
        courseLevelId: levelId,
        teacherWagePerSession: 300000,
        pricePerSession: 0,
        taWagePerSession: 0,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
      }));
    });

    it('Case T02: Tạo mức lương GV với số tiền lớn (1,500,000đ/buổi)', async () => {
      await useCase.execute(levelId, {
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-06-30',
        teacherWagePerSession: 1500000,
      });
      expect(mockPersistence.createPricing).toHaveBeenCalledWith(expect.objectContaining({
        teacherWagePerSession: 1500000,
      }));
    });

    it('Case T03: Tạo mức lương GV cho cả năm (01/01/2026 - 31/12/2026)', async () => {
      await useCase.execute(levelId, {
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
        teacherWagePerSession: 250000,
      });
      expect(mockPersistence.createPricing).toHaveBeenCalledWith(expect.objectContaining({
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
      }));
    });

    it('Case T04: Chặn khi lương GV là số âm (-50,000đ)', async () => {
      await expect(useCase.execute(levelId, {
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        teacherWagePerSession: -50000,
      })).rejects.toThrow(AcademicError);
    });

    it('Case T05: Tạo mức lương GV cho ca ngắn 1 tháng (01/09/2026 - 30/09/2026)', async () => {
      await useCase.execute(levelId, {
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-09-30',
        teacherWagePerSession: 400000,
      });
      expect(mockPersistence.createPricing).toHaveBeenCalledWith(expect.objectContaining({
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-09-30',
      }));
    });
  });

  describe('Nhóm 2: Tạo mới lương Trợ giảng độc lập (Cases T06 - T10)', () => {
    it('Case T06: Tạo mức lương TA thành công, price và teacherWage bằng 0', async () => {
      await useCase.execute(levelId, {
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        taWagePerSession: 100000,
      });

      expect(mockPersistence.createPricing).toHaveBeenCalledWith(expect.objectContaining({
        taWagePerSession: 100000,
        pricePerSession: 0,
        teacherWagePerSession: 0,
      }));
    });

    it('Case T07: Tạo mức lương TA cho kỳ hè (01/06/2026 - 31/08/2026)', async () => {
      await useCase.execute(levelId, {
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
        taWagePerSession: 80000,
      });
      expect(mockPersistence.createPricing).toHaveBeenCalledWith(expect.objectContaining({
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
      }));
    });

    it('Case T08: Chặn khi lương TA là số âm (-20,000đ)', async () => {
      await expect(useCase.execute(levelId, {
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        taWagePerSession: -20000,
      })).rejects.toThrow(AcademicError);
    });

    it('Case T09: Tạo mức lương TA mức cao cho sinh viên trợ giảng chất lượng cao (150,000đ)', async () => {
      await useCase.execute(levelId, {
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-12-31',
        taWagePerSession: 150000,
      });
      expect(mockPersistence.createPricing).toHaveBeenCalledWith(expect.objectContaining({
        taWagePerSession: 150000,
      }));
    });

    it('Case T10: Tạo mức lương TA đúng 1 ngày (01/09/2026 - 01/09/2026)', async () => {
      await useCase.execute(levelId, {
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-09-01',
        taWagePerSession: 120000,
      });
      expect(mockPersistence.createPricing).toHaveBeenCalledWith(expect.objectContaining({
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-09-01',
      }));
    });
  });

  describe('Nhóm 3: Cô lập dải ngày giữa Học viên và Giáo viên/Trợ giảng (Cases T11 - T18)', () => {
    it('Case T11: Cho phép lương GV có dải ngày trùng hoàn toàn với Học viên', async () => {
      const studentPricing: CoursePricingRecord = {
        id: 'p-student',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 200000,
        teacherWagePerSession: 0,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingByLevelId.mockResolvedValue([studentPricing]);

      await expect(useCase.execute(levelId, {
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        teacherWagePerSession: 300000,
      })).resolves.toBeDefined();
    });

    it('Case T12: Cho phép lương TA có dải ngày trùng hoàn toàn với Học viên', async () => {
      const studentPricing: CoursePricingRecord = {
        id: 'p-student',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 200000,
        teacherWagePerSession: 0,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingByLevelId.mockResolvedValue([studentPricing]);

      await expect(useCase.execute(levelId, {
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        taWagePerSession: 100000,
      })).resolves.toBeDefined();
    });

    it('Case T13: Cho phép lương GV có dải ngày nằm lọt trong dải ngày Học viên (10/09 - 20/10)', async () => {
      const studentPricing: CoursePricingRecord = {
        id: 'p-student',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 200000,
        teacherWagePerSession: 0,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingByLevelId.mockResolvedValue([studentPricing]);

      await expect(useCase.execute(levelId, {
        effectiveFrom: '2026-09-10',
        effectiveTo: '2026-10-20',
        teacherWagePerSession: 350000,
      })).resolves.toBeDefined();
    });

    it('Case T14: Cho phép lương TA có dải ngày bao trùm rộng hơn dải ngày Học viên (01/01 - 31/12)', async () => {
      const studentPricing: CoursePricingRecord = {
        id: 'p-student',
        courseLevelId: levelId,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
        pricePerSession: 180000,
        teacherWagePerSession: 0,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingByLevelId.mockResolvedValue([studentPricing]);

      await expect(useCase.execute(levelId, {
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
        taWagePerSession: 90000,
      })).resolves.toBeDefined();
    });

    it('Case T15: Cho phép lương GV so le (bắt đầu trước, kết thúc giữa chừng kỳ học viên)', async () => {
      const studentPricing: CoursePricingRecord = {
        id: 'p-student',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 250000,
        teacherWagePerSession: 0,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingByLevelId.mockResolvedValue([studentPricing]);

      await expect(useCase.execute(levelId, {
        effectiveFrom: '2026-08-01',
        effectiveTo: '2026-10-31',
        teacherWagePerSession: 280000,
      })).resolves.toBeDefined();
    });

    it('Case T16: Cho phép lương GV và lương TA trùng dải ngày với nhau (cùng 01/09 - 31/12)', async () => {
      const teacherPricing: CoursePricingRecord = {
        id: 'p-teacher',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 300000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingByLevelId.mockResolvedValue([teacherPricing]);

      await expect(useCase.execute(levelId, {
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        taWagePerSession: 100000,
      })).resolves.toBeDefined();
    });

    it('Case T17: Cho phép tạo đồng thời cả 3 loại giá trên 1 bản ghi nếu người dùng nhập đủ', async () => {
      await useCase.execute(levelId, {
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 200000,
        teacherWagePerSession: 300000,
        taWagePerSession: 100000,
      });

      expect(mockPersistence.createPricing).toHaveBeenCalledWith(expect.objectContaining({
        pricePerSession: 200000,
        teacherWagePerSession: 300000,
        taWagePerSession: 100000,
      }));
    });

    it('Case T18: Cho phép tạo kết hợp lương GV và lương TA (học phí = 0)', async () => {
      await useCase.execute(levelId, {
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        teacherWagePerSession: 320000,
        taWagePerSession: 110000,
      });

      expect(mockPersistence.createPricing).toHaveBeenCalledWith(expect.objectContaining({
        pricePerSession: 0,
        teacherWagePerSession: 320000,
        taWagePerSession: 110000,
      }));
    });
  });

  describe('Nhóm 4: Chặn trùng dải ngày cùng đối tượng & Validations (Cases T19 - T25)', () => {
    it('Case T19: Chặn tạo lương GV trùng dải ngày với một mức lương GV khác đã có', async () => {
      const existingTeacherWage: CoursePricingRecord = {
        id: 'p-t1',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 300000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingByLevelId.mockResolvedValue([existingTeacherWage]);

      await expect(useCase.execute(levelId, {
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-11-30',
        teacherWagePerSession: 350000,
      })).rejects.toThrow(AcademicError);
    });

    it('Case T20: Chặn tạo lương GV chạm biên với mức lương GV cũ (chạm đầu 01/09)', async () => {
      const existingTeacherWage: CoursePricingRecord = {
        id: 'p-t1',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 300000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingByLevelId.mockResolvedValue([existingTeacherWage]);

      await expect(useCase.execute(levelId, {
        effectiveFrom: '2026-08-01',
        effectiveTo: '2026-09-01',
        teacherWagePerSession: 280000,
      })).rejects.toThrow(AcademicError);
    });

    it('Case T21: Cho phép tạo lương GV liền kề không chạm (kết thúc 31/08, bắt đầu 01/09)', async () => {
      const existingTeacherWage: CoursePricingRecord = {
        id: 'p-t1',
        courseLevelId: levelId,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 300000,
        taWagePerSession: 0,
      };
      mockPersistence.findPricingByLevelId.mockResolvedValue([existingTeacherWage]);

      await expect(useCase.execute(levelId, {
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
        teacherWagePerSession: 280000,
      })).resolves.toBeDefined();
    });

    it('Case T22: Chặn tạo lương TA trùng dải ngày với một mức lương TA khác', async () => {
      const existingTaWage: CoursePricingRecord = {
        id: 'p-ta1',
        courseLevelId: levelId,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 80000,
      };
      mockPersistence.findPricingByLevelId.mockResolvedValue([existingTaWage]);

      await expect(useCase.execute(levelId, {
        effectiveFrom: '2026-07-01',
        effectiveTo: '2026-07-31',
        taWagePerSession: 90000,
      })).rejects.toThrow(AcademicError);
    });

    it('Case T23: Cho phép tạo lương TA ở đợt tiếp theo không trùng (01/09 - 31/12)', async () => {
      const existingTaWage: CoursePricingRecord = {
        id: 'p-ta1',
        courseLevelId: levelId,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 80000,
      };
      mockPersistence.findPricingByLevelId.mockResolvedValue([existingTaWage]);

      await expect(useCase.execute(levelId, {
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        taWagePerSession: 100000,
      })).resolves.toBeDefined();
    });

    it('Case T24: Chặn khi ngày bắt đầu sau ngày kết thúc (effectiveFrom > effectiveTo)', async () => {
      await expect(useCase.execute(levelId, {
        effectiveFrom: '2026-12-31',
        effectiveTo: '2026-09-01',
        teacherWagePerSession: 300000,
      })).rejects.toThrow(AcademicError);
    });

    it('Case T25: Chặn khi không có mức giá nào lớn hơn 0 (toàn bộ là 0 hoặc undefined)', async () => {
      await expect(useCase.execute(levelId, {
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
        pricePerSession: 0,
        teacherWagePerSession: 0,
        taWagePerSession: 0,
      })).rejects.toThrow(AcademicError);
    });
  });
});
