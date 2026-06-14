import { Money } from '../value-objects/money';

export interface PricingRule {
  courseLevelId: string;
  pricePerSession: number;
  teacherWagePerSession: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface BillingSource {
  id: string;
  ownerId: string;
  ownerCode: string;
  ownerName: string;
  ownerMobile: string;
  ownerStatus: string;
  ownerExtra?: string;
  classId: string;
  className: string;
  courseName: string;
  levelName: string;
  courseLevelId: string;
  date: string;
}

export interface BillingLine {
  sourceId: string;
  classId: string;
  className: string;
  courseName: string;
  levelName: string;
  sessionsCount: number;
  rate: number;
  totalAmount: number;
}

export interface BillingOrderDraft {
  ownerId: string;
  ownerCode: string;
  ownerName: string;
  ownerMobile: string;
  ownerStatus: string;
  ownerExtra?: string;
  totalSessions: number;
  totalAmount: number;
  lines: BillingLine[];
}

export class BillingCalculator {
  static calculate(
    sources: BillingSource[],
    pricings: PricingRule[],
    amountField: 'pricePerSession' | 'teacherWagePerSession',
  ): BillingOrderDraft[] {
    const orders = new Map<string, BillingOrderDraft>();
    for (const source of sources) {
      const pricing = pricings.find(
        (rule) =>
          rule.courseLevelId === source.courseLevelId &&
          rule.effectiveFrom <= source.date &&
          (rule.effectiveTo === null || rule.effectiveTo >= source.date),
      );
      const rate = Money.vnd(pricing ? pricing[amountField] : 0).value;
      if (rate === 0) continue;

      const order = orders.get(source.ownerId) ?? {
        ownerId: source.ownerId,
        ownerCode: source.ownerCode,
        ownerName: source.ownerName,
        ownerMobile: source.ownerMobile,
        ownerStatus: source.ownerStatus,
        ownerExtra: source.ownerExtra,
        totalSessions: 0,
        totalAmount: 0,
        lines: [],
      };
      const dateParts = source.date.split('-');
      const formattedDate =
        dateParts.length === 3
          ? `${dateParts[2]}/${dateParts[1]}`
          : source.date;
      order.lines.push({
        sourceId: source.id,
        classId: source.classId,
        className: `${source.className} (Buổi ${formattedDate})`,
        courseName: source.courseName,
        levelName: source.levelName,
        sessionsCount: 1,
        rate,
        totalAmount: rate,
      });
      order.totalSessions += 1;
      order.totalAmount = Money.vnd(order.totalAmount).plus(
        Money.vnd(rate),
      ).value;
      orders.set(source.ownerId, order);
    }
    return [...orders.values()];
  }
}
