import { NotFoundException } from '@nestjs/common';
import { UpdateCenterUseCase } from '../../../../src/application/use-cases/update-center.use-case';
import { ICenterRepository } from '../../../../src/domain/repositories/center-repository.interface';
import { UpdateCenterDto } from '../../../../src/application/dtos/center.dto';

describe('UpdateCenterUseCase', () => {
  let useCase: UpdateCenterUseCase;
  let centerRepository: jest.Mocked<ICenterRepository>;

  beforeEach(() => {
    centerRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    } as any;

    useCase = new UpdateCenterUseCase(centerRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw NotFoundException if center is not found', async () => {
    centerRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('invalid-id', {})).rejects.toThrow(NotFoundException);
    await expect(useCase.execute('invalid-id', {})).rejects.toThrow('Không tìm thấy trung tâm');
  });

  it('should update center details if found', async () => {
    const existingCenter = { id: 'valid-id', name: 'Old Name', status: 'Active' };
    centerRepository.findById.mockResolvedValue(existingCenter as any);
    centerRepository.save.mockImplementation(async (center) => center as any);

    const dto: UpdateCenterDto = { name: 'New Name', status: 'Inactive' };

    const result = await useCase.execute('valid-id', dto);

    expect(centerRepository.findById).toHaveBeenCalledWith('valid-id');
    expect(centerRepository.save).toHaveBeenCalled();
    expect(result.name).toBe('New Name');
    expect(result.status).toBe('Inactive');
  });

  it('should only update fields provided in DTO', async () => {
    const existingCenter = { id: 'valid-id', name: 'Old Name', phone: '123' };
    centerRepository.findById.mockResolvedValue(existingCenter as any);
    centerRepository.save.mockImplementation(async (center) => center as any);

    const dto: UpdateCenterDto = { name: 'New Name' };

    const result = await useCase.execute('valid-id', dto);

    expect(result.name).toBe('New Name');
    expect(result.phone).toBe('123'); // Unchanged
  });
});
