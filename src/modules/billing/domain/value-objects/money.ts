import { BillingError } from '../errors/billing.error';

export class Money {
  private constructor(public readonly value: number) {}

  static vnd(value: number) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BillingError('INVALID_AMOUNT', 'Số tiền không hợp lệ');
    }
    return new Money(Math.round(amount));
  }

  plus(other: Money) {
    return Money.vnd(this.value + other.value);
  }
}
