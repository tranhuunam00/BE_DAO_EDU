import {
  CallbackAudit,
  PaymentPersistencePort,
  PaymentTransactionContext,
  TuitionBill,
} from '../../../../../src/modules/payments/application/ports/payment-persistence.port';
import {
  PaymentConfigPort,
  PaymentQrCodePort,
  VietQrTokenPort,
} from '../../../../../src/modules/payments/application/ports/payment-services.port';
import { PaymentLog } from '../../../../../src/modules/payments/domain/entities/payment-log';
import { TuitionPaymentRequest } from '../../../../../src/modules/payments/domain/entities/tuition-payment-request';
import { ClaimTuitionTransferUseCase } from '../../../../../src/modules/payments/application/use-cases/claim-tuition-transfer.use-case';
import { ProcessVietQrTransactionUseCase } from '../../../../../src/modules/payments/application/use-cases/process-vietqr-transaction.use-case';
import { SendTuitionPaymentRequestUseCase } from '../../../../../src/modules/payments/application/use-cases/send-tuition-payment-request.use-case';

describe('Payments application use cases', () => {
  const createContext = () => {
    const persistence = new InMemoryPaymentPersistence();
    persistence.bills.set('bill-1', {
      id: 'bill-1',
      month: '2026-06',
      totalAmount: 1250000,
      paidAmount: 0,
      status: 'Unpaid',
      paymentDate: null,
      note: null,
      studentUserId: 'student-user',
      periodName: 'Học phí tháng 6',
    });
    const config: PaymentConfigPort = {
      getBankAccount: () => ({
        bankCode: '970418',
        accountNumber: '2152486504',
        accountName: 'DAO EDU',
      }),
      isDemoEnabled: () => true,
    };
    const qrCode: PaymentQrCodePort = {
      build: ({ transferContent }) => `https://qr.test/${transferContent}`,
    };
    const tokens: VietQrTokenPort = {
      verifyBasicCredentials: () => undefined,
      issue: async () => 'token',
      verifyBearer: async () => undefined,
    };
    return { persistence, config, qrCode, tokens };
  };

  it('creates a request and notification through ports', async () => {
    const { persistence, config, qrCode } = createContext();
    const useCase = new SendTuitionPaymentRequestUseCase(
      persistence,
      config,
      qrCode,
    );

    const result = await useCase.execute('bill-1');

    expect(result.status).toBe('pending');
    expect(result.transferContent).toBe('DAOHPBILL1');
    expect(persistence.notifications).toHaveLength(1);
    expect(persistence.bills.get('bill-1')?.status).toBe('Unpaid');
  });

  it('records a student claim without marking the bill paid', async () => {
    const { persistence, config, qrCode } = createContext();
    await new SendTuitionPaymentRequestUseCase(
      persistence,
      config,
      qrCode,
    ).execute('bill-1');

    const result = await new ClaimTuitionTransferUseCase(persistence).execute({
      billId: 'bill-1',
      studentUserId: 'student-user',
    });

    expect(result.status).toBe('processing');
    expect(persistence.bills.get('bill-1')?.status).toBe('Unpaid');
    expect(persistence.paymentLogs[0].event).toBe('transfer_claimed');
  });

  it('reconciles only through a matching VietQR callback', async () => {
    const { persistence, config, qrCode, tokens } = createContext();
    const request = await new SendTuitionPaymentRequestUseCase(
      persistence,
      config,
      qrCode,
    ).execute('bill-1');
    const process = new ProcessVietQrTransactionUseCase(persistence, tokens);

    const result = await process.execute('Bearer token', {
      bankaccount: request.accountNumber,
      amount: request.amount,
      transType: 'C',
      content: request.transferContent,
      transactionid: 'transaction-1',
      transactiontime: 1757342061000,
      referencenumber: 'reference-1',
      orderId: request.id,
    });

    expect(result.error).toBe(false);
    expect(persistence.bills.get('bill-1')?.status).toBe('Paid');
    expect(persistence.requests.get('bill-1')?.status).toBe('reconciled');
    expect(persistence.paymentLogs.at(-1)).toMatchObject({
      source: 'vietqr_callback',
      externalTransactionId: 'transaction-1',
    });
    expect(persistence.audits.at(-1)?.result).toBe('success');
  });
});

class InMemoryPaymentPersistence
  extends PaymentPersistencePort
  implements PaymentTransactionContext
{
  bills = new Map<string, TuitionBill>();
  requests = new Map<string, TuitionPaymentRequest>();
  paymentLogs: PaymentLog[] = [];
  audits: CallbackAudit[] = [];
  notifications: Array<Record<string, unknown>> = [];

  transaction<T>(
    work: (context: PaymentTransactionContext) => Promise<T>,
  ): Promise<T> {
    return work(this);
  }

  async findRequestDetailsByBillId(billId: string) {
    const request = this.requests.get(billId);
    const bill = this.bills.get(billId);
    if (!request || !bill) return null;
    return {
      request: request.toPrimitives(),
      studentUserId: bill.studentUserId,
      logs: this.paymentLogs.filter(
        (log) => log.paymentRequestId === request.id,
      ),
    };
  }

  async saveAudit(audit: CallbackAudit) {
    const saved = {
      ...audit,
      id: audit.id || `audit-${this.audits.length + 1}`,
    };
    const index = this.audits.findIndex((item) => item.id === saved.id);
    if (index >= 0) this.audits[index] = saved;
    else this.audits.push(saved);
    return saved;
  }

  async listAudits(limit: number) {
    return this.audits.slice(-limit).reverse();
  }

  async findBillById(id: string) {
    return this.bills.get(id) || null;
  }

  async saveBill(bill: TuitionBill) {
    this.bills.set(bill.id, { ...bill });
  }

  async findRequestByBillId(billId: string) {
    return this.requests.get(billId) || null;
  }

  async findRequestForTransaction(orderId: string, content: string) {
    return (
      [...this.requests.values()].find(
        (request) =>
          request.id === orderId ||
          request.billId === orderId ||
          content.includes(request.transferContent),
      ) || null
    );
  }

  async saveRequest(request: TuitionPaymentRequest) {
    const primitives = request.toPrimitives();
    if (!primitives.id) {
      primitives.id = `request-${this.requests.size + 1}`;
      request = new TuitionPaymentRequest(primitives);
    }
    this.requests.set(request.billId, request);
    return request;
  }

  async listPaymentLogs(paymentRequestId: string) {
    return this.paymentLogs.filter(
      (log) => log.paymentRequestId === paymentRequestId,
    );
  }

  async findPaymentLogByTransactionId(transactionId: string) {
    return (
      this.paymentLogs.find(
        (log) => log.externalTransactionId === transactionId,
      ) || null
    );
  }

  async savePaymentLog(log: PaymentLog) {
    const saved = {
      ...log,
      id: log.id || `log-${this.paymentLogs.length + 1}`,
      createdAt: log.createdAt || new Date(),
    };
    this.paymentLogs.push(saved);
    return saved;
  }

  async findAuditById(id: string) {
    return this.audits.find((audit) => audit.id === id)!;
  }

  async saveNotification(input: Record<string, unknown>) {
    this.notifications.push(input);
  }
}
