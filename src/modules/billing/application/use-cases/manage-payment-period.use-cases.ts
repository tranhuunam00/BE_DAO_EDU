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
  execute(id: string, status: PaymentPeriodStatus) {
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
      const order = BillingOrder.restore(found);
      if (input.status === 'Paid') {
        order.markPaid(input.paidAmount, input.note, this.now());
      } else {
        order.markUnpaid(input.note);
      }
      await context.saveOrder(order.toPrimitives());
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
      await context.deleteOrder(type, orderId);
      return { message: 'Đã xóa đơn hàng thành công' };
    });
  }
}
