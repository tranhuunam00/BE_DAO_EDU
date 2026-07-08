import { Injectable } from '@nestjs/common';
import { BillingPersistencePort } from '../ports/billing-persistence.port';

export interface CalculateTeacherWageInput {
  teacherId: string;
  classIds?: string[];
  startDate?: string;
  endDate?: string;
  onlyLockedSessions?: boolean;
}

export interface TeacherSessionDetail {
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
  role: 'teacher' | 'assistant';
  rate: number;
  amount: number;
  pricingEffectiveFrom: string | null;
  pricingEffectiveTo: string | null;
}

export interface ClassWageSummary {
  classId: string;
  classCode: string;
  className: string;
  totalSessions: number;
  totalWageAmount: number;
  sessions: TeacherSessionDetail[];
}

@Injectable()
export class CalculateTeacherWageUseCase {
  constructor(private readonly persistence: BillingPersistencePort) {}

  async execute(input: CalculateTeacherWageInput): Promise<{
    summaries: ClassWageSummary[];
    pricingHistory: any[];
  }> {
    const { sessions, pricingList, wageItems } =
      await this.persistence.getTeacherWageCalculationData(
        input.teacherId,
        input.classIds,
        input.startDate,
        input.endDate,
        input.onlyLockedSessions,
      );

    // Map wage items rate: key = `${classId}_${month}` -> rate
    const wageMap = new Map<string, number>();
    for (const item of wageItems) {
      if (item.classId) {
        const key = `${item.classId}_${item.month}`;
        wageMap.set(key, item.rate);
      }
    }

    // Group sessions by class
    const classGroups = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const group = classGroups.get(s.classId) ?? [];
      group.push(s);
      classGroups.set(s.classId, group);
    }

    const summaries: ClassWageSummary[] = [];

    for (const [classId, classSessions] of classGroups.entries()) {
      const firstSession = classSessions[0];
      const classCode = firstSession.classCode;
      const className = firstSession.className;

      const mappedSessions: TeacherSessionDetail[] = classSessions.map((session) => {
        const dateStr = session.date;
        const month = dateStr.substring(0, 7); // YYYY-MM
        const levelId = session.courseLevelId;
        const role = session.teacherId === input.teacherId ? 'teacher' : 'assistant';

        // 1. Get rate
        const wageKey = `${classId}_${month}`;
        const overriddenRate = wageMap.get(wageKey);

        const pricing = pricingList.find((p) => {
          return (
            p.courseLevelId === levelId &&
            p.effectiveFrom <= dateStr &&
            (p.effectiveTo === null || p.effectiveTo >= dateStr)
          );
        });

        let rate = 0;
        if (overriddenRate !== undefined) {
          rate = overriddenRate;
        } else {
          const rateField = role === 'teacher' ? 'teacherWagePerSession' : 'taWagePerSession';
          rate = pricing ? Number(pricing[rateField]) : 0;
        }

        const amount = rate;

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
          role,
          rate,
          amount,
          pricingEffectiveFrom: pricing ? pricing.effectiveFrom : null,
          pricingEffectiveTo: pricing ? pricing.effectiveTo : null,
        };
      });

      const totalSessions = mappedSessions.length;
      const totalWageAmount = mappedSessions.reduce((sum, s) => sum + s.amount, 0);

      summaries.push({
        classId,
        classCode,
        className,
        totalSessions,
        totalWageAmount,
        sessions: mappedSessions,
      });
    }

    return {
      summaries,
      pricingHistory: pricingList,
    };
  }
}
