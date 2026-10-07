import { TuitionPaymentRequest } from '../../domain/entities/tuition-payment-request';
import { PaymentError } from '../../domain/errors/payment.error';
import { presentPaymentRequest } from '../payment-presenter';
import { PaymentPersistencePort } from '../ports/payment-persistence.port';
import { PaymentConfigPort } from '../ports/payment-services.port';

export class ClaimTuitionTransferUseCase {
  constructor(
    private readonly persistence: PaymentPersistencePort,
    private readonly config?: PaymentConfigPort,
  ) {}

  execute(input: { billId: string; studentUserId: string }) {
    return this.persistence.transaction(async (context) => {
      const bill = await context.findBillById(input.billId);
      if (!bill || bill.studentUserId !== input.studentUserId) {
        throw new PaymentError(
          'PAYMENT_REQUEST_NOT_FOUND',
          'Không tìm thấy hóa đơn hợp lệ cho học sinh này',
        );
      }

      let request = await context.findRequestByBillId(input.billId, true);
      const now = new Date();

      if (!request) {
        const bank = this.config?.getBankAccount() ?? {
          bankCode: '970407',
          accountNumber: '8888383999',
          accountName: 'CONG TY CO PHAN DAOGROUP',
        };
        const transferContent = `DAOHP${bill.id.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
        request = new TuitionPaymentRequest({
          billId: input.billId,
          amount: bill.totalAmount,
          ...bank,
          transferContent,
          qrUrl: '/qr_daogroup.png',
          status: 'pending',
          sentAt: now,
          claimedAt: null,
          reconciledAt: null,
        });
      }

      const logs = request.id ? await context.listPaymentLogs(request.id) : [];
      if (request.status === 'reconciled' || bill.status === 'Paid') {
        return presentPaymentRequest(request, logs);
      }

      request.claim(now);
      const saved = await context.saveRequest(request);
      const claimedLog = await context.savePaymentLog({
        paymentRequestId: saved.id!,
        billId: input.billId,
        event: 'transfer_claimed',
        status: 'processing',
        amount: saved.amount,
        source: 'simulation',
        externalTransactionId: null,
        message: 'Học sinh xác nhận đã chuyển khoản',
        metadata: { confirmedByUserId: input.studentUserId },
      });
      return presentPaymentRequest(saved, [...logs, claimedLog]);
    });
  }
}
