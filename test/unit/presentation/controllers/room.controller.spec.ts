import { RoomController } from '../../../../src/presentation/controllers/room.controller';

describe('RoomController', () => {
  let controller: RoomController;
  let roomRepo: {
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOneOrFail: jest.Mock;
  };

  beforeEach(() => {
    roomRepo = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findOneOrFail: jest.fn(),
    };

    controller = new RoomController(roomRepo as any);
  });

  it('finds rooms with filters', async () => {
    roomRepo.find.mockResolvedValue([{ id: 'room-1', name: 'P101' }]);

    const result = await controller.findAll('center-1', 'Active');
    expect(roomRepo.find).toHaveBeenCalledWith({
      where: { centerId: 'center-1', status: 'Active' },
      order: { name: 'ASC' },
    });
    expect(result).toEqual([{ id: 'room-1', name: 'P101' }]);
  });

  it('creates new room', async () => {
    const body = { centerId: 'center-1', name: 'P102', capacity: 25 };
    const roomEntity = { ...body, status: 'Active' };
    roomRepo.create.mockReturnValue(roomEntity);
    roomRepo.save.mockResolvedValue({ id: 'room-2', ...roomEntity });

    const result = await controller.create(body);
    expect(roomRepo.create).toHaveBeenCalledWith({
      centerId: 'center-1',
      name: 'P102',
      capacity: 25,
      status: 'Active',
    });
    expect(roomRepo.save).toHaveBeenCalledWith(roomEntity);
    expect(result).toEqual({ id: 'room-2', ...roomEntity });
  });

  it('updates existing room', async () => {
    const existingRoom = { id: 'room-1', name: 'P101', capacity: 30, status: 'Active' };
    roomRepo.findOneOrFail.mockResolvedValue(existingRoom);
    roomRepo.save.mockResolvedValue({ ...existingRoom, capacity: 40 });

    const result = await controller.update('room-1', { capacity: 40 });
    expect(roomRepo.findOneOrFail).toHaveBeenCalledWith({ where: { id: 'room-1' } });
    expect(roomRepo.save).toHaveBeenCalledWith({ ...existingRoom, capacity: 40 });
    expect(result).toEqual({ ...existingRoom, capacity: 40 });
  });
});
