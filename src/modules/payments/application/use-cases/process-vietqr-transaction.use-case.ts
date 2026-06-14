import { PaymentError } from '../../domain/errors/payment.error';
import {
  CallbackAudit,
  PaymentPersistencePort,
} from '../ports/payment-persistence.port';
import { VietQrTokenPort } from '../ports/payment-services.port';

export interface VietQrTransaction {
  bankaccount: string;
  amount: number;
  transType: 'D' | 'C';
  content: string;
  transactionid: string;
  transactiontime: number;
  referencenumber: string;
  orderId: string;
  terminalCode?: string;
  subTerminalCode?: string;
  serviceCode?: string;
  urlLink?: string;
  sign?: string;
}

export class ProcessVietQrTransactionUseCase {
  constructor(
    private readonly persistence: PaymentPersistencePort,
    private readonly tokens: VietQrTokenPort,
  ) {}

  async execute(
    authorization: string | undefined,
    rawBody: Record<string, unknown>,
  ) {
    const audit = await this.persistence.saveAudit(this.receivedAudit(rawBody));

    try {
      await this.tokens.verifyBearer(authorization);
    } catch {
      await this.rejectAudit(
        audit,
        'AUTHORIZATION_FAILED',
        'Callback không có Bearer token hợp lệ',
      );
      throw new PaymentError(
        'AUTHORIZATION_FAILED',
        'Invalid or expired VietQR callback token',
      );
    }

    const transaction = this.parseTransaction(rawBody);
    if (!transaction) {
      await this.rejectAudit(
        audit,
        'INVALID_REQUEST',
        'Payload Transaction Sync không hợp lệ',
      );
      throw new PaymentError(
        'INVALID_REQUEST',
        'Payload Transaction Sync không hợp lệ',
      );
    }

    try {
      const result = await this.persistence.transaction(async (context) => {
        const transactionAudit = await context.findAuditById(audit.id!);
        const duplicate = await context.findPaymentLogByTransactionId(
          transaction.transactionid,
        );
        if (duplicate) {
          Object.assign(transactionAudit, {
            paymentRequestId: duplicate.paymentRequestId,
            billId: duplicate.billId,
            result: 'duplicate' as const,
            errorReason: null,
            message: 'Callback lặp lại, giao dịch đã được xử lý trước đó',
            processedAt: new Date(),
          });
          await context.saveAudit(transactionAudit);
          return this.success(
            transaction.transactionid,
            'Giao dịch đã được xử lý',
          );
        }

        const request = await context.findRequestForTransaction(
          transaction.orderId,
          transaction.content,
        );
        if (!request) {
          throw new PaymentError(
            'PAYMENT_REQUEST_NOT_FOUND',
            'Không tìm thấy yêu cầu thanh toán phù hợp',
          );
        }
        transactionAudit.paymentRequestId = request.id!;
        transactionAudit.billId = request.billId;

        request.matchesTransaction({
          accountNumber: transaction.bankaccount,
          amount: transaction.amount,
          transType: transaction.transType,
          orderId: transaction.orderId,
          content: transaction.content,
        });

        const bill = await context.findBillById(request.billId);
        if (!bill) {
          throw new PaymentError('BILL_NOT_FOUND', 'Không tìm thấy hóa đơn');
        }

        const transactionDate = new Date(transaction.transactiontime);
        request.reconcile(transactionDate);
        bill.status = 'Paid';
        bill.paidAmount = transaction.amount;
        bill.paymentDate = transactionDate;
        bill.note = `Đối soát tự động qua VietQR - ${transaction.referencenumber}`;
        await context.saveBill(bill);
        await context.saveRequest(request);
        await context.savePaymentLog({
          paymentRequestId: request.id!,
          billId: request.billId,
          event: 'auto_reconciled',
          status: 'success',
          amount: transaction.amount,
          source: 'vietqr_callback',
          externalTransactionId: transaction.transactionid,
          message: 'Đối soát tự động thành công từ callback VietQR',
          metadata: { ...transaction },
        });
        Object.assign(transactionAudit, {
          result: 'success' as const,
          errorReason: null,
          message: 'Callback hợp lệ và đã đối soát thành công',
          processedAt: new Date(),
        });
        await context.saveAudit(transactionAudit);
        return this.success(
          transaction.transactionid,
          'Đối soát giao dịch thành công',
        );
      });
      return result;
    } catch (error) {
      if (error instanceof PaymentError) {
        await this.rejectAudit(audit, error.code, error.message);
      } else {
        await this.rejectAudit(
          audit,
          'INVALID_REQUEST',
          'Có lỗi nội bộ khi xử lý callback',
        );
      }
      throw error;
    }
  }

  private receivedAudit(rawBody: Record<string, unknown>): CallbackAudit {
    return {
      transactionId:
        typeof rawBody.transactionid === 'string'
          ? rawBody.transactionid
          : null,
      referenceNumber:
        typeof rawBody.referencenumber === 'string'
          ? rawBody.referencenumber
          : null,
      orderId: typeof rawBody.orderId === 'string' ? rawBody.orderId : null,
      paymentRequestId: null,
      billId: null,
      result: 'received',
      errorReason: null,
      message: 'Đã nhận callback Transaction Sync từ VietQR',
      payload: { ...rawBody },
      processedAt: null,
    };
  }

  private parseTransaction(
    raw: Record<string, unknown>,
  ): VietQrTransaction | null {
    const requiredStrings = [
      'bankaccount',
      'content',
      'transactionid',
      'referencenumber',
      'orderId',
    ] as const;
    if (
      requiredStrings.some(
        (key) => typeof raw[key] !== 'string' || !raw[key].trim(),
      ) ||
      !Number.isInteger(Number(raw.amount)) ||
      Number(raw.amount) <= 0 ||
      !Number.isInteger(Number(raw.transactiontime)) ||
      Number(raw.transactiontime) <= 0 ||
      (raw.transType !== 'C' && raw.transType !== 'D')
    ) {
      return null;
    }
    return {
      ...(raw as unknown as VietQrTransaction),
      amount: Number(raw.amount),
      transactiontime: Number(raw.transactiontime),
    };
  }

  private async rejectAudit(
    audit: CallbackAudit,
    errorReason: string,
    message: string,
  ) {
    await this.persistence.saveAudit({
      ...audit,
      result: 'rejected',
      errorReason,
      message,
      processedAt: new Date(),
    });
  }

  private success(reftransactionid: string, toastMessage: string) {
    return {
      error: false,
      errorReason: '',
      toastMessage,
      object: { reftransactionid },
    };
  }
}
