/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConflictException } from '@nestjs/common';
import { CourseController } from '../../../../src/presentation/controllers/course.controller';
import { CourseLevelPricingOrmEntity } from '../../../../src/infrastructure/persistence/typeorm/entities/course-level-pricing.orm-entity';
import { StudentAttendanceOrmEntity } from '../../../../src/infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { ClassSessionOrmEntity } from '../../../../src/infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { ClassOrmEntity } from '../../../../src/infrastructure/persistence/typeorm/entities/class.orm-entity';
import { TypeOrmCoursePricingPersistenceAdapter } from '../../../../src/modules/academics/infrastructure/persistence/typeorm-course-pricing-persistence.adapter';
import { GetCourseLevelPricingUseCase } from '../../../../src/modules/academics/application/use-cases/get-course-level-pricing.use-case';
import { UpdateCourseLevelPricingUseCase } from '../../../../src/modules/academics/application/use-cases/update-course-level-pricing.use-case';
import { DeleteCourseLevelPricingUseCase } from '../../../../src/modules/academics/application/use-cases/delete-course-level-pricing.use-case';

describe('CourseController - Pricing History, Edit, Delete & Multi-class Billing Locks', () => {
  let controller: CourseController;
  let mockCourseRepo: any;
  let mockLevelRepo: any;
  let mockPricingRepo: any;
  
  // Mock data lists
  let pricingDataStore: CourseLevelPricingOrmEntity[] = [];
  let attendanceDataStore: any[] = [];
  let sessionDataStore: any[] = [];
  let mockClassCount = 0;
  let mockSessionCount = 0;

  beforeEach(() => {
    pricingDataStore = [];
    attendanceDataStore = [];
    sessionDataStore = [];
    mockClassCount = 0;
    mockSessionCount = 0;

    mockCourseRepo = {
      findOneOrFail: jest.fn().mockResolvedValue({ id: 'course-1', name: 'Tiếng Anh THCS' }),
      find: jest.fn(),
    };

    mockLevelRepo = {
      findOneOrFail: jest.fn().mockResolvedValue({ id: 'level-1', levelName: 'Level A1', courseId: 'course-1' }),
      find: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    // Setup a mock query builder for attendance check
    const mockAttendanceQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockImplementation(async () => {
        const dates = attendanceDataStore
          .filter(att => att.billId !== null)
          .map(att => att.classSession?.date)
          .filter(Boolean) as string[];
        if (dates.length === 0) return { maxDate: null };
        return { maxDate: dates.reduce((max, d) => d > max ? d : max, dates[0]) };
      }),
      getCount: jest.fn().mockImplementation(async () => {
        // Simple mock search in attendanceDataStore
        return attendanceDataStore.filter(att => att.billId !== null).length;
      }),
    };

    // Setup a mock query builder for session checks
    const mockSessionQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockImplementation(async () => {
        const dates = sessionDataStore
          .filter(s => s.wageId !== null || s.assistantWageId !== null)
          .map(s => s.date)
          .filter(Boolean) as string[];
        if (dates.length === 0) return { maxDate: null };
        return { maxDate: dates.reduce((max, d) => d > max ? d : max, dates[0]) };
      }),
      getCount: jest.fn().mockImplementation(async () => {
        return mockSessionCount;
      }),
    };

    const mockManager = {
      getRepository: jest.fn().mockImplementation((entity: any) => {
        if (entity === StudentAttendanceOrmEntity) {
          return {
            createQueryBuilder: jest.fn().mockReturnValue(mockAttendanceQueryBuilder),
          };
        }
        if (entity === ClassSessionOrmEntity) {
          return {
            createQueryBuilder: jest.fn().mockReturnValue(mockSessionQueryBuilder),
          };
        }
        if (entity === ClassOrmEntity) {
          return {
            count: jest.fn().mockImplementation(async () => mockClassCount),
          };
        }
        return {};
      }),
    };

    mockPricingRepo = {
      find: jest.fn().mockImplementation(async (options: any) => {
        let list = [...pricingDataStore];
        if (options && options.where) {
          const { courseLevelId, id } = options.where;
          if (courseLevelId) {
            list = list.filter(p => p.courseLevelId === courseLevelId);
          }
          if (id) {
            const excludeId = typeof id === 'object' && id !== null ? (id._value || id.value) : id;
            if (options.where.id && typeof options.where.id === 'object' && options.where.id.constructor?.name === 'FindOperator') {
              // It's a Not operator or other operator
              list = list.filter(p => p.id !== excludeId);
            } else if (id._type === 'not' || (id.constructor && id.constructor.name === 'Not')) {
              list = list.filter(p => p.id !== excludeId);
            } else {
              list = list.filter(p => p.id === id);
            }
          }
        }
        return list;
      }),
      findOne: jest.fn().mockImplementation(async ({ where }: any) => {
        if (where.id) return pricingDataStore.find(p => p.id === where.id) || null;
        if (where.courseLevelId && where.effectiveTo === null) {
          return pricingDataStore.find(p => p.courseLevelId === where.courseLevelId && p.effectiveTo === null) || null;
        }
        return null;
      }),
      findOneOrFail: jest.fn().mockImplementation(async ({ where }: any) => {
        const found = pricingDataStore.find(p => p.id === where.id);
        if (!found) throw new Error('Not found');
        return found;
      }),
      create: jest.fn().mockImplementation((dto: any) => ({ id: 'new-pricing-uuid', ...dto })),
      save: jest.fn().mockImplementation(async (entity: any) => {
        if (!entity.id || entity.id === 'new-pricing-uuid') {
          entity.id = `pricing-${pricingDataStore.length + 1}`;
          pricingDataStore.push(entity);
        } else {
          const idx = pricingDataStore.findIndex(p => p.id === entity.id);
          if (idx !== -1) pricingDataStore[idx] = entity;
        }
        return entity;
      }),
      delete: jest.fn().mockImplementation(async (id: any) => {
        const targetId = typeof id === 'object' ? id.id : id;
        pricingDataStore = pricingDataStore.filter(p => p.id !== targetId);
        return { affected: 1 };
      }),
      manager: mockManager,
    };

    const adapter = new TypeOrmCoursePricingPersistenceAdapter(mockPricingRepo);
    const getUseCase = new GetCourseLevelPricingUseCase(adapter);

    controller = new CourseController(
      mockCourseRepo,
      mockLevelRepo,
      mockPricingRepo,
      getUseCase,
      adapter, // CoursePricingPersistencePort
    );
  });

  describe('Chức năng thêm mới/sửa/xóa bảng giá kèm trợ giảng', () => {
    it('thêm bảng giá mới thành công kèm theo lương trợ giảng taWagePerSession', async () => {
      const dto = {
        pricePerSession: 150000,
        teacherWagePerSession: 80000,
        taWagePerSession: 50000,
        effectiveFrom: '2026-07-15',
        effectiveTo: undefined,
      };

      const result = await (controller as any).addPricing('level-1', dto);

      expect(result).toBeDefined();
      expect(result.taWagePerSession).toBe(50000);
      expect(pricingDataStore.length).toBe(1);
    });



    it('thêm bảng giá mới thành công khi trùng khoảng thời gian với record cũ (cho phép trùng lặp và không tự động thay đổi record cũ)', async () => {
      // Existing record: 2026-01-01 → 2026-08-03
      pricingDataStore.push({
        id: 'pricing-old',
        courseLevelId: 'level-1',
        pricePerSession: 100000,
        teacherWagePerSession: 60000,
        taWagePerSession: 30000,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-08-03',
      } as any);

      // User adds new pricing starting 2026-08-03 (overlaps on 2026-08-03)
      const dto = {
        pricePerSession: 120000,
        teacherWagePerSession: 70000,
        taWagePerSession: 0,
        effectiveFrom: '2026-08-03',
        effectiveTo: undefined,
      };

      const result = await (controller as any).addPricing('level-1', dto);

      expect(result).toBeDefined();
      expect(result.pricePerSession).toBe(120000);
      expect(result.effectiveFrom).toBe('2026-08-03');

      // Old record must remain untouched
      const oldRecord = pricingDataStore.find(p => p.id === 'pricing-old');
      expect(oldRecord?.effectiveTo).toBe('2026-08-03');

      // Both records exist
      expect(pricingDataStore.length).toBe(2);
    });
  });

  describe('Hiệu năng đối soát dữ liệu (Performance SLA Benchmark)', () => {
    it('đối soát trạng thái khóa và trả về danh sách lịch sử giá cho 10,000 bản ghi dưới 50ms', async () => {
      // Setup pricing list
      pricingDataStore.push({
        id: 'pricing-1',
        courseLevelId: 'level-1',
        pricePerSession: 150000,
        teacherWagePerSession: 80000,
        taWagePerSession: 50000,
        effectiveFrom: '2026-07-01',
        effectiveTo: null,
      } as any);

      // Giả lập dataset lớn cho attendance & session
      attendanceDataStore = Array.from({ length: 10000 }, (_, i) => ({
        id: `att-${i}`,
        billId: i % 100 === 0 ? `bill-${i}` : null,
      }));

      sessionDataStore = Array.from({ length: 2000 }, (_, i) => ({
        id: `session-${i}`,
        wageId: i % 50 === 0 ? `wage-${i}` : null,
        assistantWageId: null,
      }));

      // Đo thời gian đối soát logic và trả về lịch sử giá
      const startTime = performance.now();
      const pricingHistory = await (controller as any).getPricing('level-1');
      const executionTime = performance.now() - startTime;

      expect(pricingHistory).toBeDefined();
      expect(pricingHistory.length).toBe(1);
      
      // SLA Target: < 50ms cho việc chạy logic đối soát trên RAM (Unit Test)
      expect(executionTime).toBeLessThan(50);
      console.log(`Course pricing lock query performance: ${executionTime.toFixed(2)}ms`);
    });
  });

  describe('Chức năng xóa Level', () => {
    it('xóa Level thành công khi chưa có lớp học hoặc buổi học nào sử dụng', async () => {
      mockClassCount = 0;
      mockSessionCount = 0;

      const result = await controller.deleteLevel('level-1');

      expect(result).toEqual({ message: 'Xóa Level thành công' });
      expect(mockLevelRepo.delete).toHaveBeenCalledWith('level-1');
    });

    it('không cho xóa Level khi có lớp học sử dụng và báo lỗi ConflictException', async () => {
      mockClassCount = 1;
      mockSessionCount = 0;

      await expect(controller.deleteLevel('level-1')).rejects.toThrow(ConflictException);
    });

    it('không cho xóa Level khi có buổi học liên quan và báo lỗi ConflictException', async () => {
      mockClassCount = 0;
      mockSessionCount = 3;

      await expect(controller.deleteLevel('level-1')).rejects.toThrow(ConflictException);
    });
  });
});
