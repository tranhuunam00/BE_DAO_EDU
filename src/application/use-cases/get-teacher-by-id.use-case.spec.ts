import { NotFoundException } from '@nestjs/common';
import { GetTeacherByIdUseCase } from './get-teacher-by-id.use-case';
import { ITeacherRepository } from '../../domain/repositories/teacher-repository.interface';

describe('GetTeacherByIdUseCase', () => {
  let useCase: GetTeacherByIdUseCase;
  let teacherRepository: jest.Mocked<ITeacherRepository>;

  beforeEach(() => {
    teacherRepository = {
      findById: jest.fn(),
    } as any;

    useCase = new GetTeacherByIdUseCase(teacherRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw NotFoundException if teacher is not found', async () => {
    teacherRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('invalid-id')).rejects.toThrow(NotFoundException);
    await expect(useCase.execute('invalid-id')).rejects.toThrow('Không tìm thấy giáo viên/trợ giảng');
  });

  it('should return teacher if found', async () => {
    teacherRepository.findById.mockResolvedValue({ id: 'valid-id', firstName: 'John' } as any);

    const result = await useCase.execute('valid-id');

    expect(teacherRepository.findById).toHaveBeenCalledWith('valid-id');
    expect(result.id).toBe('valid-id');
    expect(result.firstName).toBe('John');
  });
});
