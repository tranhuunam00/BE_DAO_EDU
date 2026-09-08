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

    const finalPrice = dto.pricePerSession !== undefined ? Number(dto.pricePerSession) : 0;
    const finalTeacherWage = dto.teacherWagePerSession !== undefined ? Number(dto.teacherWagePerSession) : 0;
    const finalTaWage = dto.taWagePerSession !== undefined ? Number(dto.taWagePerSession) : 0;

    if (finalPrice <= 0 && finalTeacherWage <= 0 && finalTaWage <= 0) {
      throw new AcademicError(
        'BAD_REQUEST',
        'Vui lòng cấu hình ít nhất một loại đơn giá hoặc lương lớn hơn 0.',
      );
    }

    // 4. Field-level Overlap collision detection ("Trùng dải ngày cùng đối tượng là Chặn")
    const existingList = await this.persistence.findPricingByLevelId(levelId);

    const checkFieldOverlap = (rateField: 'pricePerSession' | 'teacherWagePerSession' | 'taWagePerSession', label: string) => {
      const fieldPricings = existingList.filter((p) => Number((p as any)[rateField]) > 0);
      const overlap = fieldPricings.some((p) => {
        const pFrom = p.effectiveFrom;
        const pTo = p.effectiveTo;
        if (pTo === null) {
          return pFrom <= effectiveTo;
        }
        return effectiveFrom <= pTo && effectiveTo >= pFrom;
      });
      if (overlap) {
        throw new AcademicError(
          'PRICING_CONFLICT',
          `Khoảng thời gian áp dụng ${label} bị trùng lặp với một bản ghi ${label} khác.`,
        );
      }
    };

    if (finalPrice > 0) {
      checkFieldOverlap('pricePerSession', 'đơn giá học phí');
    }
    if (finalTeacherWage > 0) {
      checkFieldOverlap('teacherWagePerSession', 'lương giáo viên');
    }
    if (finalTaWage > 0) {
      checkFieldOverlap('taWagePerSession', 'lương trợ giảng');
    }

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
