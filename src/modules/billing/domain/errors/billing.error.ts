export type BillingErrorCode =
  | 'INVALID_REQUEST'
  | 'INVALID_PERIOD_TYPE'
  | 'INVALID_PERIOD_STATUS'
  | 'INVALID_ORDER_TYPE'
  | 'INVALID_ORDER_STATUS'
  | 'INVALID_DATE_RANGE'
  | 'INVALID_MONTH'
  | 'INVALID_AMOUNT'
  | 'PERIOD_NOT_FOUND'
  | 'ORDER_NOT_FOUND'
  | 'PAID_ORDER_CANNOT_BE_DELETED'
  | 'PERIOD_WITH_PAID_ORDERS_CANNOT_BE_DELETED';

export class BillingError extends Error {
  constructor(
    public readonly code: BillingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BillingError';
  }
}
