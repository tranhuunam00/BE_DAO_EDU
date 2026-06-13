import { BadRequestException } from '@nestjs/common';
import { PreviewSalaryUseCase } from './preview-salary.use-case';
import { Repository } from 'typeorm';

describe('PreviewSalaryUseCase', () => {
  let useCase: PreviewSalaryUseCase;
  let sessionRepo: jest.Mocked<Repository<any>>;
  let pricingRepo: jest.Mocked<Repository<any>>;

  let mockQueryBuilder: any;

  beforeEach(() => {
    mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    sessionRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    } as any;
    pricingRepo = { find: jest.fn().mockResolvedValue([]) } as any;

    useCase = new PreviewSalaryUseCase(sessionRepo, pricingRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw BadRequestException if endDate is missing', async () => {
    await expect(useCase.execute('')).rejects.toThrow(BadRequestException);
    await expect(useCase.execute(undefined as any)).rejects.toThrow('Vui lòng cung cấp endDate');
  });

  it('should return empty result if no sessions are found', async () => {
    mockQueryBuilder.getMany.mockResolvedValue([]);
    pricingRepo.find.mockResolvedValue([]);

    const result = await useCase.execute('2026-01-31');

    expect(result.teachers).toHaveLength(0);
    expect(result.grandTotal).toBe(0);
    expect(sessionRepo.createQueryBuilder).toHaveBeenCalledWith('session');
  });

  it('should calculate salary correctly based on sessions and pricing', async () => {
    pricingRepo.find.mockResolvedValue([
      { courseLevelId: 'level-1', teacherWagePerSession: 250000, effectiveFrom: '2026-01-01', effectiveTo: null }
    ]);

    mockQueryBuilder.getMany.mockResolvedValue([
      {
        teacherId: 'teacher-1',
        teacher: { firstName: 'Alice', lastName: 'Smith', teacherId: 'T001' },
        classId: 'class-1',
        date: '2026-01-15',
        classEntity: { courseLevelId: 'level-1' }
      },
      {
        teacherId: 'teacher-1',
        teacher: { firstName: 'Alice', lastName: 'Smith', teacherId: 'T001' },
        classId: 'class-1',
        date: '2026-01-20',
        classEntity: { courseLevelId: 'level-1' }
      }
    ]);

    const result = await useCase.execute('2026-01-31');

    expect(result.teachers).toHaveLength(1);
    expect(result.teachers[0].teacherId).toBe('teacher-1');
    expect(result.teachers[0].totalSessions).toBe(2);
    expect(result.teachers[0].totalAmount).toBe(500000); // 2 sessions * 250k
    expect(result.grandTotal).toBe(500000);
  });
});
