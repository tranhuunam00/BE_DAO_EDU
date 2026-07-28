import { TypeOrmStudentRepository } from '../../../../../../src/infrastructure/persistence/typeorm/repositories/typeorm-student.repository';

describe('TypeOrmStudentRepository search logic', () => {
  it('should construct search query matching concatenated full name (CONCAT last_name and first_name)', async () => {
    const mockAndWhere = jest.fn().mockReturnThis();
    const mockOrderBy = jest.fn().mockReturnThis();
    const mockSkip = jest.fn().mockReturnThis();
    const mockTake = jest.fn().mockReturnThis();
    const mockGetManyAndCount = jest.fn().mockResolvedValue([[], 0]);

    const mockQb = {
      andWhere: mockAndWhere,
      orderBy: mockOrderBy,
      skip: mockSkip,
      take: mockTake,
      getManyAndCount: mockGetManyAndCount,
    };

    const mockRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    };

    const repo = new TypeOrmStudentRepository(mockRepository as any);

    await repo.findPaginated({
      page: 1,
      limit: 10,
      search: 'nhã uyên',
    });

    expect(mockAndWhere).toHaveBeenCalledWith(
      expect.stringContaining('CONCAT(student.last_name'),
      { search: '%nhã uyên%' }
    );
  });

  it('PERFORMANCE BENCHMARK: search query construction and execution should run under 50ms', async () => {
    const mockAndWhere = jest.fn().mockReturnThis();
    const mockOrderBy = jest.fn().mockReturnThis();
    const mockSkip = jest.fn().mockReturnThis();
    const mockTake = jest.fn().mockReturnThis();
    const mockGetManyAndCount = jest.fn().mockResolvedValue([[], 0]);

    const mockQb = {
      andWhere: mockAndWhere,
      orderBy: mockOrderBy,
      skip: mockSkip,
      take: mockTake,
      getManyAndCount: mockGetManyAndCount,
    };

    const mockRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    };

    const repo = new TypeOrmStudentRepository(mockRepository as any);

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      await repo.findPaginated({
        page: 1,
        limit: 10,
        search: `Học sinh ${i}`,
      });
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50); // SLA Time Limit < 50ms
  });
});
