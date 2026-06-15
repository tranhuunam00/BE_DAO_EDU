import { BillingPersistencePort } from '../ports/billing-persistence.port';
import { BillingError } from '../../domain/errors/billing.error';
import {
  BillingOrder,
  BillingOrderStatus,
  BillingOrderType,
} from '../../domain/entities/billing-order';
import {
  PaymentPeriod,
  PaymentPeriodStatus,
} from '../../domain/entities/payment-period';

export class ListPaymentPeriodsUseCase {
  constructor(private readonly persistence: BillingPersistencePort) {}
  execute() {
    return this.persistence.listPeriods();
  }
}

export class GetPaymentPeriodUseCase {
  constructor(private readonly persistence: BillingPersistencePort) {}
  async execute(id: string) {
    const details = await this.persistence.findPeriodDetails(id);
    if (!details) {
      throw new BillingError(
        'PERIOD_NOT_FOUND',
        'Không tìm thấy đợt thanh toán',
      );
    }
    return details;
  }
}

export class UpdatePaymentPeriodStatusUseCase {
  constructor(private readonly persistence: BillingPersistencePort) {}
  execute(id: string, status: PaymentPeriodStatus, actorId?: string) {
    return this.persistence.transaction(async (context) => {
      const current = await context.findPeriod(id);
      if (!current) {
        throw new BillingError(
          'PERIOD_NOT_FOUND',
          'Không tìm thấy đợt thanh toán',
        );
      }
      const period = PaymentPeriod.restore(current);
      period.changeStatus(status);
      await context.savePeriodStatus(id, period.status);
      await context.saveAudit({
        event: status === 'Closed' ? 'PERIOD_CLOSED' : 'PERIOD_REOPENED',
        periodId: id,
        actorId,
        metadata: { previousStatus: current.status, status },
      });
      return { message: 'Cập nhật trạng thái thành công' };
    });
  }
}

export class DeletePaymentPeriodUseCase {
  constructor(private readonly persistence: BillingPersistencePort) {}
  execute(id: string) {
    return this.persistence.transaction(async (context) => {
      const period = await context.findPeriod(id);
      if (!period) {
        throw new BillingError(
          'PERIOD_NOT_FOUND',
          'Không tìm thấy đợt thanh toán',
        );
      }
      if (await context.hasPaidOrders(id, period.type)) {
        throw new BillingError(
          'PERIOD_WITH_PAID_ORDERS_CANNOT_BE_DELETED',
          'Không thể xóa đợt có đơn đã thanh toán',
        );
      }
      await context.deletePeriod(id, period.type);
      return { message: 'Xóa đợt thanh toán thành công' };
    });
  }
}

export class UpdateBillingOrderUseCase {
  constructor(
    private readonly persistence: BillingPersistencePort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  execute(input: {
    type: BillingOrderType;
    orderId: string;
    status: BillingOrderStatus;
    paidAmount?: number;
    paymentDate?: string;
    paymentMethod?: string;
    actorId: string;
    note?: string;
  }) {
    if (input.type !== 'tuition' && input.type !== 'salary') {
      throw new BillingError(
        'INVALID_ORDER_TYPE',
        'Loại đơn thanh toán không hợp lệ',
      );
    }
    if (input.status !== 'Paid' && input.status !== 'Unpaid') {
      throw new BillingError(
        'INVALID_ORDER_STATUS',
        'Trạng thái đơn không hợp lệ',
      );
    }
    return this.persistence.transaction(async (context) => {
      const found = await context.findOrder(input.type, input.orderId);
      if (!found) {
        throw new BillingError(
          'ORDER_NOT_FOUND',
          'Không tìm thấy đơn thanh toán',
        );
      }
      const period = await context.findPeriod(found.periodId);
      if (!period) {
        throw new BillingError(
          'PERIOD_NOT_FOUND',
          'Không tìm thấy đợt thanh toán',
        );
      }
      if (period.status === 'Closed') {
        throw new BillingError(
          'CLOSED_PERIOD_CANNOT_BE_CHANGED',
          'Không thể thay đổi giao dịch trong đợt đã khóa',
        );
      }
      const order = BillingOrder.restore(found);
      if (input.status === 'Paid') {
        const paymentMethod = input.paymentMethod?.trim();
        if (!paymentMethod) {
          throw new BillingError(
            'INVALID_REQUEST',
            'Phải chọn phương thức thanh toán',
          );
        }
        const paymentDate = input.paymentDate
          ? new Date(input.paymentDate)
          : this.now();
        if (Number.isNaN(paymentDate.getTime())) {
          throw new BillingError(
            'INVALID_PAYMENT_DATE',
            'Ngày giao dịch không hợp lệ',
          );
        }
        order.markPaid(
          input.paidAmount,
          input.note,
          paymentDate,
          paymentMethod,
          input.actorId,
        );
      } else {
        order.markUnpaid(input.note, input.actorId);
      }
      await context.saveOrder(order.toPrimitives());
      await context.saveAudit({
        event: input.status === 'Paid' ? 'PAYMENT_CONFIRMED' : 'PAYMENT_CANCELLED',
        orderType: input.type,
        orderId: input.orderId,
        periodId: found.periodId,
        actorId: input.actorId,
        metadata: {
          before: found,
          after: order.toPrimitives(),
          reason: input.note?.trim() || null,
        },
      });
      if (input.type === 'tuition' && input.status === 'Unpaid') {
        await context.resetPaymentRequest(input.orderId);
      }
      return { message: 'Cập nhật trạng thái đơn hàng thành công' };
    });
  }
}

export class DeleteBillingOrderUseCase {
  constructor(private readonly persistence: BillingPersistencePort) {}
  execute(type: BillingOrderType, orderId: string) {
    if (type !== 'tuition' && type !== 'salary') {
      throw new BillingError(
        'INVALID_ORDER_TYPE',
        'Loại đơn thanh toán không hợp lệ',
      );
    }
    return this.persistence.transaction(async (context) => {
      const order = await context.findOrder(type, orderId);
      if (!order) {
        throw new BillingError(
          'ORDER_NOT_FOUND',
          'Không tìm thấy đơn thanh toán',
        );
      }
      if (order.status === 'Paid') {
        throw new BillingError(
          'PAID_ORDER_CANNOT_BE_DELETED',
          'Không thể xóa đơn đã thanh toán',
        );
      }
      const period = await context.findPeriod(order.periodId);
      if (!period) {
        throw new BillingError(
          'PERIOD_NOT_FOUND',
          'Không tìm thấy đợt thanh toán',
        );
      }
      if (period.status === 'Closed') {
        throw new BillingError(
          'CLOSED_PERIOD_CANNOT_BE_CHANGED',
          'Không thể xóa giao dịch khỏi đợt đã khóa',
        );
      }
      await context.deleteOrder(type, orderId);
      return { message: 'Đã xóa đơn hàng thành công' };
    });
  }
}
