import { NotFoundException } from '@nestjs/common';
import { GetStudentByIdUseCase } from '../../../../src/application/use-cases/get-student-by-id.use-case';
import { IStudentRepository } from '../../../../src/domain/repositories/student-repository.interface';

describe('GetStudentByIdUseCase', () => {
  let useCase: GetStudentByIdUseCase;
  let studentRepository: jest.Mocked<IStudentRepository>;

  beforeEach(() => {
    studentRepository = {
      findById: jest.fn(),
    } as any;

    useCase = new GetStudentByIdUseCase(studentRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw NotFoundException if student is not found', async () => {
    studentRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('invalid-id')).rejects.toThrow(NotFoundException);
    await expect(useCase.execute('invalid-id')).rejects.toThrow('Không tìm thấy học sinh với ID: invalid-id');
  });

  it('should return student if found', async () => {
    studentRepository.findById.mockResolvedValue({ id: 'valid-id', firstName: 'John' } as any);

    const result = await useCase.execute('valid-id');

    expect(studentRepository.findById).toHaveBeenCalledWith('valid-id');
    expect(result.id).toBe('valid-id');
    expect(result.firstName).toBe('John');
  });
});
