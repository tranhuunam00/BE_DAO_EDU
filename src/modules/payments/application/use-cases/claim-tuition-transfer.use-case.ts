import { PaymentError } from '../../domain/errors/payment.error';
import { presentPaymentRequest } from '../payment-presenter';
import { PaymentPersistencePort } from '../ports/payment-persistence.port';

export class ClaimTuitionTransferUseCase {
  constructor(private readonly persistence: PaymentPersistencePort) {}

  execute(input: { billId: string; studentUserId: string }) {
    return this.persistence.transaction(async (context) => {
      const request = await context.findRequestByBillId(input.billId, true);
      const bill = await context.findBillById(input.billId);
      if (!request || !bill || bill.studentUserId !== input.studentUserId) {
        throw new PaymentError(
          'PAYMENT_REQUEST_NOT_FOUND',
          'Chưa có yêu cầu thanh toán cho hóa đơn này',
        );
      }

      const logs = await context.listPaymentLogs(request.id!);
      if (request.status === 'reconciled' || bill.status === 'Paid') {
        return presentPaymentRequest(request, logs);
      }

      const now = new Date();
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
