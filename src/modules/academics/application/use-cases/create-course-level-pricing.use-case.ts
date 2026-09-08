import { CoursePricingPersistencePort, CoursePricingRecord } from '../ports/course-pricing-persistence.port';
import { CourseLevelPricingDto } from '../../../../application/dtos/course.dto';
import { AcademicError } from '../../domain/errors/academic.error';
import { CoursePricingTimelineGuard } from '../../domain/services/course-pricing-timeline-guard.service';

export class CreateCourseLevelPricingUseCase {
  constructor(private readonly persistence: CoursePricingPersistencePort) {}

  async execute(levelId: string, dto: CourseLevelPricingDto): Promise<CoursePricingRecord> {
    // 1. Normalize and strictly validate dates (Mandatory effectiveFrom and effectiveTo)
    const { effectiveFrom, effectiveTo } = CoursePricingTimelineGuard.normalizeAndValidateDates(
      dto.effectiveFrom,
      dto.effectiveTo,
    );

    // 2. Validate non-negative amounts
    CoursePricingTimelineGuard.validateAmounts(
      dto.pricePerSession,
      dto.teacherWagePerSession,
      dto.taWagePerSession,
      true,
    );

    // 3. Lock check against already billed dates
    const [maxStudentBillDate, maxTeacherWageDate, maxAssistantWageDate] = await Promise.all([
      this.persistence.getMaxStudentBillDate(levelId),
      this.persistence.getMaxTeacherWageDate(levelId),
      this.persistence.getMaxAssistantWageDate(levelId),
    ]);

    const maxBilledDate = CoursePricingTimelineGuard.computeMaxBilledDate(
      maxStudentBillDate,
      maxTeacherWageDate,
      maxAssistantWageDate,
    );

    CoursePricingTimelineGuard.checkLockAgainstBilledDate(
      { effectiveFrom, effectiveTo },
      maxBilledDate,
      'create',
    );

    if (dto.pricePerSession !== undefined && maxStudentBillDate && effectiveFrom <= maxStudentBillDate) {
      throw new AcademicError(
        'PRICING_CONFLICT',
        `Ngày bắt đầu áp dụng học phí (${effectiveFrom}) phải sau ngày chốt học phí gần nhất (${maxStudentBillDate}).`,
      );
    }
    if (dto.teacherWagePerSession !== undefined && maxTeacherWageDate && effectiveFrom <= maxTeacherWageDate) {
      throw new AcademicError(
        'PRICING_CONFLICT',
        `Ngày bắt đầu áp dụng lương giáo viên (${effectiveFrom}) phải sau ngày chốt lương gần nhất (${maxTeacherWageDate}).`,
      );
    }
    if (dto.taWagePerSession !== undefined && maxAssistantWageDate && effectiveFrom <= maxAssistantWageDate) {
      throw new AcademicError(
        'PRICING_CONFLICT',
        `Ngày bắt đầu áp dụng lương trợ giảng (${effectiveFrom}) phải sau ngày chốt lương trợ giảng gần nhất (${maxAssistantWageDate}).`,
      );
    }

    // 4. Overlap collision detection ("Chạm là Chặn")
    const existingList = await this.persistence.findPricingByLevelId(levelId);
    const hasOverlap = existingList.some((p) => {
      const pFrom = p.effectiveFrom;
      const pTo = p.effectiveTo;
      if (pTo === null) {
        return pFrom <= effectiveTo;
      }
      return effectiveFrom <= pTo && effectiveTo >= pFrom;
    });

    if (hasOverlap) {
      throw new AcademicError(
        'PRICING_CONFLICT',
        'Khoảng thời gian áp dụng bị trùng lặp với một bản ghi biểu giá khác.',
      );
    }

    // 5. Rate inheritance from previous pricing if fields are not provided
    const activePricing = existingList
      .filter((p) => p.effectiveFrom <= effectiveFrom && (!p.effectiveTo || p.effectiveTo >= effectiveFrom))
      .pop() || existingList[existingList.length - 1];

    const finalPrice =
      dto.pricePerSession !== undefined
        ? Number(dto.pricePerSession)
        : activePricing
        ? Number(activePricing.pricePerSession)
        : 0;

    const finalTeacherWage =
      dto.teacherWagePerSession !== undefined
        ? Number(dto.teacherWagePerSession)
        : activePricing
        ? Number(activePricing.teacherWagePerSession)
        : 0;

    const finalTaWage =
      dto.taWagePerSession !== undefined
        ? Number(dto.taWagePerSession)
        : activePricing
        ? Number(activePricing.taWagePerSession)
        : 0;

    return this.persistence.createPricing({
      courseLevelId: levelId,
      pricePerSession: finalPrice,
      teacherWagePerSession: finalTeacherWage,
      taWagePerSession: finalTaWage,
      effectiveFrom,
      effectiveTo,
    });
  }
}
