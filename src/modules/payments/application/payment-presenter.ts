import { PaymentLog } from '../domain/entities/payment-log';
import { TuitionPaymentRequest } from '../domain/entities/tuition-payment-request';

export function presentPaymentRequest(
  request: TuitionPaymentRequest,
  logs: PaymentLog[] = [],
) {
  return {
    ...request.toPrimitives(),
    logs,
  };
}
