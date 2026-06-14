import { PaymentPersistencePort } from '../ports/payment-persistence.port';

export class ListVietQrAuditsUseCase {
  constructor(private readonly persistence: PaymentPersistencePort) {}

  execute(limit?: string) {
    const parsed = Number(limit || 100);
    const take =
      Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 500) : 100;
    return this.persistence.listAudits(take);
  }
}
