import { BadRequestException } from '@nestjs/common';
import { PreviewTuitionUseCase } from './preview-tuition.use-case';
import { Repository } from 'typeorm';

describe('PreviewTuitionUseCase', () => {
  let useCase: PreviewTuitionUseCase;
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

    sessionRepo = {} as any;
    attendanceRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    } as any;
    pricingRepo = { find: jest.fn().mockResolvedValue([]) } as any;

    useCase = new PreviewTuitionUseCase(sessionRepo, attendanceRepo, pricingRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw BadRequestException if month or endDate is missing', async () => {
    await expect(useCase.execute('', '2026-01-31')).rejects.toThrow(BadRequestException);
    await expect(useCase.execute('2026-01', '')).rejects.toThrow(BadRequestException);
  });

  it('should return empty result if no attendances are found', async () => {
    mockQueryBuilder.getMany.mockResolvedValue([]);
    pricingRepo.find.mockResolvedValue([]);

    const result = await useCase.execute('2026-01', '2026-01-31');

    expect(result.students).toHaveLength(0);
    expect(result.grandTotal).toBe(0);
    expect(attendanceRepo.createQueryBuilder).toHaveBeenCalledWith('att');
  });

  it('should calculate tuition correctly based on attendances and pricing', async () => {
    pricingRepo.find.mockResolvedValue([
      { courseLevelId: 'level-1', pricePerSession: 100000, effectiveFrom: '2026-01-01', effectiveTo: null }
    ]);

    mockQueryBuilder.getMany.mockResolvedValue([
      {
        studentId: 'stu-1',
        student: { firstName: 'John', lastName: 'Doe', studentId: 'S001' },
        classSession: {
          classId: 'class-1',
          date: '2026-01-15',
          classEntity: { courseLevelId: 'level-1' }
        }
      },
      {
        studentId: 'stu-1',
        student: { firstName: 'John', lastName: 'Doe', studentId: 'S001' },
        classSession: {
          classId: 'class-1',
          date: '2026-01-20',
          classEntity: { courseLevelId: 'level-1' }
        }
      }
    ]);

    const result = await useCase.execute('2026-01', '2026-01-31');

    expect(result.students).toHaveLength(1);
    expect(result.students[0].studentId).toBe('stu-1');
    expect(result.students[0].totalSessions).toBe(2);
    expect(result.students[0].totalAmount).toBe(200000); // 2 sessions * 100k
    expect(result.grandTotal).toBe(200000);
  });
});
