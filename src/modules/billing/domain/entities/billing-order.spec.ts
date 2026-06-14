import { BillingOrder } from './billing-order';

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
    order.markPaid(undefined, 'Bank transfer', now);
    expect(order.toPrimitives()).toEqual(
      expect.objectContaining({
        status: 'Paid',
        paidAmount: 300000,
        paymentDate: now,
        note: 'Bank transfer',
      }),
    );
  });

  it('allows a positive partial payment for backward compatibility', () => {
    const order = restore();
    order.markPaid(100000, undefined, new Date());
    expect(order.toPrimitives().paidAmount).toBe(100000);
  });

  it.each([0, -1, 300001, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid paid amount %s',
    (amount) => {
      expect(() => restore().markPaid(amount, undefined, new Date())).toThrow(
        'Số tiền đã trả phải lớn hơn 0 và không vượt quá tổng tiền',
      );
    },
  );

  it('clears payment fields when marked unpaid', () => {
    const order = restore();
    order.markPaid(undefined, undefined, new Date());
    order.markUnpaid(' ');
    expect(order.toPrimitives()).toEqual(
      expect.objectContaining({
        status: 'Unpaid',
        paidAmount: 0,
        paymentDate: null,
        note: null,
      }),
    );
  });
});
