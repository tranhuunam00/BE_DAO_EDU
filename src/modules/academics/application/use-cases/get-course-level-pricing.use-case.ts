import { CoursePricingPersistencePort, CoursePricingRecord } from '../ports/course-pricing-persistence.port';

export interface GetPricingResultDto extends CoursePricingRecord {
  isStudentPriceLocked: boolean;
  isTeacherWageLocked: boolean;
  isTaWageLocked: boolean;
  isDateRangeLocked: boolean;
  isEffectiveFromLocked: boolean;
  isEffectiveToLocked: boolean;
  lastStudentBillDate: string | null;
  lastTeacherWageDate: string | null;
  lastAssistantWageDate: string | null;
}

const subtractOneDay = (dateStr: string): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

export class GetCourseLevelPricingUseCase {
  constructor(private readonly persistence: CoursePricingPersistencePort) {}

  async execute(levelId: string): Promise<GetPricingResultDto[]> {
    const pricings = await this.persistence.findPricingByLevelId(levelId);

    // Auto-heal multiple open-ended records within each type independently
    const types: Array<'student' | 'teacher' | 'ta'> = ['student', 'teacher', 'ta'];
    for (const t of types) {
      const typePricings = pricings.filter((p) => {
        if (p.type) return p.type === t;
        if (t === 'student') return Number(p.pricePerSession) > 0;
        if (t === 'teacher') return Number(p.teacherWagePerSession) > 0;
        return Number(p.taWagePerSession) > 0;
      });
      const sortedAsc = [...typePricings].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
      for (let i = 0; i < sortedAsc.length - 1; i++) {
        const current = sortedAsc[i];
        const next = sortedAsc[i + 1];
        if (current.effectiveTo === null || current.effectiveTo >= next.effectiveFrom) {
          const healedTo = subtractOneDay(next.effectiveFrom);
          if (current.effectiveTo !== healedTo) {
            current.effectiveTo = healedTo;
            await this.persistence.savePricing(current as any);
          }
        }
      }
    }

    const [lastStudentBillDate, lastTeacherWageDate, lastAssistantWageDate] = await Promise.all([
      this.persistence.getMaxStudentBillDate(levelId),
      this.persistence.getMaxTeacherWageDate(levelId),
      this.persistence.getMaxAssistantWageDate(levelId),
    ]);

    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

    return Promise.all(
      pricings.map(async (p) => {
        const pFrom = p.effectiveFrom;
        const pTo = p.effectiveTo;
        const pricingType = p.type || (Number(p.teacherWagePerSession) > 0 ? 'teacher' : Number(p.taWagePerSession) > 0 ? 'ta' : 'student');

        let isStudentPriceLocked = false;
        let isTeacherWageLocked = false;
        let isTaWageLocked = false;

        if (pricingType === 'student') {
          isStudentPriceLocked = await this.persistence.checkStudentBills(levelId, pFrom, pTo);
        } else if (pricingType === 'teacher') {
          isTeacherWageLocked = await this.persistence.checkTeacherWages(levelId, pFrom, pTo);
        } else if (pricingType === 'ta') {
          isTaWageLocked = await this.persistence.checkAssistantWages(levelId, pFrom, pTo);
        }

        const isEffectiveFromLocked = pFrom <= todayStr;
        const isEffectiveToLocked = pTo !== null && pTo <= todayStr;
        const isDateRangeLocked = isEffectiveFromLocked && isEffectiveToLocked;

        return {
          ...p,
          type: pricingType,
          isStudentPriceLocked,
          isTeacherWageLocked,
          isTaWageLocked,
          isDateRangeLocked,
          isEffectiveFromLocked,
          isEffectiveToLocked,
          lastStudentBillDate,
          lastTeacherWageDate,
          lastAssistantWageDate,
        } as GetPricingResultDto;
      })
    );
  }
}
