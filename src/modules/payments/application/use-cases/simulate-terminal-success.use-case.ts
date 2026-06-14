import { PaymentError } from '../../domain/errors/payment.error';
import { PaymentPersistencePort } from '../ports/payment-persistence.port';
import {
  PaymentConfigPort,
  PaymentIdPort,
  VietQrTokenPort,
} from '../ports/payment-services.port';
import { ProcessVietQrTransactionUseCase } from './process-vietqr-transaction.use-case';

export class SimulateTerminalSuccessUseCase {
  constructor(
    private readonly persistence: PaymentPersistencePort,
    private readonly config: PaymentConfigPort,
    private readonly tokens: VietQrTokenPort,
    private readonly ids: PaymentIdPort,
    private readonly processTransaction: ProcessVietQrTransactionUseCase,
  ) {}

  async execute(input: { billId: string; studentUserId: string }) {
    if (!this.config.isDemoEnabled()) {
      throw new PaymentError(
        'DEMO_DISABLED',
        'Chức năng demo terminal chưa được bật',
      );
    }
    const details = await this.persistence.findRequestDetailsByBillId(
      input.billId,
    );
    if (!details || details.studentUserId !== input.studentUserId) {
      throw new PaymentError(
        'PAYMENT_REQUEST_NOT_FOUND',
        'Chưa có yêu cầu thanh toán cho hóa đơn này',
      );
    }
    const request = details.request;
    const transactionId = this.ids.transactionId();
    const token = await this.tokens.issue('demo-terminal', 60);
    return this.processTransaction.execute(`Bearer ${token}`, {
      bankaccount: request.accountNumber,
      amount: request.amount,
      transType: 'C',
      content: request.transferContent,
      transactionid: transactionId,
      transactiontime: Date.now(),
      referencenumber: transactionId,
      orderId: request.id!,
      terminalCode: 'DAO_EDU_DEMO',
      serviceCode: 'TUITION',
    });
  }
}
