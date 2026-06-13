import { BadRequestException } from '@nestjs/common';
import { CreatePaymentPeriodUseCase } from './create-payment-period.use-case';
import { Repository, SelectQueryBuilder } from 'typeorm';

describe('CreatePaymentPeriodUseCase', () => {
  let useCase: CreatePaymentPeriodUseCase;
  let periodRepo: jest.Mocked<Repository<any>>;
  let studentBillRepo: jest.Mocked<Repository<any>>;
  let teacherWageRepo: jest.Mocked<Repository<any>>;
  let studentBillItemRepo: jest.Mocked<Repository<any>>;
  let teacherWageItemRepo: jest.Mocked<Repository<any>>;
  let sessionRepo: jest.Mocked<Repository<any>>;
  let attendanceRepo: jest.Mocked<Repository<any>>;
  let pricingRepo: jest.Mocked<Repository<any>>;

  let mockQueryBuilder: any;

  beforeEach(() => {
    mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    periodRepo = { save: jest.fn() } as any;
    studentBillRepo = { save: jest.fn() } as any;
    teacherWageRepo = { save: jest.fn() } as any;
    studentBillItemRepo = { save: jest.fn() } as any;
    teacherWageItemRepo = { save: jest.fn() } as any;
    sessionRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      update: jest.fn(),
    } as any;
    attendanceRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      update: jest.fn(),
    } as any;
    pricingRepo = { find: jest.fn().mockResolvedValue([]) } as any;

    useCase = new CreatePaymentPeriodUseCase(
      periodRepo,
      studentBillRepo,
      teacherWageRepo,
      studentBillItemRepo,
      teacherWageItemRepo,
      sessionRepo,
      attendanceRepo,
      pricingRepo,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw BadRequestException if required fields are missing', async () => {
    const dto = { name: 'Tháng 1' }; // missing type, month, startDate, endDate
    await expect(useCase.execute(dto)).rejects.toThrow(BadRequestException);
    await expect(useCase.execute(dto)).rejects.toThrow('Vui lòng cung cấp đầy đủ thông tin đợt thanh toán');
  });

  it('should successfully create a tuition period with no attendances found', async () => {
    const dto = {
      name: 'Học phí T1',
      type: 'tuition',
      month: '2026-01',
      startDate: '2026-01-01',
      endDate: '2026-01-31'
    };

    periodRepo.save.mockResolvedValue({ id: 'period-1', ...dto });
    pricingRepo.find.mockResolvedValue([]);
    mockQueryBuilder.getMany.mockResolvedValue([]);

    const result = await useCase.execute(dto);

    expect(periodRepo.save).toHaveBeenCalled();
    expect(attendanceRepo.createQueryBuilder).toHaveBeenCalledWith('att');
    expect(studentBillRepo.save).not.toHaveBeenCalled();
    expect(result.message).toBe('Đã tạo đợt thanh toán thành công');
    expect(result.data.id).toBe('period-1');
  });

  it('should calculate tuition for attendances successfully', async () => {
    const dto = {
      name: 'Học phí T2',
      type: 'tuition',
      month: '2026-02',
      startDate: '2026-02-01',
      endDate: '2026-02-28',
      studentIds: ['stu-1']
    };

    periodRepo.save.mockResolvedValue({ id: 'period-2', ...dto });
    
    // Mock Pricing
    pricingRepo.find.mockResolvedValue([
      { courseLevelId: 'level-1', pricePerSession: 150000, effectiveFrom: '2026-01-01', effectiveTo: null }
    ]);

    // Mock Attendance
    mockQueryBuilder.getMany.mockResolvedValue([
      {
        id: 'att-1',
        studentId: 'stu-1',
        classSession: {
          classId: 'class-1',
          date: '2026-02-15',
          classEntity: {
            className: 'Math 101',
            courseLevelId: 'level-1',
            course: { name: 'Math Core' },
            courseLevel: { levelName: 'Beginner' }
          }
        }
      }
    ]);

    studentBillRepo.save.mockResolvedValue({ id: 'bill-1' });

    const result = await useCase.execute(dto);

    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('att.studentId IN (:...ids)', { ids: ['stu-1'] });
    expect(studentBillRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      studentId: 'stu-1',
      totalAmount: 150000,
    }));
    expect(studentBillItemRepo.save).toHaveBeenCalled();
    expect(attendanceRepo.update).toHaveBeenCalled();
    expect(result.data.id).toBe('period-2');
  });

  it('should calculate teacher wages successfully', async () => {
    const dto = {
      name: 'Lương GV T3',
      type: 'salary',
      month: '2026-03',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    };

    periodRepo.save.mockResolvedValue({ id: 'period-3', ...dto });

    // Mock Pricing
    pricingRepo.find.mockResolvedValue([
      { courseLevelId: 'level-1', teacherWagePerSession: 200000, effectiveFrom: '2026-01-01', effectiveTo: null }
    ]);

    // Mock Sessions
    mockQueryBuilder.getMany.mockResolvedValue([
      {
        id: 'sess-1',
        teacherId: 'teacher-1',
        classId: 'class-1',
        date: '2026-03-10',
        classEntity: {
          className: 'English 101',
          courseLevelId: 'level-1',
          course: { name: 'English Core' },
          courseLevel: { levelName: 'Intermediate' }
        }
      }
    ]);

    teacherWageRepo.save.mockResolvedValue({ id: 'wage-1' });

    const result = await useCase.execute(dto);

    expect(sessionRepo.createQueryBuilder).toHaveBeenCalledWith('session');
    expect(teacherWageRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      teacherId: 'teacher-1',
      totalAmount: 200000,
    }));
    expect(teacherWageItemRepo.save).toHaveBeenCalled();
    expect(sessionRepo.update).toHaveBeenCalled();
    expect(result.data.id).toBe('period-3');
  });
});
