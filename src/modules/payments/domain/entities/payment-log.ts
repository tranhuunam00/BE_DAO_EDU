export type PaymentLogEvent = 'transfer_claimed' | 'auto_reconciled';
export type PaymentLogStatus = 'processing' | 'success' | 'failed';
export type PaymentLogSource = 'simulation' | 'vietqr_callback';

export interface PaymentLog {
  id?: string;
  paymentRequestId: string;
  billId: string;
  event: PaymentLogEvent;
  status: PaymentLogStatus;
  amount: number;
  source: PaymentLogSource;
  externalTransactionId: string | null;
  message: string | null;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;
}
