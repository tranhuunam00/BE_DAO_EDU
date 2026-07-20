import { CenterController } from '../../../../src/presentation/controllers/center.controller';

describe('CenterController', () => {
  let controller: CenterController;
  let addCenterUseCase: { execute: jest.Mock };
  let getCentersUseCase: { execute: jest.Mock };
  let getCenterByIdUseCase: { execute: jest.Mock };
  let updateCenterUseCase: { execute: jest.Mock };

  beforeEach(() => {
    addCenterUseCase = { execute: jest.fn() };
    getCentersUseCase = { execute: jest.fn() };
    getCenterByIdUseCase = { execute: jest.fn() };
    updateCenterUseCase = { execute: jest.fn() };

    controller = new CenterController(
      addCenterUseCase as any,
      getCentersUseCase as any,
      getCenterByIdUseCase as any,
      updateCenterUseCase as any,
    );
  });

  it('delegates center creation to AddCenterUseCase', async () => {
    const dto = { code: 'CT01', name: 'Trung tâm Cầu Giấy', address: 'HN' };
    addCenterUseCase.execute.mockResolvedValue({ id: 'center-1', ...dto });

    const result = await controller.create(dto as any);
    expect(addCenterUseCase.execute).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'center-1', ...dto });
  });

  it('delegates query listing to GetCentersUseCase with parsed query parameters', async () => {
    getCentersUseCase.execute.mockResolvedValue({ data: [], total: 0 });

    const result = await controller.findAll('1', '10', 'Cầu Giấy', 'Active', 'Hà Nội');
    expect(getCentersUseCase.execute).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      search: 'Cầu Giấy',
      status: 'Active',
      province: 'Hà Nội',
    });
    expect(result).toEqual({ data: [], total: 0 });
  });

  it('delegates getting single center to GetCenterByIdUseCase', async () => {
    getCenterByIdUseCase.execute.mockResolvedValue({ id: 'center-1', name: 'Center 1' });

    const result = await controller.findOne('center-1');
    expect(getCenterByIdUseCase.execute).toHaveBeenCalledWith('center-1');
    expect(result).toEqual({ id: 'center-1', name: 'Center 1' });
  });

  it('delegates center update to UpdateCenterUseCase', async () => {
    const dto = { name: 'Updated Center' };
    updateCenterUseCase.execute.mockResolvedValue({ id: 'center-1', name: 'Updated Center' });

    const result = await controller.update('center-1', dto);
    expect(updateCenterUseCase.execute).toHaveBeenCalledWith('center-1', dto);
    expect(result).toEqual({ id: 'center-1', name: 'Updated Center' });
  });
});
