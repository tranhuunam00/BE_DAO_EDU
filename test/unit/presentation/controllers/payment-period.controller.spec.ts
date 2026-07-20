import { PaymentPeriodController } from '../../../../src/presentation/controllers/payment-period.controller';
import { BillingError } from '../../../../src/modules/billing/domain/errors/billing.error';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PaymentPeriodController', () => {
  let controller: PaymentPeriodController;
  let listPeriods: { execute: jest.Mock };
  let getPeriod: { execute: jest.Mock };
  let previewTuitionUseCase: { execute: jest.Mock };
  let previewSalaryUseCase: { execute: jest.Mock };
  let createPeriod: { execute: jest.Mock };
  let updatePeriodStatus: { execute: jest.Mock };
  let deletePeriodUseCase: { execute: jest.Mock };
  let updateOrder: { execute: jest.Mock };
  let deleteOrderUseCase: { execute: jest.Mock };

  beforeEach(() => {
    listPeriods = { execute: jest.fn() };
    getPeriod = { execute: jest.fn() };
    previewTuitionUseCase = { execute: jest.fn() };
    previewSalaryUseCase = { execute: jest.fn() };
    createPeriod = { execute: jest.fn() };
    updatePeriodStatus = { execute: jest.fn() };
    deletePeriodUseCase = { execute: jest.fn() };
    updateOrder = { execute: jest.fn() };
    deleteOrderUseCase = { execute: jest.fn() };

    controller = new PaymentPeriodController(
      listPeriods as any,
      getPeriod as any,
      previewTuitionUseCase as any,
      previewSalaryUseCase as any,
      createPeriod as any,
      updatePeriodStatus as any,
      deletePeriodUseCase as any,
      updateOrder as any,
      deleteOrderUseCase as any,
    );
  });

  const req = { user: { sub: 'admin-user-1' } };

  it('lists all payment periods', async () => {
    listPeriods.execute.mockResolvedValue([{ id: 'period-1' }]);

    const result = await controller.findAll();
    expect(listPeriods.execute).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'period-1' }]);
  });

  it('previews tuition payments up to end date', async () => {
    previewTuitionUseCase.execute.mockResolvedValue({ preview: [] });

    const result = await controller.previewTuition('2026-07-31');
    expect(previewTuitionUseCase.execute).toHaveBeenCalledWith('2026-07', '2026-07-31');
    expect(result).toEqual({ preview: [] });
  });

  it('previews salary payments up to end date', async () => {
    previewSalaryUseCase.execute.mockResolvedValue({ preview: [] });

    const result = await controller.previewSalary('2026-07-31');
    expect(previewSalaryUseCase.execute).toHaveBeenCalledWith('2026-07-31');
    expect(result).toEqual({ preview: [] });
  });

  it('gets single payment period detail', async () => {
    getPeriod.execute.mockResolvedValue({ id: 'period-1' });

    const result = await controller.findOne('period-1');
    expect(getPeriod.execute).toHaveBeenCalledWith('period-1');
    expect(result).toEqual({ id: 'period-1' });
  });

  it('creates payment period', async () => {
    const body = { name: 'Dot 1' };
    createPeriod.execute.mockResolvedValue({ id: 'period-1', name: 'Dot 1' });

    const result = await controller.create(req as any, body);
    expect(createPeriod.execute).toHaveBeenCalledWith({ name: 'Dot 1', actorId: 'admin-user-1' });
    expect(result).toEqual({ id: 'period-1', name: 'Dot 1' });
  });

  it('updates payment period status', async () => {
    updatePeriodStatus.execute.mockResolvedValue({ id: 'period-1', status: 'Closed' });

    const result = await controller.updateStatus(req as any, 'period-1', 'Closed');
    expect(updatePeriodStatus.execute).toHaveBeenCalledWith('period-1', 'Closed', 'admin-user-1');
    expect(result).toEqual({ id: 'period-1', status: 'Closed' });
  });

  it('deletes payment period', async () => {
    deletePeriodUseCase.execute.mockResolvedValue({ success: true });

    const result = await controller.deletePeriod('period-1');
    expect(deletePeriodUseCase.execute).toHaveBeenCalledWith('period-1');
    expect(result).toEqual({ success: true });
  });

  it('updates order status in period', async () => {
    updateOrder.execute.mockResolvedValue({ orderId: 'ord-1', status: 'Paid' });

    const result = await controller.updateOrderStatus(req as any, 'tuition', 'ord-1', 'Paid', 1000, '2026-07-20', 'Bank', 'Da nhan');
    expect(updateOrder.execute).toHaveBeenCalledWith({
      type: 'tuition',
      orderId: 'ord-1',
      status: 'Paid',
      paidAmount: 1000,
      paymentDate: '2026-07-20',
      paymentMethod: 'Bank',
      actorId: 'admin-user-1',
      note: 'Da nhan',
    });
    expect(result).toEqual({ orderId: 'ord-1', status: 'Paid' });
  });

  it('deletes single order from period', async () => {
    deleteOrderUseCase.execute.mockResolvedValue({ success: true });

    const result = await controller.deleteOrder('tuition', 'ord-1');
    expect(deleteOrderUseCase.execute).toHaveBeenCalledWith('tuition', 'ord-1');
    expect(result).toEqual({ success: true });
  });

  it('translates BillingError.PERIOD_NOT_FOUND to NotFoundException', async () => {
    getPeriod.execute.mockRejectedValue(new BillingError('PERIOD_NOT_FOUND', 'Not found'));

    await expect(controller.findOne('invalid-id')).rejects.toThrow(NotFoundException);
  });

  it('translates other BillingError to BadRequestException', async () => {
    createPeriod.execute.mockRejectedValue(new BillingError('INVALID_DATES', 'Invalid dates'));

    await expect(controller.create(req as any, {})).rejects.toThrow(BadRequestException);
  });
});
