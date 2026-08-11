import { BillingPersistencePort } from '../ports/billing-persistence.port';
import {
  PaymentPeriod,
  PaymentPeriodType,
} from '../../domain/entities/payment-period';
import { BillingCalculator } from '../../domain/services/billing-calculator';
import { BillingError } from '../../domain/errors/billing.error';
import { CommissionSalaryCalculator } from '../../domain/services/commission-salary-calculator';
import { SendTuitionPaymentRequestUseCase } from '../../../payments/application/use-cases/send-tuition-payment-request.use-case';

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
  constructor(
    private readonly persistence: BillingPersistencePort,
    private readonly sendTuitionPaymentRequest?: SendTuitionPaymentRequestUseCase,
  ) {}

  // =========================================================================
  // NGUYÊN TẮC AN TOÀN TÀI CHÍNH & CHỐT PHIẾU THU / PHIẾU LƯƠNG (PERIOD CREATION RULE):
  // 1. Khi chạy tạo chu kỳ tính toán học phí ('tuition') hoặc lương ('salary'):
  //    - Phiếu thu học sinh (Phiếu thu): Chỉ quét từ các ca học đã chốt và đã
  //      được học sinh điểm danh (thông qua context.findTuitionSources).
  //    - Phiếu lương giáo viên/trợ giảng (Phiếu lương): Chỉ quét từ các ca học đã chốt
  //      và bắt buộc phải có ít nhất 1 dòng điểm danh (thông qua context.findSalarySources).
  // 2. Việc này đảm bảo tính nhất quán tuyệt đối, tránh tính hóa đơn hoặc phiếu lương
  //    cho các buổi học trống hoặc các buổi học chưa được giáo viên thực tế bấm chốt.
  // =========================================================================
  async execute(input: CreatePaymentPeriodInput) {
    const period = PaymentPeriod.create(input);
    const result = await this.persistence.transaction(async (context) => {
      let orders: any[];
      if (period.type === 'tuition') {
        const [pricings, sources] = await Promise.all([
          context.loadPricings(),
          context.findTuitionSources(input.endDate, input.studentIds),
        ]);
        const calculatedOrders = BillingCalculator.calculate(
          sources,
          pricings,
          'pricePerSession',
        );
        orders = applyAdjustments(calculatedOrders, input.adjustments);
      } else {
        const [pricings, sources, commissionTeachers, prevMonthRevenue] = await Promise.all([
          context.loadPricings(),
          context.findSalarySources(input.endDate, input.teacherIds),
          context.findCommissionTeachers(input.teacherIds),
          context.getPreviousMonthTuitionRevenue(input.month),
        ]);
        const calculatedOrders = BillingCalculator.calculate(
          sources,
          pricings,
          'teacherWagePerSession',
        );

        const commissionTeacherIds = new Set(commissionTeachers.map(t => t.id));
        const normalOrders = calculatedOrders.filter(o => !commissionTeacherIds.has(o.ownerId));

        const commissionOrders = commissionTeachers.map((teacher) => {
          const commission = CommissionSalaryCalculator.calculateCommission(prevMonthRevenue);
          const totalAmount = 5000000 + commission;
          const matchingOrder = calculatedOrders.find(o => o.ownerId === teacher.id);
          const totalSessions = matchingOrder ? matchingOrder.totalSessions : 0;
          const sessionLines = matchingOrder
            ? matchingOrder.lines.map((l: any) => ({
                ...l,
                rate: 0,
                totalAmount: 0,
              }))
            : [];

          return {
            ownerId: teacher.id,
            ownerCode: teacher.teacherId,
            ownerName: `${teacher.lastName || ''} ${teacher.firstName || ''}`.trim(),
            ownerMobile: teacher.mobile || '',
            ownerStatus: teacher.status || '',
            totalSessions,
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
              },
              ...sessionLines,
            ]
          };
        });

        const finalCalculatedOrders = [...normalOrders, ...commissionOrders];
        orders = applyAdjustments(finalCalculatedOrders, input.adjustments);
      }
      const savedPeriod = await context.savePeriod(period.toPrimitives());
      const billIds = await context.saveOrders(period.type, savedPeriod, orders);
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
      return { savedPeriod, billIds };
    });

    // Auto-generate QR codes for each created tuition bill after transaction commits
    if (period.type === 'tuition' && this.sendTuitionPaymentRequest && result.billIds?.length) {
      for (const billId of result.billIds) {
        try {
          await this.sendTuitionPaymentRequest.executeGenerateOnly(billId);
        } catch (err) {
          console.error(`Auto QR generation failed for bill ${billId}:`, err);
        }
      }
    }

    return {
      message: 'Đã tạo đợt thanh toán thành công',
      data: result.savedPeriod,
    };
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
          sourceIds: [`adjustment-${order.ownerId}`],
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
