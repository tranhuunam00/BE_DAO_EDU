import { GetCentersUseCase } from './get-centers.use-case';
import { ICenterRepository } from '../../domain/repositories/center-repository.interface';

describe('GetCentersUseCase', () => {
  let useCase: GetCentersUseCase;
  let centerRepository: jest.Mocked<ICenterRepository>;

  beforeEach(() => {
    centerRepository = {
      findPaginated: jest.fn(),
    } as any;

    useCase = new GetCentersUseCase(centerRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return paginated centers with default query parameters', async () => {
    centerRepository.findPaginated.mockResolvedValue({
      centers: [{ id: '1' }] as any,
      total: 1
    });

    const result = await useCase.execute();

    expect(centerRepository.findPaginated).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
    });
    expect(result.centers).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(1);
  });

  it('should calculate totalPages correctly', async () => {
    centerRepository.findPaginated.mockResolvedValue({
      centers: [] as any,
      total: 25
    });

    const result = await useCase.execute({ page: 2, limit: 10 });

    expect(centerRepository.findPaginated).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
    });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(3); // Math.ceil(25/10) = 3
  });
});
