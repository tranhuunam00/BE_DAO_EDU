import { Injectable } from '@nestjs/common';
import { BillingPersistencePort } from '../ports/billing-persistence.port';

export interface CalculateStudentTuitionInput {
  studentId: string;
  classIds?: string[];
  startDate?: string;
  endDate?: string;
  onlyLockedSessions?: boolean;
}

export interface SessionDetail {
  sessionId: string;
  date: string;
  startTime: string;
  endTime: string;
  classId: string;
  className: string;
  classCode: string;
  courseLevelId: string;
  courseName: string;
  levelName: string;
  isPresent: boolean;
  reason: string | null;
  isBilled: boolean;
  rate: number;
  amount: number;
  pricingEffectiveFrom: string | null;
  pricingEffectiveTo: string | null;
}

export interface ClassTuitionSummary {
  classId: string;
  classCode: string;
  className: string;
  totalSessions: number;
  presentSessionsCount: number;
  absentSessionsCount: number;
  totalTuitionAmount: number;
  sessions: SessionDetail[];
}

@Injectable()
export class CalculateStudentTuitionUseCase {
  constructor(private readonly persistence: BillingPersistencePort) {}

  async execute(input: CalculateStudentTuitionInput): Promise<{
    summaries: ClassTuitionSummary[];
    pricingHistory: any[];
  }> {
    const { sessions, pricingList, billingItems } =
      await this.persistence.getTuitionCalculationData(
        input.studentId,
        input.classIds,
        input.startDate,
        input.endDate,
        input.onlyLockedSessions,
      );

    // Map billing items rate: key = `${classId}_${month}` -> { rate, paymentStatus }
    const billMap = new Map<string, { rate: number; paymentStatus: string }>();
    for (const item of billingItems) {
      const key = `${item.classId}_${item.month}`;
      billMap.set(key, { rate: item.rate, paymentStatus: item.paymentStatus });
    }

    // Group sessions by class
    const classGroups = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const group = classGroups.get(s.classId) ?? [];
      group.push(s);
      classGroups.set(s.classId, group);
    }

    const summaries: ClassTuitionSummary[] = [];

    for (const [classId, classSessions] of classGroups.entries()) {
      const firstSession = classSessions[0];
      const levelId = firstSession.courseLevelId;
      const classCode = firstSession.classCode;
      const className = firstSession.className;

      const mappedSessions: SessionDetail[] = classSessions.map((session) => {
        const dateStr = session.date;
        const month = dateStr.substring(0, 7); // YYYY-MM

        // 1. Get rate
        const billKey = `${classId}_${month}`;
        const billedInfo = billMap.get(billKey);
        
        const pricing = pricingList.find((p) => {
          return (
            p.courseLevelId === levelId &&
            p.effectiveFrom <= dateStr &&
            (p.effectiveTo === null || p.effectiveTo >= dateStr)
          );
        });

        let rate = 0;
        if (billedInfo) {
          rate = billedInfo.rate;
        } else {
          rate = pricing ? Number(pricing.pricePerSession) : 0;
        }

        const isPresent = session.isPresent;
        const reason = session.reason;
        
        // 2. Check if billed: enrolled AND (present OR absent without leave)
        const isBilled = session.isEnrolled && (isPresent || (!isPresent && (!reason || reason.trim() === '')));
        const amount = isBilled ? rate : 0;

        return {
          sessionId: session.id,
          date: dateStr,
          startTime: session.startTime,
          endTime: session.endTime,
          classId: session.classId,
          className: session.className,
          classCode: session.classCode,
          courseLevelId: session.courseLevelId,
          courseName: session.courseName,
          levelName: session.levelName,
          isPresent,
          reason,
          isBilled,
          rate,
          amount,
          pricingEffectiveFrom: pricing ? pricing.effectiveFrom : null,
          pricingEffectiveTo: pricing ? pricing.effectiveTo : null,
        };
      });

      const totalSessions = mappedSessions.length;
      const presentSessionsCount = mappedSessions.filter((s) => s.isPresent).length;
      const absentSessionsCount = totalSessions - presentSessionsCount;
      const totalTuitionAmount = mappedSessions.reduce((sum, s) => sum + s.amount, 0);

      summaries.push({
        classId,
        classCode,
        className,
        totalSessions,
        presentSessionsCount,
        absentSessionsCount,
        totalTuitionAmount,
        sessions: mappedSessions,
      });
    }

    return {
      summaries,
      pricingHistory: pricingList,
    };
  }
}
