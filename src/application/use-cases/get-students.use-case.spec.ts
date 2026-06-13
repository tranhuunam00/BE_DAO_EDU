import { GetStudentsUseCase } from './get-students.use-case';
import { IStudentRepository } from '../../domain/repositories/student-repository.interface';

describe('GetStudentsUseCase', () => {
  let useCase: GetStudentsUseCase;
  let studentRepository: jest.Mocked<IStudentRepository>;

  beforeEach(() => {
    studentRepository = {
      findPaginated: jest.fn(),
    } as any;

    useCase = new GetStudentsUseCase(studentRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return paginated students with default query parameters', async () => {
    studentRepository.findPaginated.mockResolvedValue({
      students: [{ id: '1' }] as any,
      total: 1
    });

    const result = await useCase.execute();

    expect(studentRepository.findPaginated).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
    });
    expect(result.students).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(1);
  });

  it('should calculate totalPages correctly', async () => {
    studentRepository.findPaginated.mockResolvedValue({
      students: [] as any,
      total: 25
    });

    const result = await useCase.execute({ page: 2, limit: 10 });

    expect(studentRepository.findPaginated).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
    });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(3); // Math.ceil(25/10) = 3
  });
});
