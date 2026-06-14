import { BillingError } from '../errors/billing.error';
import { Money } from '../value-objects/money';

export type BillingOrderType = 'tuition' | 'salary';
export type BillingOrderStatus = 'Paid' | 'Unpaid';

export interface BillingOrderProps {
  id?: string;
  type: BillingOrderType;
  ownerId: string;
  periodId: string;
  totalAmount: number;
  paidAmount: number;
  status: BillingOrderStatus;
  paymentDate: Date | null;
  note: string | null;
}

export class BillingOrder {
  private total: Money;
  private paid: Money;

  private constructor(private readonly props: BillingOrderProps) {
    this.total = Money.vnd(props.totalAmount);
    this.paid = Money.vnd(props.paidAmount);
  }

  static restore(props: BillingOrderProps) {
    if (props.type !== 'tuition' && props.type !== 'salary') {
      throw new BillingError(
        'INVALID_ORDER_TYPE',
        'Loại đơn thanh toán không hợp lệ',
      );
    }
    return new BillingOrder(props);
  }

  get status() {
    return this.props.status;
  }

  markPaid(
    paidAmount: number | undefined,
    note: string | undefined,
    now: Date,
  ) {
    const requestedAmount =
      paidAmount === undefined ? this.total.value : Number(paidAmount);
    if (
      !Number.isFinite(requestedAmount) ||
      requestedAmount <= 0 ||
      requestedAmount > this.total.value
    ) {
      throw new BillingError(
        'INVALID_AMOUNT',
        'Số tiền đã trả phải lớn hơn 0 và không vượt quá tổng tiền',
      );
    }
    const amount = Money.vnd(requestedAmount);
    this.paid = amount;
    this.props.paidAmount = amount.value;
    this.props.status = 'Paid';
    this.props.paymentDate = now;
    if (note !== undefined) this.props.note = note.trim() || null;
  }

  markUnpaid(note: string | undefined) {
    this.paid = Money.vnd(0);
    this.props.paidAmount = 0;
    this.props.status = 'Unpaid';
    this.props.paymentDate = null;
    if (note !== undefined) this.props.note = note.trim() || null;
  }

  toPrimitives(): BillingOrderProps {
    return {
      ...this.props,
      totalAmount: this.total.value,
      paidAmount: this.paid.value,
    };
  }
}
