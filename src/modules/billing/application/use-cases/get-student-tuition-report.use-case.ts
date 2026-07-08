import { Injectable } from '@nestjs/common';
import { CalculateStudentTuitionUseCase } from './calculate-student-tuition.use-case';

@Injectable()
export class GetStudentTuitionReportUseCase {
  constructor(private readonly calculator: CalculateStudentTuitionUseCase) {}

  async execute(studentId: string, startDate: string, endDate: string) {
    const { summaries, pricingHistory } = await this.calculator.execute({
      studentId,
      startDate,
      endDate,
      onlyLockedSessions: true,
    });

    const reportSessions = [];
    for (const summary of summaries) {
      for (const s of summary.sessions) {
        reportSessions.push({
          id: s.sessionId,
          date: s.date,
          startTime: s.startTime || '',
          endTime: s.endTime || '',
          classId: s.classId,
          className: s.className,
          classCode: s.classCode,
          courseName: s.courseName,
          levelName: s.levelName,
          isPresent: s.isPresent,
          rate: s.rate,
          amount: s.amount,
          pricingEffectiveFrom: s.pricingEffectiveFrom,
          pricingEffectiveTo: s.pricingEffectiveTo,
        });
      }
    }

    // Sort sessions chronologically (date ASC, startTime ASC)
    reportSessions.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });

    const totalAmount = reportSessions.reduce((sum, s) => sum + s.amount, 0);
    // count sessions where amount > 0 (which means they are billed)
    const totalSessions = reportSessions.filter((s) => s.amount > 0).length;

    return {
      sessions: reportSessions,
      totalSessions,
      totalAmount,
      pricingHistory: pricingHistory.map((p) => ({
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
