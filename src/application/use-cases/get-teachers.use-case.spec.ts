import { GetTeachersUseCase } from './get-teachers.use-case';
import { ITeacherRepository } from '../../domain/repositories/teacher-repository.interface';

describe('GetTeachersUseCase', () => {
  let useCase: GetTeachersUseCase;
  let teacherRepository: jest.Mocked<ITeacherRepository>;

  beforeEach(() => {
    teacherRepository = {
      findPaginated: jest.fn(),
    } as any;

    useCase = new GetTeachersUseCase(teacherRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return paginated teachers with default query parameters', async () => {
    teacherRepository.findPaginated.mockResolvedValue({
      teachers: [{ id: '1' }] as any,
      total: 1
    });

    const result = await useCase.execute();

    expect(teacherRepository.findPaginated).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
    });
    expect(result.teachers).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(1);
  });

  it('should calculate totalPages correctly', async () => {
    teacherRepository.findPaginated.mockResolvedValue({
      teachers: [] as any,
      total: 25
    });

    const result = await useCase.execute({ page: 2, limit: 10 });

    expect(teacherRepository.findPaginated).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
    });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(3); // Math.ceil(25/10) = 3
  });
});
