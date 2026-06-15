import {
  TuitionPaymentRequest,
  TuitionPaymentRequestProps,
} from '../../domain/entities/tuition-payment-request';
import { PaymentLog } from '../../domain/entities/payment-log';

export interface TuitionBill {
  id: string;
  month: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  paymentDate: Date | null;
  note: string | null;
  studentUserId: string | null;
  periodName: string | null;
}

export interface CallbackAudit {
  id?: string;
  transactionId: string | null;
  referenceNumber: string | null;
  orderId: string | null;
  paymentRequestId: string | null;
  billId: string | null;
  result: 'received' | 'success' | 'duplicate' | 'rejected';
  errorReason: string | null;
  message: string | null;
  payload: Record<string, unknown>;
  processedAt: Date | null;
  createdAt?: Date;
}

export interface PaymentTransactionContext {
  findBillById(id: string): Promise<TuitionBill | null>;
  saveBill(bill: TuitionBill): Promise<void>;
  findRequestByBillId(
    billId: string,
    lock?: boolean,
  ): Promise<TuitionPaymentRequest | null>;
  findRequestForTransaction(
    orderId: string,
    content: string,
  ): Promise<TuitionPaymentRequest | null>;
  saveRequest(request: TuitionPaymentRequest): Promise<TuitionPaymentRequest>;
  listPaymentLogs(paymentRequestId: string): Promise<PaymentLog[]>;
  findPaymentLogByTransactionId(
    transactionId: string,
  ): Promise<PaymentLog | null>;
  savePaymentLog(log: PaymentLog): Promise<PaymentLog>;
  findAuditById(id: string): Promise<CallbackAudit>;
  saveAudit(audit: CallbackAudit): Promise<CallbackAudit>;
  saveNotification(input: {
    userId: string;
    type: string;
    title: string;
    message: string;
    linkPath: string | null;
    priority?: 'normal' | 'important' | 'urgent';
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

export abstract class PaymentPersistencePort {
  abstract transaction<T>(
    work: (context: PaymentTransactionContext) => Promise<T>,
  ): Promise<T>;
  abstract findRequestDetailsByBillId(billId: string): Promise<{
    request: TuitionPaymentRequestProps;
    studentUserId: string | null;
    logs: PaymentLog[];
  } | null>;
  abstract saveAudit(audit: CallbackAudit): Promise<CallbackAudit>;
  abstract listAudits(limit: number): Promise<CallbackAudit[]>;
}
