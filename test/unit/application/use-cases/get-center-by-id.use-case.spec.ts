import { NotFoundException } from '@nestjs/common';
import { GetCenterByIdUseCase } from '../../../../src/application/use-cases/get-center-by-id.use-case';
import { ICenterRepository } from '../../../../src/domain/repositories/center-repository.interface';

describe('GetCenterByIdUseCase', () => {
  let useCase: GetCenterByIdUseCase;
  let centerRepository: jest.Mocked<ICenterRepository>;

  beforeEach(() => {
    centerRepository = {
      findById: jest.fn(),
    } as any;

    useCase = new GetCenterByIdUseCase(centerRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw NotFoundException if center is not found', async () => {
    centerRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('invalid-id')).rejects.toThrow(NotFoundException);
    await expect(useCase.execute('invalid-id')).rejects.toThrow('Không tìm thấy trung tâm');
  });

  it('should return center if found', async () => {
    centerRepository.findById.mockResolvedValue({ id: 'valid-id', name: 'Center 1' } as any);

    const result = await useCase.execute('valid-id');

    expect(centerRepository.findById).toHaveBeenCalledWith('valid-id');
    expect(result.id).toBe('valid-id');
    expect(result.name).toBe('Center 1');
  });
});
