import { AddCenterUseCase } from '../../../../src/application/use-cases/add-center.use-case';
import { ICenterRepository } from '../../../../src/domain/repositories/center-repository.interface';
import { CreateCenterDto } from '../../../../src/application/dtos/center.dto';

describe('AddCenterUseCase', () => {
  let useCase: AddCenterUseCase;
  let centerRepository: jest.Mocked<ICenterRepository>;

  beforeEach(() => {
    centerRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
    } as any;

    useCase = new AddCenterUseCase(centerRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully add a center', async () => {
    const dto: CreateCenterDto = {
      name: 'Center 1',
      phone: '0123456789',
      email: 'center@example.com',
      province: 'Hanoi',
      districtWard: 'Cau Giay',
      primaryAddress: '123 Main St',
      managerName: 'Manager 1',
      status: 'Active'
    };

    centerRepository.save.mockImplementation(async (center) => center as any);

    const result = await useCase.execute(dto);

    expect(centerRepository.save).toHaveBeenCalled();
    expect(result.name).toBe('Center 1');
    expect(result.centerId).toBe('CNT-1001');
  });

  it('should generate sequential centerIds correctly based on existing records', async () => {
    const dto: CreateCenterDto = { name: 'Center 2' } as any;

    // Mock that there are already 5 centers
    centerRepository.findAll.mockResolvedValue([{}, {}, {}, {}, {}] as any);
    centerRepository.save.mockImplementation(async (center) => center as any);

    const result = await useCase.execute(dto);

    // If there are 5 centers, count is 5, so next is 1001 + 5 = 1006
    expect(result.centerId).toBe('CNT-1006');
  });
});
