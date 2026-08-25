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
import { AcademicError } from '../../../../src/modules/academics/domain/errors/academic.error';

describe('CourseController & Level Pricing Management Comprehensive Test Suite (30+ Cases)', () => {
  let controller: CourseController;
  let adapter: TypeOrmCoursePricingPersistenceAdapter;
  let getUseCase: GetCourseLevelPricingUseCase;
  let updateUseCase: UpdateCourseLevelPricingUseCase;
  let deleteUseCase: DeleteCourseLevelPricingUseCase;

  let mockCourseRepo: any;
  let mockLevelRepo: any;
  let mockPricingRepo: any;

  // In-memory data stores for unit testing
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

    const mockAttendanceQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockImplementation(async () => {
        const dates = attendanceDataStore
          .filter((att) => att.billId !== null)
          .map((att) => att.classSession?.date)
          .filter(Boolean) as string[];
        if (dates.length === 0) return { maxDate: null };
        return { maxDate: dates.reduce((max, d) => (d > max ? d : max), dates[0]) };
      }),
      getCount: jest.fn().mockImplementation(async () => {
        return attendanceDataStore.filter((att) => att.billId !== null).length;
      }),
    };

    let currentSessionFilter: 'wage' | 'assistant' | 'all' = 'all';
    const mockSessionQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockImplementation((condition: string) => {
        if (condition.includes('session.wageId IS NOT NULL')) {
          currentSessionFilter = 'wage';
        } else if (condition.includes('session.assistantWageId IS NOT NULL')) {
          currentSessionFilter = 'assistant';
        }
        return mockSessionQueryBuilder;
      }),
      select: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockImplementation(async () => {
        let dates: string[] = [];
        if (currentSessionFilter === 'wage') {
          dates = sessionDataStore.filter((s) => s.wageId !== null).map((s) => s.date).filter(Boolean);
        } else if (currentSessionFilter === 'assistant') {
          dates = sessionDataStore.filter((s) => s.assistantWageId !== null).map((s) => s.date).filter(Boolean);
        } else {
          dates = sessionDataStore
            .filter((s) => s.wageId !== null || s.assistantWageId !== null)
            .map((s) => s.date)
            .filter(Boolean);
        }
        currentSessionFilter = 'all';
        if (dates.length === 0) return { maxDate: null };
        return { maxDate: dates.reduce((max, d) => (d > max ? d : max), dates[0]) };
      }),
      getCount: jest.fn().mockImplementation(async () => {
        let count = 0;
        if (currentSessionFilter === 'wage') {
          count = sessionDataStore.filter((s) => s.wageId !== null).length;
        } else if (currentSessionFilter === 'assistant') {
          count = sessionDataStore.filter((s) => s.assistantWageId !== null).length;
        } else {
          count = sessionDataStore.filter((s) => s.wageId !== null || s.assistantWageId !== null).length;
        }
        currentSessionFilter = 'all';
        return count + mockSessionCount;
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
            list = list.filter((p) => p.courseLevelId === courseLevelId);
          }
          if (id) {
            const excludeId = typeof id === 'object' && id !== null ? id._value || id.value : id;
            if (
              options.where.id &&
              typeof options.where.id === 'object' &&
              options.where.id.constructor?.name === 'FindOperator'
            ) {
              list = list.filter((p) => p.id !== excludeId);
            } else if (id._type === 'not' || (id.constructor && id.constructor.name === 'Not')) {
              list = list.filter((p) => p.id !== excludeId);
            } else {
              list = list.filter((p) => p.id === id);
            }
          }
        }
        if (options && options.order && options.order.effectiveFrom === 'ASC') {
          list.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
        }
        return list;
      }),
      findOne: jest.fn().mockImplementation(async ({ where }: any) => {
        if (where.id) return pricingDataStore.find((p) => p.id === where.id) || null;
        if (where.courseLevelId && where.effectiveTo === null) {
          return (
            pricingDataStore.find(
              (p) => p.courseLevelId === where.courseLevelId && p.effectiveTo === null
            ) || null
          );
        }
        return null;
      }),
      findOneOrFail: jest.fn().mockImplementation(async ({ where }: any) => {
        const found = pricingDataStore.find((p) => p.id === where.id);
        if (!found) throw new Error('Not found');
        return found;
      }),
      create: jest.fn().mockImplementation((dto: any) => ({
        id: `pricing-${pricingDataStore.length + 1}-${Date.now()}`,
        ...dto,
      })),
      save: jest.fn().mockImplementation(async (entity: any) => {
        if (!entity.id) {
          entity.id = `pricing-${pricingDataStore.length + 1}`;
          pricingDataStore.push(entity);
        } else {
          const idx = pricingDataStore.findIndex((p) => p.id === entity.id);
          if (idx !== -1) {
            pricingDataStore[idx] = entity;
          } else {
            pricingDataStore.push(entity);
          }
        }
        return entity;
      }),
      delete: jest.fn().mockImplementation(async (id: any) => {
        const targetId = typeof id === 'object' ? id.id : id;
        pricingDataStore = pricingDataStore.filter((p) => p.id !== targetId);
        return { affected: 1 };
      }),
      manager: mockManager,
    };

    adapter = new TypeOrmCoursePricingPersistenceAdapter(mockPricingRepo);
    getUseCase = new GetCourseLevelPricingUseCase(adapter);
    updateUseCase = new UpdateCourseLevelPricingUseCase(adapter);
    deleteUseCase = new DeleteCourseLevelPricingUseCase(adapter);

    controller = new CourseController(
      mockCourseRepo,
      mockLevelRepo,
      mockPricingRepo,
      getUseCase,
      updateUseCase,
      deleteUseCase,
      adapter
    );
  });

  // =========================================================================
  // CATEGORY 1: Reconciliation Date Guard on Adding Pricing (addPricing)
  // =========================================================================
  describe('Category 1: Reconciliation Date Guard khi Thêm Biểu Giá (CourseController.addPricing)', () => {
    it('Case 1: Chặn thêm học phí khi effectiveFrom <= lastStudentBillDate', async () => {
      attendanceDataStore = [
        { id: 'att-1', billId: 'bill-101', classSession: { date: '2026-08-15' } },
      ];

      const dto = {
        pricePerSession: 150000,
        effectiveFrom: '2026-08-10',
      };

      await expect(controller.addPricing('level-1', dto as any)).rejects.toThrow(ConflictException);
      await expect(controller.addPricing('level-1', dto as any)).rejects.toThrow(
        /sau ngày chốt học phí gần nhất \(2026-08-15\)/
      );
    });

    it('Case 2: Chặn thêm lương giáo viên khi effectiveFrom <= lastTeacherWageDate', async () => {
      sessionDataStore = [
        { id: 'sess-1', wageId: 'wage-202', assistantWageId: null, date: '2026-08-20' },
      ];

      const dto = {
        teacherWagePerSession: 90000,
        effectiveFrom: '2026-08-20', // trùng ngày chốt lương
      };

      await expect(controller.addPricing('level-1', dto as any)).rejects.toThrow(ConflictException);
      await expect(controller.addPricing('level-1', dto as any)).rejects.toThrow(
        /sau ngày chốt lương gần nhất \(2026-08-20\)/
      );
    });

    it('Case 3: Chặn thêm lương trợ giảng khi effectiveFrom <= lastAssistantWageDate', async () => {
      sessionDataStore = [
        { id: 'sess-2', wageId: null, assistantWageId: 'ta-wage-303', date: '2026-08-22' },
      ];

      const dto = {
        taWagePerSession: 55000,
        effectiveFrom: '2026-08-21',
      };

      await expect(controller.addPricing('level-1', dto as any)).rejects.toThrow(ConflictException);
      await expect(controller.addPricing('level-1', dto as any)).rejects.toThrow(
        /sau ngày chốt lương trợ giảng gần nhất \(2026-08-22\)/
      );
    });

    it('Case 4: Cho phép thêm biểu giá hợp lệ khi effectiveFrom > tất cả các ngày chốt sổ', async () => {
      attendanceDataStore = [
        { id: 'att-1', billId: 'bill-101', classSession: { date: '2026-08-15' } },
      ];
      sessionDataStore = [
        { id: 'sess-1', wageId: 'wage-202', assistantWageId: 'ta-wage-303', date: '2026-08-18' },
      ];

      const dto = {
        pricePerSession: 180000,
        teacherWagePerSession: 100000,
        taWagePerSession: 60000,
        effectiveFrom: '2026-08-19',
      };

      const result = await controller.addPricing('level-1', dto as any);
      expect(result).toBeDefined();
      expect(result.pricePerSession).toBe(180000);
      expect(result.effectiveFrom).toBe('2026-08-19');
    });

    it('Case 5: Chặn ném lỗi ConflictException khi effectiveFrom > effectiveTo', async () => {
      const dto = {
        pricePerSession: 150000,
        effectiveFrom: '2026-09-10',
        effectiveTo: '2026-09-01',
      };

      await expect(controller.addPricing('level-1', dto as any)).rejects.toThrow(ConflictException);
      await expect(controller.addPricing('level-1', dto as any)).rejects.toThrow(
        /Ngày bắt đầu áp dụng không được sau ngày kết thúc/
      );
    });
  });

  // =========================================================================
  // CATEGORY 2: Value Inheritance (Kế Thừa Đơn Giá Không Đổi)
  // =========================================================================
  describe('Category 2: Kế Thừa Giá Trị Không Cấu Hình (Value Inheritance)', () => {
    beforeEach(() => {
      pricingDataStore.push({
        id: 'pricing-active',
        courseLevelId: 'level-1',
        pricePerSession: 120000,
        teacherWagePerSession: 70000,
        taWagePerSession: 40000,
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
      } as any);
    });

    it('Case 6: Kế thừa lương GV và lương TG khi người dùng chỉ đổi học phí học sinh', async () => {
      const dto = {
        pricePerSession: 160000,
        effectiveFrom: '2026-09-01',
      };

      const result = await controller.addPricing('level-1', dto as any);
      expect(result.pricePerSession).toBe(160000);
      expect(result.teacherWagePerSession).toBe(70000); // Kế thừa
      expect(result.taWagePerSession).toBe(40000); // Kế thừa
    });

    it('Case 7: Kế thừa học phí HS và lương TG khi người dùng chỉ đổi lương GV', async () => {
      const dto = {
        teacherWagePerSession: 95000,
        effectiveFrom: '2026-09-01',
      };

      const result = await controller.addPricing('level-1', dto as any);
      expect(result.pricePerSession).toBe(120000); // Kế thừa
      expect(result.teacherWagePerSession).toBe(95000);
      expect(result.taWagePerSession).toBe(40000); // Kế thừa
    });

    it('Case 8: Kế thừa học phí HS và lương GV khi người dùng chỉ đổi lương TG', async () => {
      const dto = {
        taWagePerSession: 55000,
        effectiveFrom: '2026-09-01',
      };

      const result = await controller.addPricing('level-1', dto as any);
      expect(result.pricePerSession).toBe(120000); // Kế thừa
      expect(result.teacherWagePerSession).toBe(70000); // Kế thừa
      expect(result.taWagePerSession).toBe(55000);
    });

    it('Case 9: Khởi tạo giá mặc định là 0 nếu Level chưa có bất kỳ biểu giá nào trước đó', async () => {
      pricingDataStore = []; // Xóa hết biểu giá

      const dto = {
        pricePerSession: 140000,
        effectiveFrom: '2026-09-01',
      };

      const result = await controller.addPricing('level-1', dto as any);
      expect(result.pricePerSession).toBe(140000);
      expect(result.teacherWagePerSession).toBe(0);
      expect(result.taWagePerSession).toBe(0);
    });
  });

  // =========================================================================
  // CATEGORY 3: Timeline Slicing & Splitting (Cắt/Tách Khoảng Thời Gian)
  // =========================================================================
  describe('Category 3: Thuật toán Tách & Cắt Dòng Thời Gian (Timeline Splitting & Slicing)', () => {
    it('Case 10 (Trùng ngày bắt đầu): Ghi đè trực tiếp vào bản ghi cũ nếu newFrom trùng oldFrom', async () => {
      pricingDataStore.push({
        id: 'pricing-same-start',
        courseLevelId: 'level-1',
        pricePerSession: 100000,
        teacherWagePerSession: 60000,
        taWagePerSession: 30000,
        effectiveFrom: '2026-09-01',
        effectiveTo: null,
      } as any);

      const dto = {
        pricePerSession: 150000,
        effectiveFrom: '2026-09-01',
      };

      const result = await controller.addPricing('level-1', dto as any);
      expect(result.id).toBe('pricing-same-start');
      expect(result.pricePerSession).toBe(150000);
      expect(pricingDataStore.length).toBe(1);
    });

    it('Case 11 (Tách 3 đoạn - chèn giá hè có hạn vào giữa khoảng mở vô hạn): Sinh ra 3 đoạn [Trước, Giữa, Sau]', async () => {
      pricingDataStore.push({
        id: 'pricing-initial',
        courseLevelId: 'level-1',
        pricePerSession: 100000,
        teacherWagePerSession: 60000,
        taWagePerSession: 30000,
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
      } as any);

      // Chèn giá ưu đãi hè: [2026-06-01 -> 2026-08-31]
      const dto = {
        pricePerSession: 80000,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
      };

      await controller.addPricing('level-1', dto as any);

      // Cần có đúng 3 bản ghi trong store
      expect(pricingDataStore.length).toBe(3);

      // Đoạn 1 (Trước): 2026-01-01 -> 2026-05-31 (Giá 100k)
      const seg1 = pricingDataStore.find((p) => p.effectiveFrom === '2026-01-01');
      expect(seg1?.effectiveTo).toBe('2026-05-31');
      expect(seg1?.pricePerSession).toBe(100000);

      // Đoạn 2 (Giữa): 2026-06-01 -> 2026-08-31 (Giá ưu đãi 80k + kế thừa lương)
      const seg2 = pricingDataStore.find((p) => p.effectiveFrom === '2026-06-01');
      expect(seg2?.effectiveTo).toBe('2026-08-31');
      expect(seg2?.pricePerSession).toBe(80000);
      expect(seg2?.teacherWagePerSession).toBe(60000);

      // Đoạn 3 (Sau): 2026-09-01 -> null (Khôi phục giá cũ 100k và tiếp tục làm Hiện hành)
      const seg3 = pricingDataStore.find((p) => p.effectiveFrom === '2026-09-01');
      expect(seg3?.effectiveTo).toBeNull();
      expect(seg3?.pricePerSession).toBe(100000);
    });

    it('Case 12 (Tách 3 đoạn trong khoảng có chặn đuôi): Tách đúng [oldFrom -> newFrom - 1], [newFrom -> newTo], [newTo + 1 -> oldTo]', async () => {
      pricingDataStore.push({
        id: 'pricing-bounded',
        courseLevelId: 'level-1',
        pricePerSession: 200000,
        teacherWagePerSession: 100000,
        taWagePerSession: 50000,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
      } as any);

      const dto = {
        pricePerSession: 180000,
        effectiveFrom: '2026-07-01',
        effectiveTo: '2026-07-31',
      };

      await controller.addPricing('level-1', dto as any);

      expect(pricingDataStore.length).toBe(3);
      const seg1 = pricingDataStore.find((p) => p.effectiveFrom === '2026-01-01');
      expect(seg1?.effectiveTo).toBe('2026-06-30');

      const seg2 = pricingDataStore.find((p) => p.effectiveFrom === '2026-07-01');
      expect(seg2?.effectiveTo).toBe('2026-07-31');
      expect(seg2?.pricePerSession).toBe(180000);

      const seg3 = pricingDataStore.find((p) => p.effectiveFrom === '2026-08-01');
      expect(seg3?.effectiveTo).toBe('2026-12-31');
      expect(seg3?.pricePerSession).toBe(200000);
    });

    it('Case 13 (Đè tương lai mở vô hạn): Đóng bản ghi cũ tại newFrom - 1 và mở bản ghi mới làm Hiện hành duy nhất', async () => {
      pricingDataStore.push({
        id: 'pricing-old-forever',
        courseLevelId: 'level-1',
        pricePerSession: 100000,
        teacherWagePerSession: 60000,
        taWagePerSession: 30000,
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
      } as any);

      const dto = {
        pricePerSession: 150000,
        effectiveFrom: '2026-10-01',
        effectiveTo: undefined,
      };

      await controller.addPricing('level-1', dto as any);

      expect(pricingDataStore.length).toBe(2);
      const oldRec = pricingDataStore.find((p) => p.id === 'pricing-old-forever');
      expect(oldRec?.effectiveTo).toBe('2026-09-30');

      const newRec = pricingDataStore.find((p) => p.effectiveFrom === '2026-10-01');
      expect(newRec?.effectiveTo).toBeNull();
      expect(newRec?.pricePerSession).toBe(150000);
    });

    it('Case 14 (Chèn vào quá khứ): Tự động giới hạn effectiveTo của bản ghi mới đến nextFrom - 1', async () => {
      pricingDataStore.push({
        id: 'pricing-future',
        courseLevelId: 'level-1',
        pricePerSession: 200000,
        teacherWagePerSession: 100000,
        taWagePerSession: 50000,
        effectiveFrom: '2026-06-01',
        effectiveTo: null,
      } as any);

      const dto = {
        pricePerSession: 120000,
        effectiveFrom: '2026-01-01',
        effectiveTo: undefined, // Không truyền ngày kết thúc
      };

      const result = await controller.addPricing('level-1', dto as any);
      expect(result.effectiveFrom).toBe('2026-01-01');
      expect(result.effectiveTo).toBe('2026-05-31'); // Tự động giới hạn
      expect(pricingDataStore.length).toBe(2);
    });
  });

  // =========================================================================
  // CATEGORY 4: UpdateCourseLevelPricingUseCase
  // =========================================================================
  describe('Category 4: Cập Nhật Biểu Giá (UpdateCourseLevelPricingUseCase)', () => {
    beforeEach(() => {
      pricingDataStore.push({
        id: 'p-1',
        courseLevelId: 'level-1',
        pricePerSession: 150000,
        teacherWagePerSession: 80000,
        taWagePerSession: 50000,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-06-30',
      } as any);
    });

    it('Case 15: Ném lỗi PRICING_NOT_FOUND khi cập nhật bản ghi không tồn tại', async () => {
      await expect(
        updateUseCase.execute('p-non-existent', { pricePerSession: 200000 })
      ).rejects.toThrow(AcademicError);
    });

    it('Case 16: Chặn sửa học phí khi bản ghi bắt đầu trước hoặc trùng ngày chốt học phí gần nhất', async () => {
      attendanceDataStore = [
        { id: 'att-1', billId: 'bill-1', classSession: { date: '2026-03-15' } },
      ];

      await expect(
        updateUseCase.execute('p-1', { pricePerSession: 180000 })
      ).rejects.toThrow(/Không thể thay đổi đơn giá học sinh/);
    });

    it('Case 17: Chặn sửa lương GV khi bản ghi bắt đầu trước hoặc trùng ngày chốt lương GV gần nhất', async () => {
      sessionDataStore = [
        { id: 'sess-1', wageId: 'wage-1', assistantWageId: null, date: '2026-04-01' },
      ];

      await expect(
        updateUseCase.execute('p-1', { teacherWagePerSession: 95000 })
      ).rejects.toThrow(/Không thể thay đổi lương giáo viên/);
    });

    it('Case 18: Chặn sửa lương TG khi bản ghi bắt đầu trước hoặc trùng ngày chốt lương TG gần nhất', async () => {
      sessionDataStore = [
        { id: 'sess-1', wageId: null, assistantWageId: 'ta-1', date: '2026-04-10' },
      ];

      await expect(
        updateUseCase.execute('p-1', { taWagePerSession: 60000 })
      ).rejects.toThrow(/Không thể thay đổi lương trợ giảng/);
    });

    it('Case 19: Chặn đổi ngày bắt đầu effectiveFrom nếu khoảng thời gian cũ đã có dữ liệu chốt sổ', async () => {
      attendanceDataStore = [
        { id: 'att-1', billId: 'bill-1', classSession: { date: '2026-03-15' } },
      ];

      await expect(
        updateUseCase.execute('p-1', { effectiveFrom: '2026-02-01' })
      ).rejects.toThrow(/Không thể thay đổi ngày bắt đầu/);
    });

    it('Case 20: Chặn đổi ngày kết thúc effectiveTo nếu giai đoạn liên quan đã chốt sổ', async () => {
      sessionDataStore = [
        { id: 'sess-1', wageId: 'wage-1', assistantWageId: null, date: '2026-05-25' },
      ];

      await expect(
        updateUseCase.execute('p-1', { effectiveTo: '2026-05-20' })
      ).rejects.toThrow(/Không thể thay đổi ngày kết thúc/);
    });

    it('Case 21: Ném lỗi PRICING_CONFLICT khi effectiveFrom > effectiveTo', async () => {
      await expect(
        updateUseCase.execute('p-1', { effectiveFrom: '2026-08-01', effectiveTo: '2026-07-01' })
      ).rejects.toThrow(/Ngày bắt đầu áp dụng không được sau ngày kết thúc/);
    });

    it('Case 22: Cập nhật thành công khi giai đoạn chưa chốt sổ', async () => {
      attendanceDataStore = [];
      sessionDataStore = [];

      const updated = await updateUseCase.execute('p-1', {
        pricePerSession: 175000,
        teacherWagePerSession: 90000,
        taWagePerSession: 55000,
        effectiveFrom: '2026-02-01',
        effectiveTo: '2026-08-31',
      });

      expect(updated.pricePerSession).toBe(175000);
      expect(updated.teacherWagePerSession).toBe(90000);
      expect(updated.taWagePerSession).toBe(55000);
      expect(updated.effectiveFrom).toBe('2026-02-01');
      expect(updated.effectiveTo).toBe('2026-08-31');
    });
  });

  // =========================================================================
  // CATEGORY 5: DeleteCourseLevelPricingUseCase
  // =========================================================================
  describe('Category 5: Xóa Biểu Giá (DeleteCourseLevelPricingUseCase)', () => {
    beforeEach(() => {
      pricingDataStore.push({
        id: 'p-to-delete',
        courseLevelId: 'level-1',
        pricePerSession: 150000,
        teacherWagePerSession: 80000,
        taWagePerSession: 50000,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-06-30',
      } as any);
    });

    it('Case 23: Ném lỗi PRICING_NOT_FOUND khi xóa biểu giá không tồn tại', async () => {
      await expect(deleteUseCase.execute('p-fake')).rejects.toThrow(AcademicError);
    });

    it('Case 24: Chặn xóa biểu giá khi khoảng thời gian đã có học viên đóng tiền (Student Attendance Bill)', async () => {
      attendanceDataStore = [
        { id: 'att-1', billId: 'bill-abc', classSession: { date: '2026-03-01' } },
      ];

      await expect(deleteUseCase.execute('p-to-delete')).rejects.toThrow(
        /Không thể xóa bảng giá này vì đã có dữ liệu thu học phí hoặc tính lương/
      );
    });

    it('Case 25: Chặn xóa biểu giá khi khoảng thời gian đã có buổi học tính lương GV hoặc lương TG', async () => {
      sessionDataStore = [
        { id: 'sess-1', wageId: 'wage-xyz', assistantWageId: null, date: '2026-02-15' },
      ];

      await expect(deleteUseCase.execute('p-to-delete')).rejects.toThrow(
        /Không thể xóa bảng giá này vì đã có dữ liệu thu học phí hoặc tính lương/
      );
    });

    it('Case 26: Xóa thành công biểu giá khi chưa có dữ liệu chốt sổ trong khoảng thời gian', async () => {
      attendanceDataStore = [];
      sessionDataStore = [];

      const res = await deleteUseCase.execute('p-to-delete');
      expect(res).toEqual({ message: 'Xóa bảng giá thành công' });
      expect(pricingDataStore.find((p) => p.id === 'p-to-delete')).toBeUndefined();
    });
  });

  // =========================================================================
  // CATEGORY 6: GetCourseLevelPricingUseCase & Lock Flags
  // =========================================================================
  describe('Category 6: Khám Phá & Gán Cờ Khóa Biểu Giá (GetCourseLevelPricingUseCase)', () => {
    it('Case 27: Trả về đầy đủ cờ khóa độc lập cho học phí, lương GV, lương TG và các mốc chốt sổ', async () => {
      pricingDataStore.push({
        id: 'p-audit',
        courseLevelId: 'level-1',
        pricePerSession: 150000,
        teacherWagePerSession: 80000,
        taWagePerSession: 50000,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-06-30',
      } as any);

      attendanceDataStore = [
        { id: 'att-1', billId: 'bill-1', classSession: { date: '2026-04-15' } },
      ];
      sessionDataStore = [
        { id: 'sess-1', wageId: 'wage-1', assistantWageId: null, date: '2026-05-10' },
      ];

      const result = await getUseCase.execute('level-1');
      expect(result.length).toBe(1);

      const record = result[0];
      expect(record.isStudentPriceLocked).toBe(true);
      expect(record.isTeacherWageLocked).toBe(true);
      expect(record.isTaWageLocked).toBe(false); // Chưa chốt trợ giảng
      expect(record.isDateRangeLocked).toBe(true);
      expect(record.lastStudentBillDate).toBe('2026-04-15');
      expect(record.lastTeacherWageDate).toBe('2026-05-10');
      expect(record.lastAssistantWageDate).toBeNull();
    });
  });

  // =========================================================================
  // CATEGORY 7: Controller Endpoints & Level Operations
  // =========================================================================
  describe('Category 7: Endpoints & Level Operations trên CourseController', () => {
    it('Case 28: Endpoint PUT /courses/pricing/:id ủy quyền chính xác cho UpdateCourseLevelPricingUseCase', async () => {
      pricingDataStore.push({
        id: 'p-ep',
        courseLevelId: 'level-1',
        pricePerSession: 150000,
        teacherWagePerSession: 80000,
        taWagePerSession: 50000,
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
      } as any);

      const updated = await controller.updatePricing('p-ep', { pricePerSession: 190000 });
      expect(updated.pricePerSession).toBe(190000);
    });

    it('Case 29: Endpoint DELETE /courses/pricing/:id ủy quyền chính xác cho DeleteCourseLevelPricingUseCase', async () => {
      pricingDataStore.push({
        id: 'p-del-ep',
        courseLevelId: 'level-1',
        pricePerSession: 150000,
        teacherWagePerSession: 80000,
        taWagePerSession: 50000,
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
      } as any);

      const res = await controller.deletePricing('p-del-ep');
      expect(res).toEqual({ message: 'Xóa bảng giá thành công' });
    });

    it('Case 30: Xóa Level thành công khi chưa có lớp hoặc buổi học nào sử dụng', async () => {
      mockClassCount = 0;
      mockSessionCount = 0;

      const result = await controller.deleteLevel('level-1');
      expect(result).toEqual({ message: 'Xóa Level thành công' });
      expect(mockLevelRepo.delete).toHaveBeenCalledWith('level-1');
    });

    it('Case 31: Chặn xóa Level khi đã có lớp học sử dụng và báo lỗi ConflictException', async () => {
      mockClassCount = 2;
      mockSessionCount = 0;

      await expect(controller.deleteLevel('level-1')).rejects.toThrow(ConflictException);
    });

    it('Case 32: Chặn xóa Level khi đã có buổi học sử dụng và báo lỗi ConflictException', async () => {
      mockClassCount = 0;
      mockSessionCount = 5;

      await expect(controller.deleteLevel('level-1')).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================================
  // CATEGORY 8: Bảo Toàn Tuyệt Đối Đơn Giá Buổi Học Quá Khứ (10 Cases)
  // =========================================================================
  describe('Category 8: Bảo Toàn Tuyệt Đối Đơn Giá Buổi Học Quá Khứ (Historical Pricing Integrity & Immutability)', () => {
    it('Case 33: Bảo toàn khoảng giá quá khứ khi chèn biểu giá mới ở tương lai (không đổi giá các buổi học trước đó)', async () => {
      // Biểu giá ban đầu: 2026-01-01 -> null (100k)
      pricingDataStore.push({
        id: 'pricing-q1',
        courseLevelId: 'level-1',
        pricePerSession: 100000,
        teacherWagePerSession: 60000,
        taWagePerSession: 30000,
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
      } as any);

      // Thêm biểu giá mới từ 2026-08-01 (150k)
      const dto = {
        pricePerSession: 150000,
        effectiveFrom: '2026-08-01',
      };
      await controller.addPricing('level-1', dto as any);

      // Đoạn quá khứ phải đóng tại 2026-07-31 với đúng giá 100k
      const pastPricing = pricingDataStore.find((p) => p.effectiveFrom === '2026-01-01');
      expect(pastPricing?.effectiveTo).toBe('2026-07-31');
      expect(pastPricing?.pricePerSession).toBe(100000);
      expect(pastPricing?.teacherWagePerSession).toBe(60000);
      expect(pastPricing?.taWagePerSession).toBe(30000);

      // Đoạn mới bắt đầu từ 2026-08-01
      const futurePricing = pricingDataStore.find((p) => p.effectiveFrom === '2026-08-01');
      expect(futurePricing?.pricePerSession).toBe(150000);
    });

    it('Case 34: Bảo toàn đơn giá buổi học quá khứ khi tách 3 đoạn cho đợt ưu đãi hè', async () => {
      // Biểu giá gốc: 2026-01-01 -> null (120k/70k/40k)
      pricingDataStore.push({
        id: 'pricing-base',
        courseLevelId: 'level-1',
        pricePerSession: 120000,
        teacherWagePerSession: 70000,
        taWagePerSession: 40000,
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
      } as any);

      // Chèn giá hè 2026-06-01 -> 2026-08-31 (90k)
      const dto = {
        pricePerSession: 90000,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
      };
      await controller.addPricing('level-1', dto as any);

      // Đoạn 1 (chứa các buổi học tháng 1-5) phải được bảo toàn 120k/70k/40k
      const seg1 = pricingDataStore.find((p) => p.effectiveFrom === '2026-01-01');
      expect(seg1?.effectiveTo).toBe('2026-05-31');
      expect(seg1?.pricePerSession).toBe(120000);
      expect(seg1?.teacherWagePerSession).toBe(70000);
      expect(seg1?.taWagePerSession).toBe(40000);
    });

    it('Case 35: Chặn lùi ngày áp dụng làm bao trùm các buổi học đã chốt lương GV trong quá khứ', async () => {
      pricingDataStore.push({
        id: 'p-future-teacher',
        courseLevelId: 'level-1',
        pricePerSession: 150000,
        teacherWagePerSession: 90000,
        taWagePerSession: 50000,
        effectiveFrom: '2026-06-01',
        effectiveTo: null,
      } as any);

      // Đã chốt lương GV buổi học ngày 2026-05-20
      sessionDataStore = [
        { id: 'sess-paid', wageId: 'wage-555', assistantWageId: null, date: '2026-05-20' },
      ];

      // Cố tình lùi ngày bắt đầu về 2026-05-10
      await expect(
        updateUseCase.execute('p-future-teacher', { effectiveFrom: '2026-05-10' })
      ).rejects.toThrow(/Không thể thay đổi ngày bắt đầu/);
    });

    it('Case 36: Chặn lùi ngày áp dụng làm bao trùm các buổi học đã chốt học phí HS trong quá khứ', async () => {
      pricingDataStore.push({
        id: 'p-future-student',
        courseLevelId: 'level-1',
        pricePerSession: 160000,
        teacherWagePerSession: 80000,
        taWagePerSession: 50000,
        effectiveFrom: '2026-05-01',
        effectiveTo: null,
      } as any);

      // Đã có học viên đóng tiền buổi học ngày 2026-04-15
      attendanceDataStore = [
        { id: 'att-billed', billId: 'bill-888', classSession: { date: '2026-04-15' } },
      ];

      // Cố tình lùi ngày bắt đầu về 2026-04-01
      await expect(
        updateUseCase.execute('p-future-student', { effectiveFrom: '2026-04-01' })
      ).rejects.toThrow(/Không thể thay đổi ngày bắt đầu/);
    });

    it('Case 37: Chặn lùi ngày áp dụng làm bao trùm các buổi học đã chốt lương trợ giảng trong quá khứ', async () => {
      pricingDataStore.push({
        id: 'p-future-ta',
        courseLevelId: 'level-1',
        pricePerSession: 160000,
        teacherWagePerSession: 80000,
        taWagePerSession: 50000,
        effectiveFrom: '2026-06-01',
        effectiveTo: null,
      } as any);

      // Đã chốt lương TG buổi học ngày 2026-05-15
      sessionDataStore = [
        { id: 'sess-ta-paid', wageId: null, assistantWageId: 'ta-wage-999', date: '2026-05-15' },
      ];

      // Cố tình lùi ngày bắt đầu về 2026-05-01
      await expect(
        updateUseCase.execute('p-future-ta', { effectiveFrom: '2026-05-01' })
      ).rejects.toThrow(/Không thể thay đổi ngày bắt đầu/);
    });

    it('Case 38: Bảo toàn độc lập giữa các loại giá cho các buổi học quá khứ (chốt học phí không chặn sửa lương sau ngày chốt lương)', async () => {
      pricingDataStore.push({
        id: 'p-mixed',
        courseLevelId: 'level-1',
        pricePerSession: 100000,
        teacherWagePerSession: 60000,
        taWagePerSession: 30000,
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
      } as any);

      // Đã chốt học phí đến ngày 2026-05-15, nhưng lương GV chỉ mới chốt đến 2026-03-01
      attendanceDataStore = [
        { id: 'att-1', billId: 'bill-1', classSession: { date: '2026-05-15' } },
      ];
      sessionDataStore = [
        { id: 'sess-1', wageId: 'wage-1', assistantWageId: null, date: '2026-03-01' },
      ];

      // 1. Thêm học phí mới tại 2026-05-10 (<= 2026-05-15) -> BỊ CHẶN
      await expect(
        controller.addPricing('level-1', { pricePerSession: 120000, effectiveFrom: '2026-05-10' } as any)
      ).rejects.toThrow(ConflictException);

      // 2. Thêm lương GV mới tại 2026-05-10 (> 2026-03-01) -> CHO PHÉP và tự động kế thừa học phí 100k
      const result = await controller.addPricing('level-1', {
        teacherWagePerSession: 80000,
        effectiveFrom: '2026-05-10',
      } as any);
      expect(result.teacherWagePerSession).toBe(80000);
      expect(result.pricePerSession).toBe(100000); // Kế thừa, không làm hỏng học phí cũ
    });

    it('Case 39: Chặn xóa biểu giá quá khứ ngay cả khi biểu giá đó đã hết hiệu lực nếu có chứa buổi học đã thu tiền', async () => {
      pricingDataStore.push({
        id: 'p-expired-reconciled',
        courseLevelId: 'level-1',
        pricePerSession: 100000,
        teacherWagePerSession: 60000,
        taWagePerSession: 30000,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-03-31',
      } as any);

      // Buổi học ngày 2026-02-10 đã chốt học phí
      attendanceDataStore = [
        { id: 'att-past', billId: 'bill-past', classSession: { date: '2026-02-10' } },
      ];

      await expect(deleteUseCase.execute('p-expired-reconciled')).rejects.toThrow(
        /Không thể xóa bảng giá này vì đã có dữ liệu thu học phí hoặc tính lương/
      );
    });

    it('Case 40: Không ghi đè đơn giá 0đ lên các buổi học quá khứ/hiện tại khi chỉ cập nhật 1 loại giá', async () => {
      pricingDataStore.push({
        id: 'p-prev-complete',
        courseLevelId: 'level-1',
        pricePerSession: 150000,
        teacherWagePerSession: 85000,
        taWagePerSession: 45000,
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
      } as any);

      // Thêm biểu giá mới và chỉ truyền pricePerSession
      const newPricing = await controller.addPricing('level-1', {
        pricePerSession: 180000,
        effectiveFrom: '2026-09-01',
      } as any);

      expect(newPricing.pricePerSession).toBe(180000);
      expect(newPricing.teacherWagePerSession).toBe(85000); // Không bị 0đ
      expect(newPricing.taWagePerSession).toBe(45000); // Không bị 0đ
    });

    it('Case 41: Chặn rút ngắn ngày kết thúc effectiveTo làm hở các buổi học đã chốt sổ trong quá khứ', async () => {
      pricingDataStore.push({
        id: 'p-span-reconciled',
        courseLevelId: 'level-1',
        pricePerSession: 150000,
        teacherWagePerSession: 80000,
        taWagePerSession: 50000,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-06-30',
      } as any);

      // Đã có buổi học chốt lương ngày 2026-06-20
      sessionDataStore = [
        { id: 'sess-locked', wageId: 'wage-locked', assistantWageId: null, date: '2026-06-20' },
      ];

      // Cố tình rút ngắn effectiveTo về 2026-06-01 (bỏ rơi buổi học 2026-06-20)
      await expect(
        updateUseCase.execute('p-span-reconciled', { effectiveTo: '2026-06-01' })
      ).rejects.toThrow(/Không thể thay đổi ngày kết thúc/);
    });

    it('Case 42: Kiểm tra tính bất biến của toàn bộ chuỗi lịch sử biểu giá sau 5 thao tác thêm/sửa liên tiếp', async () => {
      // 1. Biểu giá gốc
      await controller.addPricing('level-1', {
        pricePerSession: 100000,
        teacherWagePerSession: 60000,
        taWagePerSession: 30000,
        effectiveFrom: '2026-01-01',
      } as any);

      // 2. Thêm giá hè: [2026-06-01 -> 2026-08-31] (80k)
      await controller.addPricing('level-1', {
        pricePerSession: 80000,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-08-31',
      } as any);

      // 3. Thêm giá năm học mới: 2026-09-01 (120k)
      await controller.addPricing('level-1', {
        pricePerSession: 120000,
        effectiveFrom: '2026-09-01',
      } as any);

      // 4. Thêm giá năm sau: 2027-01-01 (150k)
      await controller.addPricing('level-1', {
        pricePerSession: 150000,
        effectiveFrom: '2027-01-01',
      } as any);

      // 5. Cập nhật lương GV năm sau: 2027-01-01 (100k)
      await controller.addPricing('level-1', {
        teacherWagePerSession: 100000,
        effectiveFrom: '2027-01-01',
      } as any);

      // Kiểm tra chuỗi lịch sử: Các giai đoạn quá khứ hoàn toàn nguyên vẹn và liên tục
      const list = pricingDataStore.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));

      // Đoạn 1: [2026-01-01 -> 2026-05-31] (100k/60k/30k)
      expect(list[0].effectiveFrom).toBe('2026-01-01');
      expect(list[0].effectiveTo).toBe('2026-05-31');
      expect(list[0].pricePerSession).toBe(100000);

      // Đoạn 2: [2026-06-01 -> 2026-08-31] (80k/60k/30k)
      expect(list[1].effectiveFrom).toBe('2026-06-01');
      expect(list[1].effectiveTo).toBe('2026-08-31');
      expect(list[1].pricePerSession).toBe(80000);

      // Đoạn 3: [2026-09-01 -> 2026-12-31] (120k/60k/30k)
      expect(list[2].effectiveFrom).toBe('2026-09-01');
      expect(list[2].effectiveTo).toBe('2026-12-31');
      expect(list[2].pricePerSession).toBe(120000);

      // Đoạn 4: [2027-01-01 -> null] (150k/100k/30k)
      expect(list[3].effectiveFrom).toBe('2027-01-01');
      expect(list[3].effectiveTo).toBeNull();
      expect(list[3].pricePerSession).toBe(150000);
      expect(list[3].teacherWagePerSession).toBe(100000);
    });
  });
});
