import {
  BillingPersistencePort,
  BillingTransactionContext,
} from '../ports/billing-persistence.port';
import { CreatePaymentPeriodUseCase } from './create-payment-period.use-case';
import {
  DeleteBillingOrderUseCase,
  DeletePaymentPeriodUseCase,
  UpdateBillingOrderUseCase,
  UpdatePaymentPeriodStatusUseCase,
} from './manage-payment-period.use-cases';
import {
  PreviewSalaryUseCase,
  PreviewTuitionUseCase,
} from './preview-billing.use-case';

function makePersistence() {
  const context: jest.Mocked<BillingTransactionContext> = {
    loadPricings: jest.fn().mockResolvedValue([
      {
        courseLevelId: 'level-1',
        pricePerSession: 100000,
        teacherWagePerSession: 60000,
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
      },
    ]),
    findTuitionSources: jest.fn().mockResolvedValue([]),
    findSalarySources: jest.fn().mockResolvedValue([]),
    savePeriod: jest.fn().mockImplementation(async (period) => ({
      ...period,
      id: 'period-1',
    })),
    saveOrders: jest.fn().mockResolvedValue(undefined),
    findPeriod: jest.fn(),
    savePeriodStatus: jest.fn().mockResolvedValue(undefined),
    hasPaidOrders: jest.fn().mockResolvedValue(false),
    deletePeriod: jest.fn().mockResolvedValue(undefined),
    findOrder: jest.fn(),
    saveOrder: jest.fn().mockResolvedValue(undefined),
    resetPaymentRequest: jest.fn().mockResolvedValue(undefined),
    deleteOrder: jest.fn().mockResolvedValue(undefined),
  };
  const persistence: jest.Mocked<BillingPersistencePort> = {
    transaction: jest.fn().mockImplementation(async (work) => work(context)),
    loadPricings: context.loadPricings,
    findTuitionSources: context.findTuitionSources,
    findSalarySources: context.findSalarySources,
    listPeriods: jest.fn(),
    findPeriodDetails: jest.fn(),
  };
  return { persistence, context };
}

const attendance = {
  id: 'attendance-1',
  ownerId: 'student-1',
  ownerCode: 'S001',
  ownerName: 'Nguyen An',
  ownerMobile: '',
  ownerStatus: 'Active',
  ownerExtra: 'An',
  classId: 'class-1',
  className: 'English',
  courseName: 'English',
  levelName: 'A1',
  courseLevelId: 'level-1',
  date: '2026-06-10',
};

describe('Billing use cases', () => {
  it('previews tuition without opening a transaction', async () => {
    const { persistence, context } = makePersistence();
    context.findTuitionSources.mockResolvedValue([attendance]);
    const result = await new PreviewTuitionUseCase(persistence).execute(
      '2026-06',
      '2026-06-30',
    );
    expect(result.grandTotal).toBe(100000);
    expect(result.students[0].nickName).toBe('An');
    expect(persistence.transaction).not.toHaveBeenCalled();
  });

  it('previews salary with the teacher filter', async () => {
    const { persistence, context } = makePersistence();
    context.findSalarySources.mockResolvedValue([
      { ...attendance, id: 'session-1', ownerId: 'teacher-1' },
    ]);
    const result = await new PreviewSalaryUseCase(persistence).execute(
      '2026-06-30',
      ['teacher-1'],
    );
    expect(context.findSalarySources).toHaveBeenCalledWith('2026-06-30', [
      'teacher-1',
    ]);
    expect(result.grandTotal).toBe(60000);
  });

  it('creates the period and all orders in one transaction callback', async () => {
    const { persistence, context } = makePersistence();
    context.findTuitionSources.mockResolvedValue([attendance]);
    const result = await new CreatePaymentPeriodUseCase(persistence).execute({
      name: 'Học phí tháng 6',
      type: 'tuition',
      month: '2026-06',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      studentIds: ['student-1'],
    });
    expect(persistence.transaction).toHaveBeenCalledTimes(1);
    expect(context.saveOrders).toHaveBeenCalledWith(
      'tuition',
      expect.objectContaining({ id: 'period-1' }),
      [expect.objectContaining({ totalAmount: 100000 })],
    );
    expect(result.data.id).toBe('period-1');
  });

  it('validates the period before opening a transaction', () => {
    const { persistence } = makePersistence();
    expect(() =>
      new CreatePaymentPeriodUseCase(persistence).execute({
        name: '',
        type: 'tuition',
        month: '2026-06',
        startDate: '2026-06-01',
        endDate: '2026-06-30',
      }),
    ).toThrow('Tên đợt thanh toán không được để trống');
    expect(persistence.transaction).not.toHaveBeenCalled();
  });

  it('updates only valid period statuses', async () => {
    const { persistence, context } = makePersistence();
    context.findPeriod.mockResolvedValue({
      id: 'period-1',
      name: 'June',
      type: 'tuition',
      month: '2026-06',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      status: 'Active',
    });
    await new UpdatePaymentPeriodStatusUseCase(persistence).execute(
      'period-1',
      'Closed',
    );
    expect(context.savePeriodStatus).toHaveBeenCalledWith('period-1', 'Closed');
    await expect(
      new UpdatePaymentPeriodStatusUseCase(persistence).execute(
        'period-1',
        'Broken' as 'Closed',
      ),
    ).rejects.toThrow('Trạng thái đợt thanh toán không hợp lệ');
  });

  it('blocks deletion of a period containing paid orders', async () => {
    const { persistence, context } = makePersistence();
    context.findPeriod.mockResolvedValue({
      id: 'period-1',
      name: 'June',
      type: 'tuition',
      month: '2026-06',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      status: 'Active',
    });
    context.hasPaidOrders.mockResolvedValue(true);
    await expect(
      new DeletePaymentPeriodUseCase(persistence).execute('period-1'),
    ).rejects.toThrow('Không thể xóa đợt có đơn đã thanh toán');
    expect(context.deletePeriod).not.toHaveBeenCalled();
  });

  it('resets the VietQR request when a tuition bill becomes unpaid', async () => {
    const { persistence, context } = makePersistence();
    context.findOrder.mockResolvedValue({
      id: 'bill-1',
      type: 'tuition',
      ownerId: 'student-1',
      periodId: 'period-1',
      totalAmount: 100000,
      paidAmount: 100000,
      status: 'Paid',
      paymentDate: new Date(),
      note: null,
    });
    await new UpdateBillingOrderUseCase(persistence).execute({
      type: 'tuition',
      orderId: 'bill-1',
      status: 'Unpaid',
    });
    expect(context.saveOrder).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Unpaid', paidAmount: 0 }),
    );
    expect(context.resetPaymentRequest).toHaveBeenCalledWith('bill-1');
  });

  it('does not reset a payment request for salary orders', async () => {
    const { persistence, context } = makePersistence();
    context.findOrder.mockResolvedValue({
      id: 'wage-1',
      type: 'salary',
      ownerId: 'teacher-1',
      periodId: 'period-1',
      totalAmount: 60000,
      paidAmount: 60000,
      status: 'Paid',
      paymentDate: new Date(),
      note: null,
    });
    await new UpdateBillingOrderUseCase(persistence).execute({
      type: 'salary',
      orderId: 'wage-1',
      status: 'Unpaid',
    });
    expect(context.resetPaymentRequest).not.toHaveBeenCalled();
  });

  it('blocks deletion of paid orders and allows unpaid orders', async () => {
    const { persistence, context } = makePersistence();
    context.findOrder.mockResolvedValue({
      id: 'bill-1',
      type: 'tuition',
      ownerId: 'student-1',
      periodId: 'period-1',
      totalAmount: 100000,
      paidAmount: 100000,
      status: 'Paid',
      paymentDate: new Date(),
      note: null,
    });
    const useCase = new DeleteBillingOrderUseCase(persistence);
    await expect(useCase.execute('tuition', 'bill-1')).rejects.toThrow(
      'Không thể xóa đơn đã thanh toán',
    );
    context.findOrder.mockResolvedValue({
      ...(await context.findOrder.mock.results[0].value),
      paidAmount: 0,
      status: 'Unpaid',
      paymentDate: null,
    });
    await useCase.execute('tuition', 'bill-1');
    expect(context.deleteOrder).toHaveBeenCalledWith('tuition', 'bill-1');
  });
});
