/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CourseController } from '../../../../src/presentation/controllers/course.controller';
import { ClassOrmEntity } from '../../../../src/infrastructure/persistence/typeorm/entities/class.orm-entity';
import { ClassSessionOrmEntity } from '../../../../src/infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { GetCourseLevelPricingUseCase } from '../../../../src/modules/academics/application/use-cases/get-course-level-pricing.use-case';
import { CreateCourseLevelPricingUseCase } from '../../../../src/modules/academics/application/use-cases/create-course-level-pricing.use-case';
import { UpdateCourseLevelPricingUseCase } from '../../../../src/modules/academics/application/use-cases/update-course-level-pricing.use-case';
import { DeleteCourseLevelPricingUseCase } from '../../../../src/modules/academics/application/use-cases/delete-course-level-pricing.use-case';
import { AcademicError } from '../../../../src/modules/academics/domain/errors/academic.error';

describe('CourseController Presentation & Delegation Test Suite', () => {
  let controller: CourseController;
  let mockCourseRepo: any;
  let mockLevelRepo: any;
  let mockPricingRepo: any;
  let mockClassRepo: any;
  let mockSessionRepo: any;
  let mockGetPricingUseCase: any;
  let mockCreatePricingUseCase: any;
  let mockUpdatePricingUseCase: any;
  let mockDeletePricingUseCase: any;
  let mockPersistencePort: any;

  beforeEach(() => {
    mockCourseRepo = {
      findOneOrFail: jest.fn().mockResolvedValue({ id: 'course-1', name: 'Tiếng Anh THCS' }),
      find: jest.fn(),
      save: jest.fn().mockImplementation(async (c: any) => c),
      create: jest.fn().mockImplementation((dto: any) => ({ id: 'new-course-id', ...dto })),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      }),
    };

    mockLevelRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      findOneOrFail: jest.fn().mockResolvedValue({ id: 'level-1', levelName: 'Level A1', courseId: 'course-1' }),
      find: jest.fn().mockResolvedValue([{ id: 'level-1', levelName: 'Level A1', courseId: 'course-1' }]),
      create: jest.fn().mockImplementation((dto: any) => ({ id: 'new-level-id', ...dto })),
      save: jest.fn().mockImplementation(async (l: any) => l),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    mockClassRepo = {
      count: jest.fn().mockResolvedValue(0),
    };

    mockSessionRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      }),
    };

    mockPricingRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(async (p: any) => p),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      manager: {
        getRepository: jest.fn().mockImplementation((entity: any) => {
          if (entity === ClassOrmEntity) return mockClassRepo;
          if (entity === ClassSessionOrmEntity) return mockSessionRepo;
          return {};
        }),
      },
    };

    mockGetPricingUseCase = {
      execute: jest.fn().mockResolvedValue([]),
    };

    mockCreatePricingUseCase = {
      execute: jest.fn().mockResolvedValue({
        id: 'pricing-1',
        courseLevelId: 'level-1',
        pricePerSession: 150000,
        teacherWagePerSession: 80000,
        taWagePerSession: 40000,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
      }),
    };

    mockUpdatePricingUseCase = {
      execute: jest.fn().mockResolvedValue({
        id: 'pricing-1',
        pricePerSession: 180000,
      }),
    };

    mockDeletePricingUseCase = {
      execute: jest.fn().mockResolvedValue(undefined),
    };

    mockPersistencePort = {
      findPricingByLevelId: jest.fn().mockResolvedValue([]),
      findPricingById: jest.fn().mockResolvedValue(null),
      createPricing: jest.fn(),
      updatePricing: jest.fn(),
      deletePricing: jest.fn(),
      getMaxStudentBillDate: jest.fn().mockResolvedValue(null),
      getMaxTeacherWageDate: jest.fn().mockResolvedValue(null),
      getMaxAssistantWageDate: jest.fn().mockResolvedValue(null),
      countClassesUsingLevel: jest.fn().mockResolvedValue(0),
      countSessionsUsingLevel: jest.fn().mockResolvedValue(0),
    };

    controller = new CourseController(
      mockCourseRepo,
      mockLevelRepo,
      mockPricingRepo,
      mockGetPricingUseCase as unknown as GetCourseLevelPricingUseCase,
      mockCreatePricingUseCase as unknown as CreateCourseLevelPricingUseCase,
      mockUpdatePricingUseCase as unknown as UpdateCourseLevelPricingUseCase,
      mockDeletePricingUseCase as unknown as DeleteCourseLevelPricingUseCase,
      mockPersistencePort,
    );
  });

  describe('Level Pricing Endpoints & UseCase Delegation', () => {
    it('GET /courses/levels/:levelId/pricing ủy quyền chính xác cho GetCourseLevelPricingUseCase', async () => {
      const mockResult = [{ id: 'p-1', courseLevelId: 'level-1', pricePerSession: 100000 }];
      mockGetPricingUseCase.execute.mockResolvedValueOnce(mockResult);

      const result = await controller.getPricing('level-1');
      expect(result).toEqual(mockResult);
      expect(mockGetPricingUseCase.execute).toHaveBeenCalledWith('level-1');
    });

    it('POST /courses/levels/:levelId/pricing ủy quyền chính xác cho CreateCourseLevelPricingUseCase', async () => {
      const dto = {
        pricePerSession: 150000,
        teacherWagePerSession: 80000,
        taWagePerSession: 40000,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-12-31',
      };

      const result = await controller.addPricing('level-1', dto as any);
      expect(result.id).toBe('pricing-1');
      expect(mockCreatePricingUseCase.execute).toHaveBeenCalledWith('level-1', dto);
    });

    it('PUT /courses/pricing/:id ủy quyền chính xác cho UpdateCourseLevelPricingUseCase', async () => {
      const dto = { pricePerSession: 180000, effectiveTo: '2026-12-31' };
      const result = await controller.updatePricing('pricing-1', dto as any);

      expect(result.pricePerSession).toBe(180000);
      expect(mockUpdatePricingUseCase.execute).toHaveBeenCalledWith('pricing-1', dto);
    });

    it('DELETE /courses/pricing/:id ủy quyền chính xác cho DeleteCourseLevelPricingUseCase', async () => {
      const result = await controller.deletePricing('pricing-1');
      expect(result).toBeUndefined();
      expect(mockDeletePricingUseCase.execute).toHaveBeenCalledWith('pricing-1');
    });
  });

  describe('Exception Mapping via runAcademic Helper', () => {
    it('Chuyển đổi PRICING_NOT_FOUND thành NotFoundException (404)', async () => {
      mockUpdatePricingUseCase.execute.mockRejectedValue(
        new AcademicError('PRICING_NOT_FOUND', 'Không tìm thấy bảng giá lịch sử này.'),
      );

      await expect(controller.updatePricing('p-not-found', {} as any)).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.updatePricing('p-not-found', {} as any)).rejects.toThrow(
        'Không tìm thấy bảng giá lịch sử này.',
      );
    });

    it('Chuyển đổi BAD_REQUEST thành BadRequestException (400)', async () => {
      mockCreatePricingUseCase.execute.mockRejectedValue(
        new AcademicError('BAD_REQUEST', 'Ngày kết thúc không được để trống'),
      );

      await expect(controller.addPricing('level-1', {} as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.addPricing('level-1', {} as any)).rejects.toThrow(
        'Ngày kết thúc không được để trống',
      );
    });

    it('Chuyển đổi INVALID_PRICING_TIMELINE thành BadRequestException (400)', async () => {
      mockCreatePricingUseCase.execute.mockRejectedValue(
        new AcademicError('INVALID_PRICING_TIMELINE', 'Ngày bắt đầu không được sau ngày kết thúc'),
      );

      await expect(controller.addPricing('level-1', {} as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('Chuyển đổi INVALID_PRICING_AMOUNT thành BadRequestException (400)', async () => {
      mockCreatePricingUseCase.execute.mockRejectedValue(
        new AcademicError('INVALID_PRICING_AMOUNT', 'Đơn giá không được âm'),
      );

      await expect(controller.addPricing('level-1', {} as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('Chuyển đổi PRICING_CONFLICT thành ConflictException (409)', async () => {
      mockCreatePricingUseCase.execute.mockRejectedValue(
        new AcademicError('PRICING_CONFLICT', 'Khoảng thời gian áp dụng bị trùng lặp.'),
      );

      await expect(controller.addPricing('level-1', {} as any)).rejects.toThrow(
        ConflictException,
      );
      await expect(controller.addPricing('level-1', {} as any)).rejects.toThrow(
        'Khoảng thời gian áp dụng bị trùng lặp.',
      );
    });
  });

  describe('Course Level Management Endpoints', () => {
    it('Xóa Level thành công khi chưa có lớp hoặc buổi học nào sử dụng', async () => {
      mockClassRepo.count.mockResolvedValue(0);
      mockSessionRepo.createQueryBuilder().getCount.mockResolvedValue(0);

      const result = await controller.deleteLevel('level-1');
      expect(result).toEqual({ message: 'Xóa Level thành công' });
      expect(mockLevelRepo.delete).toHaveBeenCalledWith('level-1');
    });

    it('Chặn xóa Level khi đã có lớp học sử dụng và báo lỗi ConflictException', async () => {
      mockClassRepo.count.mockResolvedValue(2);

      await expect(controller.deleteLevel('level-1')).rejects.toThrow(ConflictException);
      await expect(controller.deleteLevel('level-1')).rejects.toThrow(
        'Không thể xóa Level vì đã có lớp học sử dụng.',
      );
    });

    it('Chặn xóa Level khi đã có buổi học sử dụng và báo lỗi ConflictException', async () => {
      mockClassRepo.count.mockResolvedValue(0);
      mockSessionRepo.createQueryBuilder().getCount.mockResolvedValue(5);

      await expect(controller.deleteLevel('level-1')).rejects.toThrow(ConflictException);
      await expect(controller.deleteLevel('level-1')).rejects.toThrow(
        'Không thể xóa Level vì có buổi học/điểm danh liên quan.',
      );
    });
  });
});
