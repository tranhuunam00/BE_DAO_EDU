import { BillingPersistencePort } from '../ports/billing-persistence.port';
import {
  PaymentPeriod,
  PaymentPeriodType,
} from '../../domain/entities/payment-period';
import { BillingCalculator } from '../../domain/services/billing-calculator';

export interface CreatePaymentPeriodInput {
  name: string;
  type: PaymentPeriodType;
  month: string;
  startDate: string;
  endDate: string;
  studentIds?: string[];
  teacherIds?: string[];
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
      const orders = BillingCalculator.calculate(
        sources,
        pricings,
        period.type === 'tuition' ? 'pricePerSession' : 'teacherWagePerSession',
      );
      const savedPeriod = await context.savePeriod(period.toPrimitives());
      await context.saveOrders(period.type, savedPeriod, orders);
      return {
        message: 'Đã tạo đợt thanh toán thành công',
        data: savedPeriod,
      };
    });
  }
}
