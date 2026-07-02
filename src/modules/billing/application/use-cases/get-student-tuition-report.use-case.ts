import { Injectable } from '@nestjs/common';
import { BillingPersistencePort } from '../ports/billing-persistence.port';

@Injectable()
export class GetStudentTuitionReportUseCase {
  constructor(private readonly persistence: BillingPersistencePort) {}

  async execute(studentId: string, startDate: string, endDate: string) {
    const { sessions, pricingList } =
      await this.persistence.getStudentTuitionReportData(
        studentId,
        startDate,
        endDate,
      );

    const reportSessions = sessions.map((session) => {
      const date = session.date;
      const levelId = session.courseLevelId;

      const pricing = pricingList.find((p) => {
        return (
          p.courseLevelId === levelId &&
          p.effectiveFrom <= date &&
          (p.effectiveTo === null || p.effectiveTo >= date)
        );
      });

      const rate = pricing ? Number(pricing.pricePerSession) : 0;
      const isPresent = session.isPresent;
      const reason = session.reason;
      const isBilled =
        isPresent || (!isPresent && (!reason || reason.trim() === ''));
      const amount = isBilled ? rate : 0;

      return {
        id: session.id,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        classId: session.classId,
        className: session.className,
        classCode: session.classCode,
        courseName: session.courseName,
        levelName: session.levelName,
        isPresent,
        rate,
        amount,
        pricingEffectiveFrom: pricing ? pricing.effectiveFrom : null,
        pricingEffectiveTo: pricing ? pricing.effectiveTo : null,
      };
    });

    const totalAmount = reportSessions.reduce((sum, s) => sum + s.amount, 0);
    const totalSessions = reportSessions.filter((s) => s.amount > 0).length;

    return {
      sessions: reportSessions,
      totalSessions,
      totalAmount,
      pricingHistory: pricingList.map((p) => ({
        id: (p as any).id,
        levelName: (p as any).levelName || '',
        pricePerSession: Number(p.pricePerSession),
        teacherWagePerSession: Number(p.teacherWagePerSession),
        effectiveFrom: p.effectiveFrom,
        effectiveTo: p.effectiveTo,
      })),
    };
  }
}
