import { PaymentError } from '../../domain/errors/payment.error';
import { TuitionPaymentRequest } from '../../domain/entities/tuition-payment-request';
import { presentPaymentRequest } from '../payment-presenter';
import { PaymentPersistencePort } from '../ports/payment-persistence.port';
import {
  PaymentConfigPort,
  PaymentQrCodePort,
} from '../ports/payment-services.port';

export class SendTuitionPaymentRequestUseCase {
  constructor(
    private readonly persistence: PaymentPersistencePort,
    private readonly config: PaymentConfigPort,
    private readonly qrCode: PaymentQrCodePort,
  ) {}

  execute(billId: string) {
    return this.persistence.transaction(async (context) => {
      const bill = await context.findBillById(billId);
      if (!bill) {
        throw new PaymentError(
          'BILL_NOT_FOUND',
          'Không tìm thấy hóa đơn học phí',
        );
      }
      if (bill.status === 'Paid') {
        throw new PaymentError(
          'BILL_ALREADY_PAID',
          'Hóa đơn đã được xác nhận thanh toán',
        );
      }
      if (!bill.studentUserId) {
        throw new PaymentError(
          'STUDENT_ACCOUNT_REQUIRED',
          'Học sinh chưa có tài khoản đăng nhập để nhận yêu cầu thanh toán',
        );
      }

      const bank = this.config.getBankAccount();
      const transferContent = `DAOHP${bill.id.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
      const now = new Date();
      const qrUrl = this.qrCode.build({
        bank,
        amount: bill.totalAmount,
        transferContent,
      });

      let request = await context.findRequestByBillId(billId);
      if (request) {
        request.reissue({
          amount: bill.totalAmount,
          ...bank,
          transferContent,
          qrUrl,
          sentAt: now,
        });
      } else {
        request = new TuitionPaymentRequest({
          billId,
          amount: bill.totalAmount,
          ...bank,
          transferContent,
          qrUrl,
          status: 'pending',
          sentAt: now,
          claimedAt: null,
          reconciledAt: null,
        });
      }

      const saved = await context.saveRequest(request);
      await context.saveNotification({
        userId: bill.studentUserId,
        type: 'tuition_payment_request',
        title: 'Yêu cầu đóng học phí',
        message: `${bill.periodName || `Học phí tháng ${bill.month}`}: ${bill.totalAmount.toLocaleString('vi-VN')} đ`,
        linkPath: '/student/tuition',
        priority: 'urgent',
        metadata: { billId, paymentRequestId: saved.id },
      });
      return presentPaymentRequest(saved);
    });
  }
}
