import { BillingOrder } from '../../../../../../src/modules/billing/domain/entities/billing-order';

const restore = () =>
  BillingOrder.restore({
    id: 'bill-1',
    type: 'tuition',
    ownerId: 'student-1',
    periodId: 'period-1',
    totalAmount: 300000,
    paidAmount: 0,
    status: 'Unpaid',
    paymentDate: null,
    note: null,
  });

describe('BillingOrder', () => {
  it('marks the full amount paid by default', () => {
    const order = restore();
    const now = new Date('2026-06-14T10:00:00Z');
    order.markPaid(undefined, 'Bank transfer', now, 'bank_transfer', 'admin-1');
    expect(order.toPrimitives()).toEqual(
      expect.objectContaining({
        status: 'Paid',
        paidAmount: 300000,
        paymentDate: now,
        note: 'Bank transfer',
      }),
    );
  });

  it('rejects a partial payment', () => {
    expect(() =>
      restore().markPaid(100000, undefined, new Date(), 'cash', 'admin-1'),
    ).toThrow(
      'Khoản thanh toán phải bằng đúng tổng số tiền',
    );
  });

  it.each([0, -1, 300001, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid paid amount %s',
    (amount) => {
      expect(() =>
        restore().markPaid(amount, undefined, new Date(), 'cash', 'admin-1'),
      ).toThrow();
    },
  );

  it('clears payment fields when marked unpaid', () => {
    const order = restore();
    order.markPaid(undefined, undefined, new Date(), 'cash', 'admin-1');
    order.markUnpaid('Hủy phiếu thu nhập sai', 'admin-1');
    expect(order.toPrimitives()).toEqual(
      expect.objectContaining({
        status: 'Unpaid',
        paidAmount: 0,
        paymentDate: null,
        note: 'Hủy phiếu thu nhập sai',
      }),
    );
  });

  it('blocks collecting an already paid order again', () => {
    const order = restore();
    order.markPaid(undefined, undefined, new Date(), 'cash', 'admin-1');
    expect(() =>
      order.markPaid(undefined, undefined, new Date(), 'cash', 'admin-1'),
    ).toThrow('Giao dịch đã được thanh toán');
  });

  it('requires a cancellation reason for a paid order', () => {
    const order = restore();
    order.markPaid(undefined, undefined, new Date(), 'cash', 'admin-1');
    expect(() => order.markUnpaid('', 'admin-1')).toThrow(
      'Phải nhập lý do hủy xác nhận thanh toán',
    );
  });
});
