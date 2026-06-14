import { PaymentError } from '../errors/payment.error';
import { Money } from '../value-objects/money';

export type TuitionPaymentStatus =
  | 'pending'
  | 'processing'
  | 'reconciled'
  | 'cancelled';

export interface TuitionPaymentRequestProps {
  id?: string;
  billId: string;
  amount: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  transferContent: string;
  qrUrl: string;
  status: TuitionPaymentStatus;
  sentAt: Date;
  claimedAt: Date | null;
  reconciledAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class TuitionPaymentRequest {
  private paymentAmount: Money;

  constructor(private readonly props: TuitionPaymentRequestProps) {
    this.paymentAmount = Money.vnd(props.amount);
  }

  get id() {
    return this.props.id;
  }
  get billId() {
    return this.props.billId;
  }
  get amount() {
    return this.paymentAmount.value;
  }
  get bankCode() {
    return this.props.bankCode;
  }
  get accountNumber() {
    return this.props.accountNumber;
  }
  get accountName() {
    return this.props.accountName;
  }
  get transferContent() {
    return this.props.transferContent;
  }
  get qrUrl() {
    return this.props.qrUrl;
  }
  get status() {
    return this.props.status;
  }
  get sentAt() {
    return this.props.sentAt;
  }
  get claimedAt() {
    return this.props.claimedAt;
  }
  get reconciledAt() {
    return this.props.reconciledAt;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }

  reissue(input: {
    amount: number;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    transferContent: string;
    qrUrl: string;
    sentAt: Date;
  }) {
    this.paymentAmountValue(input.amount);
    Object.assign(this.props, {
      ...input,
      status: 'pending' as const,
      claimedAt: null,
      reconciledAt: null,
    });
  }

  claim(now: Date) {
    if (this.status === 'reconciled') return;
    if (this.status !== 'pending') {
      throw new PaymentError(
        'INVALID_PAYMENT_STATE',
        'Yêu cầu thanh toán hiện không thể xác nhận chuyển khoản',
      );
    }
    this.props.status = 'processing';
    this.props.claimedAt = now;
  }

  reconcile(transactionTime: Date) {
    if (this.status === 'reconciled') {
      throw new PaymentError(
        'PAYMENT_ALREADY_RECONCILED',
        'Yêu cầu thanh toán đã được đối soát bằng giao dịch khác',
      );
    }
    this.props.status = 'reconciled';
    this.props.reconciledAt = transactionTime;
  }

  matchesTransaction(input: {
    accountNumber: string;
    amount: number;
    transType: 'D' | 'C';
    orderId: string;
    content: string;
  }) {
    if (input.transType !== 'C') {
      throw new PaymentError(
        'INVALID_TRANSACTION_TYPE',
        'Giao dịch không phải giao dịch ghi có',
      );
    }
    if (
      input.accountNumber.replace(/\s/g, '') !==
      this.accountNumber.replace(/\s/g, '')
    ) {
      throw new PaymentError(
        'BANK_ACCOUNT_MISMATCH',
        'Tài khoản nhận tiền không khớp',
      );
    }
    if (!this.paymentAmount.equals(Money.vnd(input.amount))) {
      throw new PaymentError('AMOUNT_MISMATCH', 'Số tiền giao dịch không khớp');
    }
    const referenceMatches =
      input.orderId === this.id ||
      input.orderId === this.billId ||
      input.content.toUpperCase().includes(this.transferContent.toUpperCase());
    if (!referenceMatches) {
      throw new PaymentError(
        'PAYMENT_REFERENCE_MISMATCH',
        'Mã đơn hàng hoặc nội dung chuyển khoản không khớp',
      );
    }
  }

  toPrimitives(): TuitionPaymentRequestProps {
    return { ...this.props, amount: this.amount };
  }

  private paymentAmountValue(value: number) {
    const money = Money.vnd(value);
    this.props.amount = money.value;
    this.paymentAmount = money;
  }
}
