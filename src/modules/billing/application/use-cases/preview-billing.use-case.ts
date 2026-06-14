import { BillingPersistencePort } from '../ports/billing-persistence.port';
import { BillingError } from '../../domain/errors/billing.error';
import { BillingCalculator } from '../../domain/services/billing-calculator';
import { BillingPeriod } from '../../domain/value-objects/billing-period';

export class PreviewTuitionUseCase {
  constructor(private readonly persistence: BillingPersistencePort) {}

  async execute(month: string, endDate: string, studentIds?: string[]) {
    BillingPeriod.create(month, `${month}-01`, endDate);
    const [pricings, sources] = await Promise.all([
      this.persistence.loadPricings(),
      this.persistence.findTuitionSources(endDate, studentIds),
    ]);
    const orders = BillingCalculator.calculate(
      sources,
      pricings,
      'pricePerSession',
    );
    return {
      students: orders.map((order) => ({
        studentId: order.ownerId,
        studentCode: order.ownerCode,
        name: order.ownerName,
        nickName: order.ownerExtra ?? '',
        mobile: order.ownerMobile,
        status: order.ownerStatus,
        totalSessions: order.totalSessions,
        totalAmount: order.totalAmount,
      })),
      grandTotal: orders.reduce((sum, order) => sum + order.totalAmount, 0),
      endDate,
    };
  }
}

export class PreviewSalaryUseCase {
  constructor(private readonly persistence: BillingPersistencePort) {}

  async execute(endDate: string, teacherIds?: string[]) {
    if (!endDate) {
      throw new BillingError('INVALID_REQUEST', 'Vui lòng cung cấp endDate');
    }
    const month = endDate.slice(0, 7);
    BillingPeriod.create(month, `${month}-01`, endDate);
    const [pricings, sources] = await Promise.all([
      this.persistence.loadPricings(),
      this.persistence.findSalarySources(endDate, teacherIds),
    ]);
    const orders = BillingCalculator.calculate(
      sources,
      pricings,
      'teacherWagePerSession',
    );
    return {
      teachers: orders.map((order) => ({
        teacherId: order.ownerId,
        teacherCode: order.ownerCode,
        name: order.ownerName,
        mobile: order.ownerMobile,
        status: order.ownerStatus,
        totalSessions: order.totalSessions,
        totalAmount: order.totalAmount,
      })),
      grandTotal: orders.reduce((sum, order) => sum + order.totalAmount, 0),
      endDate,
    };
  }
}
