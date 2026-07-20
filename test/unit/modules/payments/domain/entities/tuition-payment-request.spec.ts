import { PaymentError } from '../../../../../../src/modules/payments/domain/errors/payment.error';
import { TuitionPaymentRequest } from '../../../../../../src/modules/payments/domain/entities/tuition-payment-request';

describe('TuitionPaymentRequest', () => {
  const createRequest = () =>
    new TuitionPaymentRequest({
      id: 'request-1',
      billId: 'bill-1',
      amount: 1250000,
      bankCode: '970418',
      accountNumber: '2152486504',
      accountName: 'DAO EDU',
      transferContent: 'DAOHP12345678ABCD',
      qrUrl: 'https://example.test/qr',
      status: 'pending',
      sentAt: new Date('2026-06-14T00:00:00Z'),
      claimedAt: null,
      reconciledAt: null,
    });

  it('owns the payment state transition', () => {
    const request = createRequest();
    const claimedAt = new Date('2026-06-14T01:00:00Z');
    request.claim(claimedAt);
    expect(request.status).toBe('processing');
    expect(request.claimedAt).toEqual(claimedAt);

    const reconciledAt = new Date('2026-06-14T01:01:00Z');
    request.reconcile(reconciledAt);
    expect(request.status).toBe('reconciled');
    expect(request.reconciledAt).toEqual(reconciledAt);
  });

  it('rejects a transaction that does not match the aggregate', () => {
    const request = createRequest();
    expect(() =>
      request.matchesTransaction({
        accountNumber: request.accountNumber,
        amount: request.amount + 1,
        transType: 'C',
        orderId: request.id!,
        content: request.transferContent,
      }),
    ).toThrow(PaymentError);
  });
});
