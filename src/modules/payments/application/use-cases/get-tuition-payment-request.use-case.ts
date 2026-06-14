import { PaymentError } from '../../domain/errors/payment.error';
import { PaymentPersistencePort } from '../ports/payment-persistence.port';

export class GetTuitionPaymentRequestUseCase {
  constructor(private readonly persistence: PaymentPersistencePort) {}

  async execute(input: {
    billId: string;
    actorRole: string;
    actorUserId: string;
  }) {
    const details = await this.persistence.findRequestDetailsByBillId(
      input.billId,
    );
    if (
      !details ||
      (input.actorRole === 'STUDENT' &&
        details.studentUserId !== input.actorUserId)
    ) {
      throw new PaymentError(
        'PAYMENT_REQUEST_NOT_FOUND',
        'Chưa có yêu cầu thanh toán cho hóa đơn này',
      );
    }
    return { ...details.request, logs: details.logs };
  }
}
