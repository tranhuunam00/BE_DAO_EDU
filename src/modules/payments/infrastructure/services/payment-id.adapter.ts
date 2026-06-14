import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PaymentIdPort } from '../../application/ports/payment-services.port';

@Injectable()
export class PaymentIdAdapter extends PaymentIdPort {
  transactionId(): string {
    return `DEMO-${randomUUID()}`;
  }
}
