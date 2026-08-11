import { BillingPersistencePort } from '../ports/billing-persistence.port';
import { BillingError } from '../../domain/errors/billing.error';
import { BillingCalculator } from '../../domain/services/billing-calculator';
import { BillingPeriod } from '../../domain/value-objects/billing-period';
import { CommissionSalaryCalculator } from '../../domain/services/commission-salary-calculator';

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
    const [pricings, sources, commissionTeachers, prevMonthRevenue] = await Promise.all([
      this.persistence.loadPricings(),
      this.persistence.findSalarySources(endDate, teacherIds),
      this.persistence.findCommissionTeachers(teacherIds),
      this.persistence.getPreviousMonthTuitionRevenue(month),
    ]);
    const orders = BillingCalculator.calculate(
      sources,
      pricings,
      'teacherWagePerSession',
    );

    const commissionTeacherIds = new Set(commissionTeachers.map(t => t.id));
    const normalOrders = orders.filter(o => !commissionTeacherIds.has(o.ownerId));

    const commissionOrders = commissionTeachers.map((teacher) => {
      const commission = CommissionSalaryCalculator.calculateCommission(prevMonthRevenue);
      const totalAmount = 5000000 + commission;
      return {
        ownerId: teacher.id,
        ownerCode: teacher.teacherId,
        ownerName: `${teacher.lastName || ''} ${teacher.firstName || ''}`.trim(),
        ownerMobile: teacher.mobile || '',
        ownerStatus: teacher.status || '',
        totalSessions: 0,
        totalAmount,
        lines: [
          {
            sourceIds: [`base-${teacher.id}`],
            classId: teacher.id,
            className: 'Lương cơ bản',
            courseName: '',
            levelName: '',
            sessionsCount: 0,
            rate: 5000000,
            totalAmount: 5000000,
          },
          {
            sourceIds: [`commission-${teacher.id}`],
            classId: teacher.id,
            className: `Thưởng doanh thu học viện (Doanh thu tháng trước: ${prevMonthRevenue.toLocaleString('vi-VN')} ₫)`,
            courseName: '',
            levelName: '',
            sessionsCount: 0,
            rate: commission,
            totalAmount: commission,
          }
        ]
      };
    });

    const finalOrders = [...normalOrders, ...commissionOrders];

    return {
      teachers: finalOrders.map((order) => ({
        teacherId: order.ownerId,
        teacherCode: order.ownerCode,
        name: order.ownerName,
        mobile: order.ownerMobile,
        status: order.ownerStatus,
        totalSessions: order.totalSessions,
        totalAmount: order.totalAmount,
      })),
      grandTotal: finalOrders.reduce((sum, order) => sum + order.totalAmount, 0),
      endDate,
    };
  }
}
