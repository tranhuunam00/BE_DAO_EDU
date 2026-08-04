import dayjs from 'dayjs';
import { Money } from '../value-objects/money';

export interface PricingRule {
  id?: string;
  courseLevelId: string;
  pricePerSession: number;
  teacherWagePerSession: number;
  taWagePerSession: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt?: Date;
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
  roleInSession?: 'teacher' | 'assistant';
  isPresent?: boolean;
  reason?: string | null;
}

export interface BillingLine {
  sourceIds: string[];
  classId: string;
  className: string;
  courseName: string;
  levelName: string;
  sessionsCount: number;
  rate: number;
  totalAmount: number;
  roleInSession?: 'teacher' | 'assistant';
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
  static sortPricings(pricings: PricingRule[]): PricingRule[] {
    return [...pricings].sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (timeDiff !== 0) return timeDiff;
      }
      if (a.id && b.id) {
        const idDiff = b.id.localeCompare(a.id);
        if (idDiff !== 0) return idDiff;
      }
      return dayjs(b.effectiveFrom).diff(dayjs(a.effectiveFrom));
    });
  }

  static getActivePricing(
    pricings: PricingRule[],
    date: string,
    rateField: 'pricePerSession' | 'teacherWagePerSession' | 'taWagePerSession',
    levelId: string,
  ): PricingRule | undefined {
    const sorted = this.sortPricings(pricings);
    return sorted.find(
      (rule) =>
        rule.courseLevelId === levelId &&
        Number(rule[rateField]) > 0 &&
        rule.effectiveFrom <= date &&
        (rule.effectiveTo === null || rule.effectiveTo >= date),
    );
  }

  static calculate(
    sources: BillingSource[],
    pricings: PricingRule[],
    amountField: 'pricePerSession' | 'teacherWagePerSession',
  ): BillingOrderDraft[] {
    const orders = new Map<string, BillingOrderDraft>();

    const sortedPricings = this.sortPricings(pricings);

    for (const source of sources) {
      let rateField = amountField;
      if (amountField === 'teacherWagePerSession' && source.roleInSession === 'assistant') {
        rateField = 'taWagePerSession' as any;
      }

      const pricing = sortedPricings.find(
        (rule) =>
          rule.courseLevelId === source.courseLevelId &&
          Number(rule[rateField]) > 0 &&
          rule.effectiveFrom <= source.date &&
          (rule.effectiveTo === null || rule.effectiveTo >= source.date),
      );
      
      let rate = Money.vnd(pricing ? pricing[rateField] : 0).value;
      if (amountField === 'pricePerSession' && source.isPresent === false) {
        rate = 0;
      }

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

      // Group by classId + rate + role → 1 line per unique combination
      const lineKey = `${source.classId}_${rate}_${source.roleInSession ?? ''}`;
      let existingLine = order.lines.find(
        (l) =>
          `${l.classId}_${l.rate}_${l.roleInSession ?? ''}` === lineKey,
      );
      if (existingLine) {
        existingLine.sourceIds.push(source.id);
        existingLine.sessionsCount += 1;
        existingLine.totalAmount = Money.vnd(existingLine.totalAmount)
          .plus(Money.vnd(rate)).value;
      } else {
        order.lines.push({
          sourceIds: [source.id],
          classId: source.classId,
          className: source.className,
          courseName: source.courseName,
          levelName: source.levelName,
          sessionsCount: 1,
          rate,
          totalAmount: rate,
          roleInSession: source.roleInSession,
        });
      }

      if (amountField === 'teacherWagePerSession' || source.isPresent !== false) {
        order.totalSessions += 1;
      }
      order.totalAmount = Money.vnd(order.totalAmount).plus(
        Money.vnd(rate),
      ).value;
      orders.set(source.ownerId, order);
    }
    return [...orders.values()];
  }
}
