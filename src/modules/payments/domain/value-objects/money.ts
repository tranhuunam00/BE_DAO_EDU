import { PaymentError } from '../errors/payment.error';

export class Money {
  private constructor(public readonly value: number) {}

  static vnd(value: number): Money {
    if (!Number.isInteger(value) || value <= 0) {
      throw new PaymentError(
        'INVALID_AMOUNT',
        'Số tiền phải là số nguyên dương theo đơn vị VND',
      );
    }
    return new Money(value);
  }

  equals(other: Money): boolean {
    return this.value === other.value;
  }
}
