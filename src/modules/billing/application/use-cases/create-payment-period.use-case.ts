import { BillingPersistencePort } from '../ports/billing-persistence.port';
import {
  PaymentPeriod,
  PaymentPeriodType,
} from '../../domain/entities/payment-period';
import { BillingCalculator } from '../../domain/services/billing-calculator';
import { BillingError } from '../../domain/errors/billing.error';

export interface BillingAdjustmentInput {
  ownerId: string;
  adjustedAmount: number;
  reason: string;
}

export interface CreatePaymentPeriodInput {
  name: string;
  type: PaymentPeriodType;
  month: string;
  startDate: string;
  endDate: string;
  studentIds?: string[];
  teacherIds?: string[];
  actorId?: string;
  adjustments?: BillingAdjustmentInput[];
}

export class CreatePaymentPeriodUseCase {
  constructor(private readonly persistence: BillingPersistencePort) {}

  execute(input: CreatePaymentPeriodInput) {
    const period = PaymentPeriod.create(input);
    return this.persistence.transaction(async (context) => {
      const [pricings, sources] = await Promise.all([
        context.loadPricings(),
        period.type === 'tuition'
          ? context.findTuitionSources(input.endDate, input.studentIds)
          : context.findSalarySources(input.endDate, input.teacherIds),
      ]);
      const calculatedOrders = BillingCalculator.calculate(
        sources,
        pricings,
        period.type === 'tuition' ? 'pricePerSession' : 'teacherWagePerSession',
      );
      const orders = applyAdjustments(calculatedOrders, input.adjustments);
      const savedPeriod = await context.savePeriod(period.toPrimitives());
      await context.saveOrders(period.type, savedPeriod, orders);
      await context.saveAudit({
        event: 'PERIOD_CREATED',
        periodId: savedPeriod.id,
        actorId: input.actorId,
        metadata: {
          type: period.type,
          orderCount: orders.length,
          totalAmount: orders.reduce((sum, order) => sum + order.totalAmount, 0),
          adjustments: input.adjustments ?? [],
        },
      });
      return {
        message: 'Đã tạo đợt thanh toán thành công',
        data: savedPeriod,
      };
    });
  }
}

function applyAdjustments(
  orders: ReturnType<typeof BillingCalculator.calculate>,
  adjustments: BillingAdjustmentInput[] = [],
) {
  const byOwner = new Map(adjustments.map((item) => [item.ownerId, item]));
  return orders.map((order) => {
    const adjustment = byOwner.get(order.ownerId);
    if (!adjustment || adjustment.adjustedAmount === order.totalAmount) {
      return order;
    }
    if (
      !Number.isSafeInteger(adjustment.adjustedAmount) ||
      adjustment.adjustedAmount < 0 ||
      !adjustment.reason?.trim()
    ) {
      throw new BillingError(
        'INVALID_REQUEST',
        'Số tiền điều chỉnh phải hợp lệ và có lý do',
      );
    }
    const difference = adjustment.adjustedAmount - order.totalAmount;
    return {
      ...order,
      totalAmount: adjustment.adjustedAmount,
      lines: [
        ...order.lines,
        {
          sourceId: `adjustment-${order.ownerId}`,
          classId: order.lines[0]?.classId ?? order.ownerId,
          className: `Điều chỉnh: ${adjustment.reason.trim()}`,
          courseName: '',
          levelName: '',
          sessionsCount: 0,
          rate: difference,
          totalAmount: difference,
        },
      ],
    };
  });
}
