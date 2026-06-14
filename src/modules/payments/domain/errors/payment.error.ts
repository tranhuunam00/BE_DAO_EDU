export type PaymentErrorCode =
  | 'PAYMENT_REQUEST_NOT_FOUND'
  | 'BILL_NOT_FOUND'
  | 'BILL_ALREADY_PAID'
  | 'INVALID_AMOUNT'
  | 'STUDENT_ACCOUNT_REQUIRED'
  | 'INVALID_PAYMENT_STATE'
  | 'PAYMENT_ALREADY_RECONCILED'
  | 'INVALID_TRANSACTION_TYPE'
  | 'BANK_ACCOUNT_MISMATCH'
  | 'AMOUNT_MISMATCH'
  | 'PAYMENT_REFERENCE_MISMATCH'
  | 'INVALID_REQUEST'
  | 'AUTHORIZATION_FAILED'
  | 'DEMO_DISABLED';

export class PaymentError extends Error {
  constructor(
    public readonly code: PaymentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}
