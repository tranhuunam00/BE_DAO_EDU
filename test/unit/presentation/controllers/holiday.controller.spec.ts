import { HolidayController } from '../../../../src/presentation/controllers/holiday.controller';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('HolidayController', () => {
  let controller: HolidayController;
  let listHolidays: { execute: jest.Mock };
  let saveHoliday: { execute: jest.Mock };
  let deleteHoliday: { execute: jest.Mock };

  beforeEach(() => {
    listHolidays = { execute: jest.fn() };
    saveHoliday = { execute: jest.fn() };
    deleteHoliday = { execute: jest.fn() };

    controller = new HolidayController(
      listHolidays as any,
      saveHoliday as any,
      deleteHoliday as any,
    );
  });

  it('lists holidays in date range', async () => {
    listHolidays.execute.mockResolvedValue([{ id: 'h1', date: '2026-09-02', name: 'Quoc khanh' }]);

    const result = await controller.findAll('2026-09-01', '2026-09-30');
    expect(listHolidays.execute).toHaveBeenCalledWith('2026-09-01', '2026-09-30');
    expect(result).toEqual([{ id: 'h1', date: '2026-09-02', name: 'Quoc khanh' }]);
  });

  it('creates holiday', async () => {
    const dto = { date: '2026-09-02', name: 'Quoc khanh' };
    saveHoliday.execute.mockResolvedValue({ id: 'h1', ...dto });

    const result = await controller.create(dto as any);
    expect(saveHoliday.execute).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'h1', ...dto });
  });

  it('updates holiday', async () => {
    listHolidays.execute.mockResolvedValue([{ id: 'h1', date: '2026-09-02', name: 'Old' }]);
    saveHoliday.execute.mockResolvedValue({ id: 'h1', date: '2026-09-02', name: 'New' });

    const result = await controller.update('h1', { name: 'New' } as any);
    expect(saveHoliday.execute).toHaveBeenCalledWith({ id: 'h1', date: '2026-09-02', name: 'New', description: undefined });
    expect(result).toEqual({ id: 'h1', date: '2026-09-02', name: 'New' });
  });

  it('throws NotFoundException when updating non-existent holiday', async () => {
    listHolidays.execute.mockResolvedValue([]);

    await expect(controller.update('invalid-id', { name: 'New' } as any)).rejects.toThrow(NotFoundException);
  });

  it('deletes holiday', async () => {
    deleteHoliday.execute.mockResolvedValue(undefined);

    const result = await controller.remove('h1');
    expect(deleteHoliday.execute).toHaveBeenCalledWith('h1');
    expect(result).toEqual({ message: 'Đã xóa ngày nghỉ.' });
  });

  it('handles HOLIDAY_DATE_EXISTS error as ConflictException', async () => {
    saveHoliday.execute.mockRejectedValue(new Error('HOLIDAY_DATE_EXISTS'));

    await expect(controller.create({ date: '2026-09-02', name: 'Dup' } as any)).rejects.toThrow(ConflictException);
  });
});
