import { CoursePricingPersistencePort, CoursePricingRecord } from '../ports/course-pricing-persistence.port';

export interface GetPricingResultDto extends CoursePricingRecord {
  isStudentPriceLocked: boolean;
  isTeacherWageLocked: boolean;
  isTaWageLocked: boolean;
  isDateRangeLocked: boolean;
  lastStudentBillDate: string | null;
  lastTeacherWageDate: string | null;
  lastAssistantWageDate: string | null;
}

export class GetCourseLevelPricingUseCase {
  constructor(private readonly persistence: CoursePricingPersistencePort) {}

  async execute(levelId: string): Promise<GetPricingResultDto[]> {
    const pricings = await this.persistence.findPricingByLevelId(levelId);

    const [lastStudentBillDate, lastTeacherWageDate, lastAssistantWageDate] = await Promise.all([
      this.persistence.getMaxStudentBillDate(levelId),
      this.persistence.getMaxTeacherWageDate(levelId),
      this.persistence.getMaxAssistantWageDate(levelId),
    ]);

    return Promise.all(
      pricings.map(async (p) => {
        const pFrom = p.effectiveFrom;
        const pTo = p.effectiveTo;

        const [isStudentPriceLocked, isTeacherWageLocked, isTaWageLocked] = await Promise.all([
          this.persistence.checkStudentBills(levelId, pFrom, pTo),
          this.persistence.checkTeacherWages(levelId, pFrom, pTo),
          this.persistence.checkAssistantWages(levelId, pFrom, pTo),
        ]);

        const isDateRangeLocked = isStudentPriceLocked || isTeacherWageLocked || isTaWageLocked;

        return {
          ...p,
          isStudentPriceLocked,
          isTeacherWageLocked,
          isTaWageLocked,
          isDateRangeLocked,
          lastStudentBillDate,
          lastTeacherWageDate,
          lastAssistantWageDate,
        } as GetPricingResultDto;
      })
    );
  }
}
